from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (
        UniqueConstraint("session_id", "position", name="uq_result_session_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False, index=True)
    position: Mapped[int] = mapped_column(nullable=False)
    driver_name: Mapped[str] = mapped_column(String(120), nullable=False)
    team_name: Mapped[str] = mapped_column(String(120), nullable=False)
    time_or_gap: Mapped[str] = mapped_column(String(60), nullable=True)
    points: Mapped[int] = mapped_column(nullable=True)

    session: Mapped["Session"] = relationship(back_populates="results")
