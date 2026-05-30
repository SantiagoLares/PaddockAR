from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    short_name: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    events: Mapped[list["Event"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
    )
    standings: Mapped[list["Standing"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="Standing.position",
    )
