"""ORM models for the seeded school health demo schema."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.student import Student


class CheckupSession(Base):
    __tablename__ = "checkup_sessions"
    __table_args__ = {"schema": "schoolhealth_demo"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    checkup_date: Mapped[date] = mapped_column(Date, nullable=False)


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = {"schema": "schoolhealth_demo"}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)


class CheckupResult(Base):
    """A student's result for one session; that row also records participation."""

    __tablename__ = "checkup_results"
    __table_args__ = (
        CheckConstraint("height_cm IS NULL OR height_cm > 0", name="ck_result_height_positive"),
        CheckConstraint("weight_kg IS NULL OR weight_kg > 0", name="ck_result_weight_positive"),
        CheckConstraint("bmi IS NULL OR bmi > 0", name="ck_result_bmi_positive"),
        Index("ix_result_student_session", "student_id", "session_id"),
        {"schema": "schoolhealth_demo", "extend_existing": True},
    )

    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("schoolhealth_demo.checkup_sessions.id"), primary_key=True
    )
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("schoolhealth_demo.students.id"), primary_key=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False)
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    bmi: Mapped[Decimal | None] = mapped_column(Numeric(16, 6))
    vision: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
