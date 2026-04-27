import json
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal, create_tables
from app.models.category import Category
from app.models.circuit import Circuit
from app.models.event import Event
from app.models.session import Session as EventSession

DATA_FILE = Path(__file__).resolve().parent / "data" / "initial_events.json"
VALID_STATUSES = {"scheduled", "live", "finished", "cancelled"}


def parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)


def get_one_or_none(db: Session, statement):
    return db.scalars(statement).one_or_none()


def upsert_category(db: Session, payload: dict) -> Category:
    category = get_one_or_none(
        db,
        select(Category).where(Category.slug == payload["slug"]),
    )

    if category is None:
        category = Category(slug=payload["slug"])
        db.add(category)

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


def upsert_event(db: Session, payload: dict, category: Category, circuit: Circuit) -> Event:
    event = get_one_or_none(
        db,
        select(Event).where(
            Event.category_id == category.id,
            Event.season_year == payload["season_year"],
            Event.slug == payload["slug"],
        ),
    )

    sessions = payload["sessions"]
    start_at = parse_datetime(sessions[0]["starts_at"])
    end_at = parse_datetime(sessions[-1]["ends_at"] or sessions[-1]["starts_at"])

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
    event.start_date = start_at.date()
    event.end_date = end_at.date()
    event.status = normalize_status(payload.get("status", "scheduled"))
    return event


def normalize_status(value: str) -> str:
    if value not in VALID_STATUSES:
        return "scheduled"
    return value


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
    return session


def seed() -> None:
    create_tables()

    with DATA_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    db = SessionLocal()
    try:
        category_by_slug = {}
        for category_payload in data["categories"]:
            category = upsert_category(db, category_payload)
            db.flush()
            category_by_slug[category.slug] = category

        for event_payload in data["events"]:
            category = category_by_slug[event_payload["category_slug"]]
            circuit = upsert_circuit(db, event_payload["circuit"])
            db.flush()

            event = upsert_event(db, event_payload, category, circuit)
            db.flush()

            for session_payload in event_payload["sessions"]:
                upsert_session(db, session_payload, event)

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("Seed inicial cargado correctamente.")


if __name__ == "__main__":
    seed()
