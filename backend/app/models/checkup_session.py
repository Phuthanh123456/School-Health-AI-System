"""Owned ORM mapping for the predefined demo checkup sessions."""

from datetime import date

from sqlalchemy import Date, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


DEMO_SCHEMA = "schoolhealth_demo"


class CheckupSession(Base):
    __tablename__ = "checkup_sessions"
    __table_args__ = {"schema": DEMO_SCHEMA}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    checkup_date: Mapped[date] = mapped_column(Date, nullable=False)
