from datetime import datetime, time, timedelta
import logging
import re
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import require_admin
from app.core.database import get_db
from app.core.visibility import (
    DEFAULT_HIDDEN_CATEGORY_SLUGS,
    category_should_default_public,
    has_reliable_quality,
    has_valid_source_url,
    obsolete_category_slugs,
    should_be_public_by_quality,
)
from app.models.category import Category
from app.models.circuit import Circuit
from app.models.event import Event
from app.models.session import Session as EventSession
from app.schemas.admin import (
    CalendarAuditBucketItem,
    CalendarAuditResponse,
    CalendarCleanupResponse,
    CategoryAdminRead,
    CategoryVisibilityUpdate,
    CircuitAdminCreate,
    CircuitAdminRead,
    WeekendSessionInput,
    WeekendUpsertRequest,
    WeekendUpsertResponse,
)
from app.schemas.event import EventRead
from app.schemas.session import SessionRead

router = APIRouter(prefix="/api/admin", tags=["admin weekends"])
logger = logging.getLogger(__name__)

ARG_TIMEZONE = ZoneInfo("America/Argentina/Buenos_Aires")
VALID_EVENT_STATUSES = {"scheduled", "live", "finished", "cancelled"}
VALID_SESSION_STATUSES = {"scheduled", "live", "finished", "cancelled"}
CATEGORY_PRESETS = {
    "formula-1": {"name": "Fórmula 1", "short_name": "F1", "color": "#e10600"},
    "formula-2": {"name": "Fórmula 2", "short_name": "F2", "color": "#0090d0"},
    "motogp": {"name": "MotoGP", "short_name": "MotoGP", "color": "#d9e1ea"},
    "wec": {"name": "World Endurance Championship", "short_name": "WEC", "color": "#31d7e2"},
    "turismo-carretera": {"name": "Turismo Carretera", "short_name": "TC", "color": "#4db8ff"},
    "turismo-nacional-clase-3": {"name": "Turismo Nacional Clase 3", "short_name": "TN", "color": "#30a46c"},
}
CATEGORY_SLUG_ALIASES = {
    "f1": "formula-1",
    "formula-1": "formula-1",
    "f2": "formula-2",
    "formula-2": "formula-2",
    "motogp": "motogp",
    "wec": "wec",
    "tc": "turismo-carretera",
    "turismo-carretera": "turismo-carretera",
    "tn": "turismo-nacional-clase-3",
    "tn-c3": "turismo-nacional-clase-3",
    "turismo-nacional-clase-3": "turismo-nacional-clase-3",
}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return slug.strip("-") or "item"


def normalize_category_slug(value: str | None) -> str:
    normalized = slugify(value or "")
    return CATEGORY_SLUG_ALIASES.get(normalized, normalized)


def normalize_text(value: str, *, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} is required",
        )
    return normalized


def validate_status(value: str, *, allowed: set[str], field_name: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name}",
        )
    return normalized


def event_statement() -> Select[tuple[Event]]:
    return (
        select(Event)
        .options(
            joinedload(Event.category),
            joinedload(Event.circuit),
            joinedload(Event.sessions).joinedload(EventSession.results),
        )
    )


def session_statement() -> Select[tuple[EventSession]]:
    return (
        select(EventSession)
        .options(
            joinedload(EventSession.event).joinedload(Event.category),
            joinedload(EventSession.event).joinedload(Event.circuit),
            joinedload(EventSession.results),
        )
    )


def get_admin_categories(db: Session) -> list[Category]:
    return db.scalars(select(Category).order_by(Category.name, Category.id)).all()


def get_admin_circuits(db: Session) -> list[Circuit]:
    return db.scalars(select(Circuit).order_by(Circuit.name, Circuit.id)).all()


