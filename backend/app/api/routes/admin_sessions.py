from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import require_admin
from app.core.database import get_db
from app.models.event import Event
from app.models.session import Session as EventSession
from app.schemas.session import SessionRead, SessionUpdate

router = APIRouter(prefix="/api/admin/sessions", tags=["admin sessions"])

VALID_STATUSES = {"scheduled", "live", "finished", "cancelled"}


@router.get("", response_model=list[SessionRead])
def list_admin_sessions(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    statement = (
        select(EventSession)
        .options(
            joinedload(EventSession.event).joinedload(Event.category),
            joinedload(EventSession.event).joinedload(Event.circuit),
        )
        .order_by(EventSession.starts_at, EventSession.id)
    )
    return db.scalars(statement).all()


@router.put("/{session_id}", response_model=SessionRead)
def update_admin_session(
    session_id: int,
    payload: SessionUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    statement = (
        select(EventSession)
        .options(
            joinedload(EventSession.event).joinedload(Event.category),
            joinedload(EventSession.event).joinedload(Event.circuit),
        )
        .where(EventSession.id == session_id)
    )
    event_session = db.scalars(statement).one_or_none()

    if event_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid session status",
        )

    for field, value in update_data.items():
        setattr(event_session, field, value)

    db.commit()
    db.refresh(event_session)
    return event_session
