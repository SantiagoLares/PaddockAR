import argparse
import json
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal, create_tables
from app.models.category import Category
from app.models.circuit import Circuit
from app.models.event import Event
from app.models.session import Session as EventSession

DATA_DIR = Path(__file__).resolve().parent / "data"
CATEGORY_FILE = DATA_DIR / "categories.json"
CALENDAR_DIR = DATA_DIR / "calendars"
LEGACY_DATA_FILE = DATA_DIR / "initial_events.json"
VALID_STATUSES = {"scheduled", "live", "finished", "cancelled"}
LEGACY_CATEGORY_ALIASES = {
    "turismo-nacional-clase-3": ["turismo-nacional"],
}

SESSION_TEMPLATE_BUILDERS = {
    "f1_standard": "build_f1_standard_sessions",
    "f1_sprint": "build_f1_sprint_sessions",
    "f2_standard": "build_f2_standard_sessions",
    "f2_monaco": "build_f2_monaco_sessions",
    "f3_standard": "build_f3_standard_sessions",
    "motogp_standard": "build_motogp_standard_sessions",
    "arg_touring_standard": "build_arg_touring_standard_sessions",
    "arg_series_standard": "build_arg_series_standard_sessions",
    "arg_pickup_standard": "build_arg_pickup_standard_sessions",
}


def parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)


def parse_date(value: str) -> date:
    return date.fromisoformat(value)


def to_argentina_iso(event_date: date, local_time: time, circuit_timezone: str) -> str:
    try:
        circuit_zone = ZoneInfo(circuit_timezone)
    except ZoneInfoNotFoundError:
        circuit_zone = timezone(timedelta(hours=-3))

    try:
        argentina_zone = ZoneInfo("America/Argentina/Buenos_Aires")
    except ZoneInfoNotFoundError:
        argentina_zone = timezone(timedelta(hours=-3))

    circuit_dt = datetime.combine(event_date, local_time, tzinfo=circuit_zone)
    argentina_dt = circuit_dt.astimezone(argentina_zone)
    return argentina_dt.isoformat()


def build_session_payload(
    *,
    event_date: date,
    circuit_timezone: str,
    order_index: int,
    name: str,
    session_type: str,
    start_time: time,
    duration_minutes: int,
    is_feature: bool = False,
) -> dict:
    starts_at = to_argentina_iso(event_date, start_time, circuit_timezone)
    ends_at = to_argentina_iso(
        event_date,
        (datetime.combine(event_date, start_time) + timedelta(minutes=duration_minutes)).time(),
        circuit_timezone,
    )
    return {
        "name": name,
        "session_type": session_type,
        "starts_at": starts_at,
        "ends_at": ends_at,
        "status": "scheduled",
        "order_index": order_index,
        "is_feature": is_feature,
        "data_quality": "tentative_schedule",
    }


def build_f1_standard_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="Práctica 1", session_type="practice", start_time=time(13, 30), duration_minutes=60),
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=2, name="Práctica 2", session_type="practice", start_time=time(17, 0), duration_minutes=60),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=3, name="Práctica 3", session_type="practice", start_time=time(12, 30), duration_minutes=60),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=4, name="Clasificación", session_type="qualifying", start_time=time(16, 0), duration_minutes=60),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=5, name="Carrera", session_type="race", start_time=time(15, 0), duration_minutes=120, is_feature=True),
    ]


def build_f1_sprint_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="Práctica 1", session_type="practice", start_time=time(13, 30), duration_minutes=60),
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=2, name="Clasificación Sprint", session_type="sprint_qualifying", start_time=time(17, 30), duration_minutes=45),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=3, name="Carrera Sprint", session_type="sprint", start_time=time(13, 0), duration_minutes=60),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=4, name="Clasificación", session_type="qualifying", start_time=time(17, 0), duration_minutes=60),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=5, name="Carrera", session_type="race", start_time=time(15, 0), duration_minutes=120, is_feature=True),
    ]


def build_f2_standard_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="Práctica", session_type="practice", start_time=time(11, 5), duration_minutes=45),
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=2, name="Clasificación", session_type="qualifying", start_time=time(15, 0), duration_minutes=30),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=3, name="Sprint Race", session_type="sprint", start_time=time(14, 15), duration_minutes=60),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=4, name="Feature Race", session_type="race", start_time=time(10, 0), duration_minutes=75, is_feature=True),
    ]


