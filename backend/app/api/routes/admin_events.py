import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.auth import require_admin
from app.core.database import get_db
from app.models.category import Category
from app.models.circuit import Circuit
from app.models.event import Event
from app.schemas.event import EventCreate, EventRead, EventUpdate

router = APIRouter(prefix="/api/admin/events", tags=["admin events"])
logger = logging.getLogger(__name__)

VALID_STATUSES = {"scheduled", "live", "finished", "cancelled"}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return slug.strip("-") or "event"


def build_event_slug(payload: dict) -> str:
    base_slug = slugify(payload["name"])
    if payload.get("round_number"):
        return f"{base_slug}-r{payload['round_number']}"
    return f"{base_slug}-{payload['season_year']}"


def normalize_name(value: str) -> str:
    name = value.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Event name is required",
        )
    return name


def load_category(category_id: int, db: Session) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


def load_circuit(circuit_id: int, db: Session) -> Circuit:
    circuit = db.get(Circuit, circuit_id)
    if circuit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Circuit not found",
        )
    return circuit


def validate_status(value: str) -> str:
    if value not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid event status",
        )
    return value


def validate_event_dates(start_date, end_date):
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be greater than or equal to start_date",
        )


def get_event_with_relations(event_id: int, db: Session) -> Event | None:
    statement = (
        select(Event)
        .options(
            joinedload(Event.category),
            joinedload(Event.circuit),
        )
        .where(Event.id == event_id)
    )
    return db.scalars(statement).one_or_none()


@router.get("", response_model=list[EventRead])
def list_admin_events(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    statement = (
        select(Event)
        .options(
            joinedload(Event.category),
            joinedload(Event.circuit),
        )
        .order_by(Event.start_date, Event.id)
    )
    events = db.scalars(statement).all()
    logger.info("Admin listed %s events", len(events))
    return events


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
def create_admin_event(
    payload: EventCreate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    create_data = payload.model_dump()
    create_data["name"] = normalize_name(create_data["name"])
    validate_status(create_data["status"])
    validate_event_dates(create_data["start_date"], create_data["end_date"])
    load_category(create_data["category_id"], db)
    load_circuit(create_data["circuit_id"], db)

    event = Event(
        **create_data,
        slug=build_event_slug(create_data),
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.warning("Admin tried to create duplicate event slug=%s", event.slug)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Event already exists for that category and season",
        ) from None
    db.refresh(event)
    logger.info("Admin created event id=%s", event.id)

    created = get_event_with_relations(event.id, db)
    assert created is not None
    return created


@router.put("/{event_id}", response_model=EventRead)
def update_admin_event(
    event_id: int,
    payload: EventUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    event = get_event_with_relations(event_id, db)
    if event is None:
        logger.warning("Admin tried to update missing event id=%s", event_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "status" in update_data:
        validate_status(update_data["status"])

    if "name" in update_data:
        update_data["name"] = normalize_name(update_data["name"])

    if "category_id" in update_data:
        load_category(update_data["category_id"], db)

    if "circuit_id" in update_data:
        load_circuit(update_data["circuit_id"], db)

    next_start_date = update_data.get("start_date", event.start_date)
    next_end_date = update_data.get("end_date", event.end_date)
    validate_event_dates(next_start_date, next_end_date)

    for field, value in update_data.items():
        setattr(event, field, value)

    if any(field in update_data for field in {"name", "round_number", "season_year"}):
        event.slug = build_event_slug(
            {
                "name": event.name,
                "round_number": event.round_number,
                "season_year": event.season_year,
            },
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.warning("Admin tried to update event into duplicate slug id=%s slug=%s", event_id, event.slug)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Event already exists for that category and season",
        ) from None
    db.refresh(event)
    logger.info("Admin updated event id=%s fields=%s", event_id, sorted(update_data.keys()))

    updated = get_event_with_relations(event.id, db)
    assert updated is not None
    return updated
