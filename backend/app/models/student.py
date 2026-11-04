from datetime import date

from sqlalchemy import Column, Date, ForeignKey, Numeric, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = {"schema": "schoolhealth_demo"}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    full_name: Mapped[str] = mapped_column(Text)
    class_name: Mapped[str] = mapped_column(Text)
    health_profile: Mapped["HealthProfile | None"] = relationship(back_populates="student")


class HealthProfile(Base):
    __tablename__ = "health_profiles"
    __table_args__ = {"schema": "schoolhealth_demo"}

    student_id: Mapped[str] = mapped_column(
        Text, ForeignKey("schoolhealth_demo.students.id"), primary_key=True
    )
    allergies: Mapped[str | None] = mapped_column(Text)
    medical_notes: Mapped[str | None] = mapped_column(Text)
    student: Mapped[Student] = relationship(back_populates="health_profile")


class CheckupSession(Base):
    __tablename__ = "checkup_sessions"
    __table_args__ = {"schema": "schoolhealth_demo"}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    checkup_date: Mapped[date] = mapped_column(Date)


class CheckupResult(Base):
    __tablename__ = "checkup_results"
    __table_args__ = {"schema": "schoolhealth_demo"}

    session_id: Mapped[str] = mapped_column(
        Text, ForeignKey("schoolhealth_demo.checkup_sessions.id"), primary_key=True
    )
    student_id: Mapped[str] = mapped_column(
        Text, ForeignKey("schoolhealth_demo.students.id"), primary_key=True
    )
    status: Mapped[str] = mapped_column(Text)
    height_cm: Mapped[float | None] = mapped_column(Numeric(5, 1))
    weight_kg: Mapped[float | None] = mapped_column(Numeric(4, 1))
    vision_left: Mapped[str | None] = mapped_column(Text)
    vision_right: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    student: Mapped[Student] = relationship()


# The importer and student API use table-level operations for these link tables.
accounts = Table(
    "accounts", Base.metadata,
    Column("id", Text, primary_key=True), Column("email", Text, nullable=False, unique=True),
    Column("role", Text, nullable=False), Column("password_hash", Text, nullable=False),
    schema="schoolhealth_demo",
)
student_nurses = Table(
    "student_nurses", Base.metadata,
    Column("student_id", Text, ForeignKey("schoolhealth_demo.students.id"), primary_key=True),
    Column("nurse_id", Text, ForeignKey("schoolhealth_demo.accounts.id"), nullable=False),
    schema="schoolhealth_demo",
)
parent_students = Table(
    "parent_students", Base.metadata,
    Column("parent_id", Text, ForeignKey("schoolhealth_demo.accounts.id"), primary_key=True),
    Column("student_id", Text, ForeignKey("schoolhealth_demo.students.id"), primary_key=True),
    schema="schoolhealth_demo",
)

checkup_sessions = CheckupSession.__table__
checkup_results = CheckupResult.__table__