def resolve_category(category_id: int | None, category_slug: str | None, db: Session) -> Category:
    category = None
    if category_id is not None:
        category = db.get(Category, category_id)
    elif category_slug:
        normalized_slug = normalize_category_slug(category_slug)
        category = db.scalars(
            select(Category).where(
                (Category.slug == normalized_slug) | (func.lower(Category.short_name) == normalized_slug),
            ),
        ).one_or_none()
        if category is None:
            preset = CATEGORY_PRESETS.get(normalized_slug)
            if preset is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Category not found",
                )
            category = Category(
                slug=normalized_slug,
                name=preset["name"],
                short_name=preset["short_name"],
                color=preset["color"],
                is_public=category_should_default_public(normalized_slug),
                is_active=True,
            )
            db.add(category)
            db.flush()

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="category_id or category_slug is required",
        )
    return category


def resolve_circuit(payload, db: Session) -> Circuit:
    name = normalize_text(payload.name, field_name="circuit.name")
    country = normalize_text(payload.country, field_name="circuit.country")
    city = str(payload.city or "").strip() or None
    slug = slugify(f"{name}-{city or ''}-{country}")

    circuit = db.scalars(
        select(Circuit).where(
            (Circuit.slug == slug)
            | (
                (func.lower(Circuit.name) == name.lower())
                & (func.lower(Circuit.country) == country.lower())
                & (func.coalesce(func.lower(Circuit.city), "") == (city or "").lower())
            ),
        ),
    ).one_or_none()

    if circuit is None:
        circuit = Circuit(slug=slug, name=name, country=country, city=city, timezone=payload.timezone)
        db.add(circuit)
        db.flush()
    else:
        circuit.name = name
        circuit.country = country
        circuit.city = city
        circuit.timezone = payload.timezone

    return circuit


def build_event_slug(name: str, season_year: int) -> str:
    return f"{slugify(name)}-{season_year}"


def get_event_public_state(*, category: Category, data_quality: str | None, source_url: str | None) -> bool:
    return category.is_public and category.is_active and should_be_public_by_quality(
        data_quality=data_quality,
        source_url=source_url,
    )


def resolve_event(category: Category, circuit: Circuit, payload, db: Session) -> tuple[Event, bool]:
    name = normalize_text(payload.name, field_name="event.name")
    season_year = payload.season_year or payload.start_date.year
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="event.end_date must be greater than or equal to start_date",
        )

    status_value = validate_status(payload.status, allowed=VALID_EVENT_STATUSES, field_name="event.status")
    slug = slugify(payload.slug) if payload.slug else build_event_slug(name, season_year)

    event = db.scalars(
        select(Event).where(
            Event.category_id == category.id,
            Event.season_year == season_year,
            Event.slug == slug,
        ),
    ).one_or_none()
    created = event is None

    if event is None:
        event = Event(
            category_id=category.id,
            circuit_id=circuit.id,
            season_year=season_year,
            slug=slug,
            name=name,
            start_date=payload.start_date,
            end_date=payload.end_date,
            round_number=payload.round_number,
            status=status_value,
            source_url=payload.source_url,
            data_quality=payload.data_quality,
            source_note=payload.source_note,
            is_active=True,
            is_public=get_event_public_state(
                category=category,
                data_quality=payload.data_quality,
                source_url=payload.source_url,
            ),
        )
        db.add(event)
        db.flush()
        return event, created

    event.circuit_id = circuit.id
    event.name = name
    event.slug = slug
    event.start_date = payload.start_date
    event.end_date = payload.end_date
    event.season_year = season_year
    event.round_number = payload.round_number
    event.status = status_value
    event.source_url = payload.source_url
    event.data_quality = payload.data_quality
    event.source_note = payload.source_note
    event.is_active = True
    event.is_public = get_event_public_state(
        category=category,
        data_quality=payload.data_quality,
        source_url=payload.source_url,
    )
    db.flush()
    return event, created


def parse_arg_datetime(session_payload: WeekendSessionInput) -> tuple[datetime, datetime]:
    try:
        hour, minute = [int(part) for part in session_payload.time_arg.split(":", 1)]
        local_time = time(hour=hour, minute=minute)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid time_arg for session {session_payload.name}",
        ) from None

    start_local = datetime.combine(session_payload.date, local_time, ARG_TIMEZONE)
    end_local = start_local + timedelta(minutes=session_payload.duration_minutes)
    return start_local.astimezone(ZoneInfo("UTC")), end_local.astimezone(ZoneInfo("UTC"))


