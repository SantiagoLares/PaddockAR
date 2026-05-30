from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        UniqueConstraint("category_id", "season_year", "slug", name="uq_event_category_season_slug"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    circuit_id: Mapped[int] = mapped_column(ForeignKey("circuits.id"), nullable=False, index=True)
    season_year: Mapped[int] = mapped_column(nullable=False, index=True)
    round_number: Mapped[int] = mapped_column(nullable=True)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="scheduled")
    source_url: Mapped[str] = mapped_column(Text, nullable=True)
    data_quality: Mapped[str] = mapped_column(String(80), nullable=True)
    source_note: Mapped[str] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    category: Mapped["Category"] = relationship(back_populates="events")
    circuit: Mapped["Circuit"] = relationship(back_populates="events")
    sessions: Mapped[list["Session"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="Session.order_index",
    )
