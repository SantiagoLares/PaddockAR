from datetime import datetime, timezone

from app.models.session import Session as EventSession


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def calculate_session_status(session: EventSession, now: datetime | None = None) -> str:
    if session.status == "cancelled":
        return "cancelled"

    current_time = now or datetime.now(timezone.utc)
    starts_at = as_utc(session.starts_at)
    ends_at = as_utc(session.ends_at or session.starts_at)

    if current_time < starts_at:
        return "scheduled"

    if starts_at <= current_time <= ends_at:
        return "live"

    return "finished"


def apply_dynamic_status(sessions: list[EventSession]) -> list[EventSession]:
    now = datetime.now(timezone.utc)

    for session in sessions:
        session.status = calculate_session_status(session, now)

    return sessions
