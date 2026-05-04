import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.category import Category
from app.models.standing import Standing
from app.schemas.standing import StandingRead

router = APIRouter(prefix="/api/standings", tags=["standings"])
logger = logging.getLogger(__name__)

CATEGORY_SLUG_ALIASES = {
    "f1": "formula-1",
    "f2": "formula-2",
    "f3": "f3",
    "formula-3": "f3",
    "motogp": "motogp",
    "wec": "wec",
    "tc": "turismo-carretera",
    "tn-c2": "turismo-nacional-clase-2",
    "tn-c3": "turismo-nacional-clase-3",
}


def resolve_category_by_slug(category_slug: str, db: Session) -> Category:
    slug = (category_slug or "").strip().lower()
    canonical_slug = CATEGORY_SLUG_ALIASES.get(slug, slug)
    statement = select(Category).where(Category.slug == canonical_slug)
    category = db.scalars(statement).one_or_none()

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    return category


@router.get("/category/{category_slug}", response_model=list[StandingRead])
def list_public_standings_by_category(
    category_slug: str,
    db: Session = Depends(get_db),
):
    category = resolve_category_by_slug(category_slug, db)
    statement = (
        select(Standing)
        .where(Standing.category_id == category.id)
        .order_by(Standing.standing_type, Standing.position, Standing.id)
    )
    standings = db.scalars(statement).all()
    logger.info("Public standings requested for category slug=%s rows=%s", category_slug, len(standings))
    return standings
