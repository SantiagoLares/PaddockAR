import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import require_admin
from app.core.database import get_db
from app.models.category import Category
from app.models.standing import Standing
from app.schemas.standing import StandingCreate, StandingDetailRead, StandingUpdate

router = APIRouter(prefix="/api/admin/standings", tags=["admin standings"])
logger = logging.getLogger(__name__)
VALID_STANDING_TYPES = {"drivers", "constructors", "general"}


def load_category_or_404(category_id: int, db: Session) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


def load_standing_or_404(standing_id: int, db: Session) -> Standing:
    statement = (
        select(Standing)
        .options(joinedload(Standing.category))
        .where(Standing.id == standing_id)
    )
    standing = db.scalars(statement).one_or_none()
    if standing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Standing not found",
        )
    return standing


def ensure_unique_position(
    category_id: int,
    standing_type: str,
    position: int,
    db: Session,
    current_id: int | None = None,
):
    statement = select(Standing).where(
        Standing.category_id == category_id,
        Standing.standing_type == standing_type,
        Standing.position == position,
    )
    existing = db.scalars(statement).one_or_none()
    if existing is not None and existing.id != current_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Position already exists for this category and championship type",
        )


def load_standing_with_category(standing_id: int, db: Session) -> Standing | None:
    statement = (
        select(Standing)
        .options(joinedload(Standing.category))
        .where(Standing.id == standing_id)
    )
    return db.scalars(statement).one_or_none()


@router.get("", response_model=list[StandingDetailRead])
def list_admin_standings(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    statement = (
        select(Standing)
        .options(joinedload(Standing.category))
        .order_by(Standing.category_id, Standing.standing_type, Standing.position, Standing.id)
    )
    standings = db.scalars(statement).all()
    logger.info("Admin listed %s standings", len(standings))
    return standings


@router.post("", response_model=StandingDetailRead, status_code=status.HTTP_201_CREATED)
def create_admin_standing(
    payload: StandingCreate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    load_category_or_404(payload.category_id, db)
    ensure_unique_position(payload.category_id, payload.standing_type, payload.position, db)

    standing = Standing(**payload.model_dump())
    db.add(standing)
    db.commit()
    db.refresh(standing)
    logger.info("Admin created standing id=%s", standing.id)

    created = load_standing_with_category(standing.id, db)
    assert created is not None
    return created


@router.put("/{standing_id}", response_model=StandingDetailRead)
def update_admin_standing(
    standing_id: int,
    payload: StandingUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    standing = load_standing_or_404(standing_id, db)
    update_data = payload.model_dump(exclude_unset=True)

    category_id = update_data.get("category_id", standing.category_id)
    standing_type = update_data.get("standing_type", standing.standing_type)
    position = update_data.get("position", standing.position)

    load_category_or_404(category_id, db)
    if standing_type not in VALID_STANDING_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid standing type",
        )
    ensure_unique_position(category_id, standing_type, position, db, current_id=standing.id)

    for field, value in update_data.items():
        setattr(standing, field, value)

    db.commit()
    db.refresh(standing)
    logger.info("Admin updated standing id=%s fields=%s", standing.id, sorted(update_data.keys()))

    updated = load_standing_with_category(standing.id, db)
    assert updated is not None
    return updated


@router.delete("/{standing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_standing(
    standing_id: int,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    standing = load_standing_or_404(standing_id, db)
    db.delete(standing)
    db.commit()
    logger.info("Admin deleted standing id=%s", standing_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
