from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.event import Event
from app.schemas.event import EventDetailRead, EventRead
from app.services.session_status import apply_dynamic_status

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventRead])
def list_events(db: Session = Depends(get_db)):
    statement = (
        select(Event)
        .options(
            joinedload(Event.category),
            joinedload(Event.circuit),
        )
        .order_by(Event.start_date, Event.id)
    )
    return db.scalars(statement).all()


@router.get("/{event_id}", response_model=EventDetailRead)
def get_event(event_id: int, db: Session = Depends(get_db)):
    statement = (
        select(Event)
        .options(
            joinedload(Event.category),
            joinedload(Event.circuit),
            joinedload(Event.sessions),
        )
        .where(Event.id == event_id)
    )
    event = db.scalars(statement).unique().one_or_none()

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    event.sessions = apply_dynamic_status(list(event.sessions))
    return event