def upsert_session(
    *,
    event: Event,
    category: Category,
    payload: WeekendSessionInput,
    order_index: int,
    db: Session,
) -> tuple[EventSession, bool]:
    name = normalize_text(payload.name, field_name="session.name")
    session_type = normalize_text(payload.session_type, field_name="session.session_type").lower()
    session_status = validate_status(payload.status, allowed=VALID_SESSION_STATUSES, field_name="session.status")
    if payload.duration_minutes <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid duration_minutes for session {payload.name}",
        )

    starts_at, ends_at = parse_arg_datetime(payload)
    source_url = payload.source_url or event.source_url
    data_quality = payload.data_quality or event.data_quality
    source_note = payload.source_note or event.source_note
    is_public = category.is_public and category.is_active and event.is_public and should_be_public_by_quality(
        data_quality=data_quality,
        source_url=source_url,
    )

    session = db.scalars(
        select(EventSession).where(
            EventSession.event_id == event.id,
            EventSession.session_type == session_type,
            EventSession.name == name,
        ),
    ).one_or_none()
    created = session is None

    if session is None:
        session = EventSession(
            event_id=event.id,
            name=name,
            session_type=session_type,
            starts_at=starts_at,
            ends_at=ends_at,
            status=session_status,
            order_index=order_index,
            is_feature=payload.is_feature,
            source_url=source_url,
            data_quality=data_quality,
            source_note=source_note,
            is_public=is_public,
            is_active=True,
        )
        db.add(session)
        db.flush()
        return session, created

    session.name = name
    session.session_type = session_type
    session.starts_at = starts_at
    session.ends_at = ends_at
    session.status = session_status
    session.order_index = order_index
    session.is_feature = payload.is_feature
    session.source_url = source_url
    session.data_quality = data_quality
    session.source_note = source_note
    session.is_public = is_public
    session.is_active = True
    db.flush()
    return session, created


def load_event_with_relations(event_id: int, db: Session) -> Event:
    event = db.scalars(event_statement().where(Event.id == event_id)).unique().one()
    return event


def bucket_event(event: Event, *, reason: str | None = None) -> CalendarAuditBucketItem:
    return CalendarAuditBucketItem(
        id=event.id,
        name=event.name,
        slug=event.slug,
        status=event.status,
        reason=reason,
        category=event.category.short_name if event.category else None,
    )


def bucket_session(session: EventSession, *, reason: str | None = None) -> CalendarAuditBucketItem:
    return CalendarAuditBucketItem(
        id=session.id,
        name=session.name,
        slug=session.session_type,
        status=session.status,
        reason=reason,
        category=session.event.category.short_name if session.event and session.event.category else None,
        event_id=session.event_id,
    )


