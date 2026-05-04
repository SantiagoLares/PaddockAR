from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Standing(Base):
    __tablename__ = "standings"
    __table_args__ = (
        UniqueConstraint("category_id", "standing_type", "position", name="uq_standing_category_type_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    standing_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    position: Mapped[int] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    team_name: Mapped[str] = mapped_column(String(140), nullable=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    category: Mapped["Category"] = relationship(back_populates="standings")
