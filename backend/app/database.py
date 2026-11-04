"""SQLAlchemy database setup. Importing this module never opens a connection."""

from collections.abc import Generator
from fastapi import HTTPException

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


# An engine is only configured when deployment supplies DATABASE_URL. Engine
# creation is lazy with respect to network access; no connection is made here.
engine: Engine | None = (
    create_engine(settings.database_url, pool_pre_ping=True)
    if settings.database_url
    else None
)

# Keep a reusable factory and bind it per request so application startup and
# basic endpoint tests work before PostgreSQL infrastructure is available.
SessionLocal = sessionmaker(autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session, failing clearly if DATABASE_URL is missing."""
    if engine is None:
        raise HTTPException(503, "Database is not configured.")

    db = SessionLocal(bind=engine)
    try:
        yield db
    finally:
        db.close()
