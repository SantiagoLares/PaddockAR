import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.models.result import Result
from app.models.session import Session as EventSession
from app.schemas.result import ResultCreate, ResultRead, ResultUpdate

router = APIRouter(prefix="/api/admin/results", tags=["admin results"])
logger = logging.getLogger(__name__)


def load_session_or_404(session_id: int, db: Session) -> EventSession:
    event_session = db.get(EventSession, session_id)
    if event_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return event_session


def load_result_or_404(result_id: int, db: Session) -> Result:
    result = db.get(Result, result_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found",
        )
    return result


def ensure_unique_position(session_id: int, position: int, db: Session, current_id: int | None = None):
    statement = select(Result).where(
        Result.session_id == session_id,
        Result.position == position,
    )
    existing = db.scalars(statement).one_or_none()
    if existing is not None and existing.id != current_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Position already exists for this session",
        )


@router.get("/session/{session_id}", response_model=list[ResultRead])
def list_admin_results_by_session(
    session_id: int,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    load_session_or_404(session_id, db)
    statement = (
        select(Result)
        .where(Result.session_id == session_id)
        .order_by(Result.position, Result.id)
    )
    results = db.scalars(statement).all()
    logger.info("Admin listed %s results for session id=%s", len(results), session_id)
    return results


@router.post("", response_model=ResultRead, status_code=status.HTTP_201_CREATED)
def create_admin_result(
    payload: ResultCreate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    load_session_or_404(payload.session_id, db)
    ensure_unique_position(payload.session_id, payload.position, db)

    result = Result(**payload.model_dump())
    db.add(result)
    db.commit()
    db.refresh(result)
    logger.info("Admin created result id=%s for session id=%s", result.id, result.session_id)
    return result


@router.put("/{result_id}", response_model=ResultRead)
def update_admin_result(
    result_id: int,
    payload: ResultUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    result = load_result_or_404(result_id, db)
    update_data = payload.model_dump(exclude_unset=True)

    session_id = update_data.get("session_id", result.session_id)
    position = update_data.get("position", result.position)
    load_session_or_404(session_id, db)
    ensure_unique_position(session_id, position, db, current_id=result.id)

    for field, value in update_data.items():
        setattr(result, field, value)

    db.commit()
    db.refresh(result)
    logger.info("Admin updated result id=%s fields=%s", result.id, sorted(update_data.keys()))
    return result


@router.delete("/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_result(
    result_id: int,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    result = load_result_or_404(result_id, db)
    db.delete(result)
    db.commit()
    logger.info("Admin deleted result id=%s", result_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
