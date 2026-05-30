from collections.abc import Generator
import logging

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ping_database() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        logger.exception("Database ping failed")
        return False


def create_tables() -> None:
    from app import models  # noqa: F401
    from app.core.runtime_schema import ensure_runtime_schema

    logger.info("Creating database tables if needed")
    Base.metadata.create_all(bind=engine)
    applied = ensure_runtime_schema(engine)
    if applied:
        logger.info("Applied runtime schema upgrades: %s", ", ".join(applied))