@router.get("/categories", response_model=list[CategoryAdminRead])
def list_admin_categories(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return get_admin_categories(db)


@router.put("/categories/{category_id}", response_model=CategoryAdminRead)
def update_admin_category_visibility(
    category_id: int,
    payload: CategoryVisibilityUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    category.is_public = payload.is_public
    category.is_active = payload.is_active
    db.commit()
    db.refresh(category)
    return category


@router.get("/circuits", response_model=list[CircuitAdminRead])
def list_admin_circuits(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return get_admin_circuits(db)


@router.post("/circuits", response_model=CircuitAdminRead, status_code=status.HTTP_201_CREATED)
def create_admin_circuit(
    payload: CircuitAdminCreate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    circuit = resolve_circuit(payload, db)
    db.commit()
    db.refresh(circuit)
    return circuit


@router.post("/weekends", response_model=WeekendUpsertResponse, status_code=status.HTTP_201_CREATED)
def upsert_admin_weekend(
    payload: WeekendUpsertRequest,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    category = resolve_category(payload.category_id, payload.category_slug, db)
    circuit = resolve_circuit(payload.circuit, db)
    event, event_created = resolve_event(category, circuit, payload.event, db)

    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    seen_keys: set[tuple[str, str]] = set()
    for index, session_payload in enumerate(payload.sessions, start=1):
        key = (session_payload.session_type.lower(), session_payload.name.strip().lower())
        if key in seen_keys:
            skipped += 1
            continue
        seen_keys.add(key)

        try:
            _, was_created = upsert_session(
                event=event,
                category=category,
                payload=session_payload,
                order_index=session_payload.order_index or index,
                db=db,
            )
            if was_created:
                created += 1
            else:
                updated += 1
        except HTTPException as exc:
            errors.append(str(exc.detail))

    db.commit()
    db.refresh(event)
    event_full = load_event_with_relations(event.id, db)

    return WeekendUpsertResponse(
        event_created=event_created,
        event_updated=not event_created,
        event=EventRead.model_validate(event_full),
        sessions_created=created,
        sessions_updated=updated,
        skipped=skipped,
        errors=errors,
    )


@router.get("/calendar-audit", response_model=CalendarAuditResponse)
def get_calendar_audit(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    categories = get_admin_categories(db)
    events = db.scalars(event_statement().order_by(Event.start_date, Event.id)).unique().all()
    sessions = db.scalars(session_statement().order_by(EventSession.starts_at, EventSession.id)).unique().all()

    official_events = [
        bucket_event(event, reason="official_or_verified")
        for event in events
        if has_reliable_quality(event.data_quality) and has_valid_source_url(event.source_url)
    ]
    events_without_source = [
        bucket_event(event, reason="missing_or_invalid_source")
        for event in events
        if not has_valid_source_url(event.source_url)
    ]
    sessions_without_schedule = [
        bucket_session(session, reason="missing_schedule")
        for session in sessions
        if session.starts_at is None or session.ends_at is None
    ]
    sessions_without_source = [
        bucket_session(session, reason="missing_or_invalid_source")
        for session in sessions
        if not has_valid_source_url(session.source_url or session.event.source_url)
    ]

    return CalendarAuditResponse(
        official_events=official_events,
        events_without_source=events_without_source,
        sessions_without_schedule=sessions_without_schedule,
        sessions_without_source=sessions_without_source,
        public_categories=[category for category in categories if category.is_public and category.is_active],
        hidden_categories=[category for category in categories if not category.is_public or not category.is_active],
    )


@router.post("/calendar-cleanup", response_model=CalendarCleanupResponse)
def cleanup_calendar_visibility(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    hidden_category_count = 0
    hidden_event_count = 0
    hidden_session_count = 0

    categories = get_admin_categories(db)
    for category in categories:
        if category.slug in DEFAULT_HIDDEN_CATEGORY_SLUGS:
            if category.is_public or category.is_active:
                hidden_category_count += 1
            category.is_public = False
            category.is_active = False

    events = db.scalars(select(Event).options(joinedload(Event.category))).all()
    for event in events:
        should_hide = (
            not event.category.is_public
            or not event.category.is_active
            or not should_be_public_by_quality(data_quality=event.data_quality, source_url=event.source_url)
        )
        if should_hide and (event.is_public or event.is_active):
            hidden_event_count += 1
        if should_hide:
            event.is_public = False
            event.is_active = False

    sessions = db.scalars(
        select(EventSession).options(joinedload(EventSession.event).joinedload(Event.category)),
    ).all()
    for session in sessions:
        should_hide = (
            not session.event.is_public
            or not session.event.is_active
            or not should_be_public_by_quality(
                data_quality=session.data_quality or session.event.data_quality,
                source_url=session.source_url or session.event.source_url,
            )
        )
        if should_hide and (session.is_public or session.is_active):
            hidden_session_count += 1
        if should_hide:
            session.is_public = False
            session.is_active = False

    db.commit()
    return CalendarCleanupResponse(
        categories_hidden=hidden_category_count,
        events_hidden=hidden_event_count,
        sessions_hidden=hidden_session_count,
        hidden_category_slugs=list(obsolete_category_slugs()),
    )
