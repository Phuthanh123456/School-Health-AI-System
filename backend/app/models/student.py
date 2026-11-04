from sqlalchemy import Column, Date, ForeignKey, Numeric, Table, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = {"schema": "public"}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    full_name: Mapped[str] = mapped_column(Text)
    class_name: Mapped[str] = mapped_column(Text)


class HealthProfile(Base):
    __tablename__ = "health_profiles"
    __table_args__ = {"schema": "public"}

    student_id: Mapped[str] = mapped_column(
        Text, ForeignKey("public.students.id"), primary_key=True
    )
    allergies: Mapped[str | None] = mapped_column(Text)
    medical_notes: Mapped[str | None] = mapped_column(Text)


accounts = Table(
    "accounts", Base.metadata,
    Column("id", Text, primary_key=True), Column("email", Text, nullable=False, unique=True),
    Column("role", Text, nullable=False), Column("password_hash", Text, nullable=False),
    schema="public",
)
student_nurses = Table(
    "student_nurses", Base.metadata,
    Column("student_id", Text, ForeignKey("public.students.id"), primary_key=True),
    Column("nurse_id", Text, ForeignKey("public.accounts.id"), nullable=False),
    schema="public",
)
parent_students = Table(
    "parent_students", Base.metadata,
    Column("parent_id", Text, ForeignKey("public.accounts.id"), primary_key=True),
    Column("student_id", Text, ForeignKey("public.students.id"), primary_key=True),
    schema="public",
)
checkup_sessions = Table(
    "checkup_sessions", Base.metadata,
    Column("id", Text, primary_key=True), Column("title", Text, nullable=False),
    Column("checkup_date", Date, nullable=False), schema="public",
)
checkup_results = Table(
    "checkup_results", Base.metadata,
    Column("session_id", Text, ForeignKey("public.checkup_sessions.id"), primary_key=True),
    Column("student_id", Text, ForeignKey("public.students.id"), primary_key=True),
    Column("status", Text, nullable=False),
    Column("height_cm", Numeric(5, 1)), Column("weight_kg", Numeric(4, 1)),
    Column("notes", Text),
    schema="public",
)
