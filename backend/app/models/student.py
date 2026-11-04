from sqlalchemy import Column, ForeignKey, Table, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = {"schema": "schoolhealth_demo"}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    full_name: Mapped[str] = mapped_column(Text)
    class_name: Mapped[str] = mapped_column(Text)


class HealthProfile(Base):
    __tablename__ = "health_profiles"
    __table_args__ = {"schema": "schoolhealth_demo"}

    student_id: Mapped[str] = mapped_column(
        Text, ForeignKey("schoolhealth_demo.students.id"), primary_key=True
    )
    allergies: Mapped[str | None] = mapped_column(Text)
    medical_notes: Mapped[str | None] = mapped_column(Text)


# Existing seed tables referenced when deleting a student's dependent records.
parent_students = Table(
    "parent_students", Base.metadata,
    Column("parent_id", Text, primary_key=True),
    Column("student_id", Text, ForeignKey("schoolhealth_demo.students.id"), primary_key=True),
    schema="schoolhealth_demo",
)
checkup_results = Table(
    "checkup_results", Base.metadata,
    Column("session_id", Text, primary_key=True),
    Column("student_id", Text, ForeignKey("schoolhealth_demo.students.id"), primary_key=True),
    schema="schoolhealth_demo",
    extend_existing=True,
)
