from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.result import Result
from app.models.session import Session as EventSession
from app.schemas.result import ResultRead

router = APIRouter(prefix="/api/results", tags=["results"])


@router.get("/session/{session_id}", response_model=list[ResultRead])
def list_results_by_session(session_id: int, db: Session = Depends(get_db)):
    event_session = db.get(EventSession, session_id)
    if event_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    statement = (
        select(Result)
        .where(Result.session_id == session_id)
        .order_by(Result.position, Result.id)
    )
    return db.scalars(statement).all()