def build_f2_monaco_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="Práctica", session_type="practice", start_time=time(11, 5), duration_minutes=45),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=2, name="Clasificación", session_type="qualifying", start_time=time(15, 0), duration_minutes=30),
        build_session_payload(event_date=start_date + timedelta(days=2), circuit_timezone=circuit_timezone, order_index=3, name="Sprint Race", session_type="sprint", start_time=time(14, 15), duration_minutes=45),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=4, name="Feature Race", session_type="race", start_time=time(9, 40), duration_minutes=65, is_feature=True),
    ]


def build_f3_standard_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="Práctica", session_type="practice", start_time=time(10, 30), duration_minutes=45),
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=2, name="Clasificación", session_type="qualifying", start_time=time(14, 30), duration_minutes=30),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=3, name="Sprint Race", session_type="sprint", start_time=time(11, 5), duration_minutes=45),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=4, name="Feature Race", session_type="race", start_time=time(9, 30), duration_minutes=50, is_feature=True),
    ]


def build_motogp_standard_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="Práctica 1", session_type="practice", start_time=time(10, 45), duration_minutes=45),
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=2, name="Práctica", session_type="practice", start_time=time(15, 0), duration_minutes=60),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=3, name="Clasificación", session_type="qualifying", start_time=time(10, 50), duration_minutes=40),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=4, name="Carrera Sprint", session_type="sprint", start_time=time(15, 0), duration_minutes=45),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=5, name="Carrera", session_type="race", start_time=time(14, 0), duration_minutes=60, is_feature=True),
    ]


def build_arg_touring_standard_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="PrÃ¡ctica", session_type="practice", start_time=time(15, 0), duration_minutes=40),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=2, name="ClasificaciÃ³n", session_type="qualifying", start_time=time(11, 0), duration_minutes=25),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=3, name="Carrera", session_type="race", start_time=time(12, 30), duration_minutes=50, is_feature=True),
    ]


def build_arg_series_standard_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="PrÃ¡ctica", session_type="practice", start_time=time(14, 30), duration_minutes=40),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=2, name="ClasificaciÃ³n", session_type="qualifying", start_time=time(10, 30), duration_minutes=20),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=3, name="Serie", session_type="series", start_time=time(15, 0), duration_minutes=20),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=4, name="Carrera", session_type="race", start_time=time(12, 0), duration_minutes=50, is_feature=True),
    ]


def build_arg_pickup_standard_sessions(start_date: date, end_date: date, circuit_timezone: str) -> list[dict]:
    return [
        build_session_payload(event_date=start_date, circuit_timezone=circuit_timezone, order_index=1, name="PrÃ¡ctica", session_type="practice", start_time=time(15, 30), duration_minutes=35),
        build_session_payload(event_date=start_date + timedelta(days=1), circuit_timezone=circuit_timezone, order_index=2, name="ClasificaciÃ³n", session_type="qualifying", start_time=time(11, 30), duration_minutes=20),
        build_session_payload(event_date=end_date, circuit_timezone=circuit_timezone, order_index=3, name="Carrera", session_type="race", start_time=time(13, 20), duration_minutes=45, is_feature=True),
    ]


def resolve_sessions(payload: dict) -> list[dict]:
    if payload.get("sessions"):
        return payload["sessions"]

    template_name = payload.get("session_template")
    if not template_name:
        return []

    builder_name = SESSION_TEMPLATE_BUILDERS.get(template_name)
    if not builder_name:
        raise ValueError(f"Unknown session template: {template_name}")

    builder = globals()[builder_name]
    return builder(
        parse_date(payload["start_date"]),
        parse_date(payload["end_date"]),
        payload["circuit"]["timezone"],
    )


def get_one_or_none(db: Session, statement):
    return db.scalars(statement).one_or_none()


def ensure_seed_metadata_columns(db: Session) -> None:
    statements = [
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS data_quality VARCHAR(80)",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS source_note TEXT",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS data_quality VARCHAR(80)",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source_note TEXT",
    ]
    for statement in statements:
        db.execute(text(statement))


