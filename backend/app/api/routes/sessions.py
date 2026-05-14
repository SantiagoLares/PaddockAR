from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.text_normalization import normalize_session
from app.models.event import Event
from app.models.session import Session as EventSession
from app.schemas.session import SessionRead
from app.services.session_status import apply_dynamic_status

router = APIRouter(tags=["sessions"])


def _session_query():
    return select(EventSession).options(
        joinedload(EventSession.event).joinedload(Event.category),
        joinedload(EventSession.event).joinedload(Event.circuit),
        joinedload(EventSession.results),
    )


@router.get("/api/sessions", response_model=list[SessionRead])
def list_sessions(db: Session = Depends(get_db)):
    statement = _session_query().order_by(EventSession.starts_at, EventSession.id)
    sessions = db.scalars(statement).unique().all()
    sessions = apply_dynamic_status(sessions)
    for session in sessions:
        normalize_session(session)
    return sessions


@router.get("/api/weekend", response_model=list[SessionRead])
def list_weekend_sessions(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    statement = (
        _session_query()
        .where(
            or_(
                EventSession.ends_at >= now,
                EventSession.starts_at >= now,
            )
        )
        .order_by(EventSession.starts_at, EventSession.id)
        .limit(50)
    )
    sessions = db.scalars(statement).unique().all()
    sessions = apply_dynamic_status(sessions)
    for session in sessions:
        normalize_session(session)
    return sessions
