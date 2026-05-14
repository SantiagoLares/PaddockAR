from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.text_normalization import normalize_category
from app.models.category import Category
from app.schemas.category import CategoryRead

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    statement = select(Category).order_by(Category.name)
    categories = db.scalars(statement).all()
    for category in categories:
        normalize_category(category)
    return categories