def upsert_category(db: Session, payload: dict) -> Category:
    category = get_one_or_none(
        db,
        select(Category).where(Category.slug == payload["slug"]),
    )

    if category is None:
        for legacy_slug in LEGACY_CATEGORY_ALIASES.get(payload["slug"], []):
            category = get_one_or_none(
                db,
                select(Category).where(Category.slug == legacy_slug),
            )
            if category is not None:
                break

    if category is None:
        category = Category(slug=payload["slug"])
        db.add(category)

    category.slug = payload["slug"]
    category.name = payload["name"]
    category.short_name = payload["short_name"]
    category.color = payload.get("color")
    return category


def upsert_circuit(db: Session, payload: dict) -> Circuit:
    circuit = get_one_or_none(
        db,
        select(Circuit).where(Circuit.slug == payload["slug"]),
    )

    if circuit is None:
        circuit = Circuit(slug=payload["slug"])
        db.add(circuit)

    circuit.name = payload["name"]
    circuit.country = payload["country"]
    circuit.city = payload.get("city")
    circuit.timezone = payload.get("timezone", "America/Argentina/Buenos_Aires")
    return circuit


def legacy_event_slug(payload: dict) -> str | None:
    category_slug = payload.get("category_slug")
    slug = payload.get("slug", "")
    if category_slug == "turismo-nacional-clase-3" and slug.startswith("tn-c3-"):
        return slug.replace("tn-c3-", "tn-", 1)
    return None


def cleanup_legacy_tn_class3_events(db: Session) -> None:
    categories = db.scalars(select(Category).where(Category.short_name == "TN C3")).all()
    if not categories:
        return

    category = categories[0]
    events = db.scalars(
        select(Event).where(
            Event.category_id == category.id,
        )
    ).all()

    for event in events:
        if event.slug.startswith("tn-") and not event.slug.startswith("tn-c3-"):
            db.delete(event)


def upsert_event(db: Session, payload: dict, category: Category, circuit: Circuit) -> Event:
    event = get_one_or_none(
        db,
        select(Event).where(
            Event.category_id == category.id,
            Event.season_year == payload["season_year"],
            Event.slug == payload["slug"],
        ),
    )

    if event is None:
        legacy_slug = legacy_event_slug(payload)
        if legacy_slug:
            event = get_one_or_none(
                db,
                select(Event).where(
                    Event.category_id == category.id,
                    Event.season_year == payload["season_year"],
                    Event.slug == legacy_slug,
                ),
            )

    sessions = resolve_sessions(payload)
    if sessions:
        start_at = parse_datetime(sessions[0]["starts_at"])
        end_at = parse_datetime(sessions[-1]["ends_at"] or sessions[-1]["starts_at"])
        start_date = parse_date(payload["start_date"]) if payload.get("start_date") else start_at.date()
        end_date = parse_date(payload["end_date"]) if payload.get("end_date") else end_at.date()
    else:
        if not payload.get("start_date") or not payload.get("end_date"):
            raise ValueError(f"Event {payload['slug']} requires start_date and end_date when sessions are missing")
        start_date = parse_date(payload["start_date"])
        end_date = parse_date(payload["end_date"])

    if event is None:
        event = Event(
            category_id=category.id,
            season_year=payload["season_year"],
            slug=payload["slug"],
        )
        db.add(event)

    event.circuit_id = circuit.id
    event.round_number = payload.get("round_number")
    event.name = payload["name"]
    event.slug = payload["slug"]
    event.start_date = start_date
    event.end_date = end_date
    event.status = normalize_status(payload.get("status", "scheduled"))
    event.data_quality = payload.get("data_quality")
    event.source_note = payload.get("source_note")
    return event


def normalize_status(value: str) -> str:
    if value not in VALID_STATUSES:
        return "scheduled"
    return value


def normalize_calendar_name(value: str) -> str:
    return value if value.endswith(".json") else f"{value}.json"


