from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        UniqueConstraint("event_id", "order_index", name="uq_session_event_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    session_type: Mapped[str] = mapped_column(String(50), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="scheduled")
    order_index: Mapped[int] = mapped_column(nullable=False, default=0)
    is_feature: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    data_quality: Mapped[str] = mapped_column(String(80), nullable=True)
    source_note: Mapped[str] = mapped_column(Text, nullable=True)

    event: Mapped["Event"] = relationship(back_populates="sessions")
    results: Mapped[list["Result"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Result.position",
    )