def load_seed_data(calendar_names: list[str] | None = None) -> dict:
    if CATEGORY_FILE.exists() and CALENDAR_DIR.exists():
        with CATEGORY_FILE.open("r", encoding="utf-8") as file:
            categories = json.load(file)

        events = []
        calendar_event_slugs: dict[tuple[str, int], set[str]] = {}
        if calendar_names:
            calendar_files = [CALENDAR_DIR / normalize_calendar_name(name) for name in calendar_names]
        else:
            calendar_files = sorted(CALENDAR_DIR.glob("*.json"))

        for calendar_file in calendar_files:
            if not calendar_file.exists():
                raise FileNotFoundError(f"Calendar file not found: {calendar_file.name}")
            with calendar_file.open("r", encoding="utf-8") as file:
                calendar_data = json.load(file)
            source_note = calendar_data.get("source_note")
            category_slug = calendar_data.get("category_slug")
            season_year = calendar_data.get("season_year")
            if category_slug and season_year:
                calendar_event_slugs.setdefault((category_slug, season_year), set())
            for event in calendar_data.get("events", []):
                event_payload = dict(event)
                if source_note and not event_payload.get("source_note"):
                    event_payload["source_note"] = source_note
                if category_slug and not event_payload.get("category_slug"):
                    event_payload["category_slug"] = category_slug
                if season_year and not event_payload.get("season_year"):
                    event_payload["season_year"] = season_year
                if category_slug and season_year:
                    calendar_event_slugs[(category_slug, season_year)].add(event_payload["slug"])
                events.append(event_payload)

        events.sort(key=lambda event: (event["season_year"], event.get("round_number") or 999, event["slug"]))
        return {
            "categories": categories,
            "events": events,
            "calendar_event_slugs": calendar_event_slugs,
        }

    with LEGACY_DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def upsert_session(db: Session, payload: dict, event: Event) -> EventSession:
    session = get_one_or_none(
        db,
        select(EventSession).where(
            EventSession.event_id == event.id,
            EventSession.order_index == payload["order_index"],
        ),
    )

    if session is None:
        session = EventSession(
            event_id=event.id,
            order_index=payload["order_index"],
        )
        db.add(session)

    session.name = payload["name"]
    session.session_type = payload["session_type"]
    session.starts_at = parse_datetime(payload["starts_at"])
    session.ends_at = parse_datetime(payload["ends_at"]) if payload.get("ends_at") else None
    session.status = normalize_status(payload.get("status", "scheduled"))
    session.is_feature = payload.get("is_feature", False)
    session.data_quality = payload.get("data_quality")
    session.source_note = payload.get("source_note")
    return session


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Carga datos iniciales de PaddockAR.")
    parser.add_argument(
        "--calendar",
        action="append",
        dest="calendars",
        help="Archivo de calendario a cargar desde backend/app/seeds/data/calendars. Puede repetirse.",
    )
    return parser.parse_args()


def cleanup_stale_calendar_events(
    db: Session,
    category_by_slug: dict[str, Category],
    calendar_event_slugs: dict[tuple[str, int], set[str]],
) -> None:
    for (category_slug, season_year), desired_slugs in calendar_event_slugs.items():
        category = category_by_slug.get(category_slug)
        if category is None:
            continue

        existing_events = db.scalars(
            select(Event).where(
                Event.category_id == category.id,
                Event.season_year == season_year,
            )
        ).all()

        for event in existing_events:
            if event.slug not in desired_slugs:
                db.delete(event)


def seed(calendar_names: list[str] | None = None) -> None:
    create_tables()
    data = load_seed_data(calendar_names)

    db = SessionLocal()
    try:
        ensure_seed_metadata_columns(db)
        category_by_slug = {}
        for category_payload in data["categories"]:
            category = upsert_category(db, category_payload)
            db.flush()
            category_by_slug[category.slug] = category

        cleanup_legacy_tn_class3_events(db)
        cleanup_stale_calendar_events(db, category_by_slug, data.get("calendar_event_slugs", {}))

        for event_payload in data["events"]:
            category = category_by_slug[event_payload["category_slug"]]
            circuit = upsert_circuit(db, event_payload["circuit"])
            db.flush()

            event = upsert_event(db, event_payload, category, circuit)
            db.flush()

            for session_payload in resolve_sessions(event_payload):
                upsert_session(db, session_payload, event)

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("Seed inicial cargado correctamente.")


if __name__ == "__main__":
    args = parse_args()
    seed(args.calendars)
