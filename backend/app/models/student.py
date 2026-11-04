from sqlalchemy import ForeignKey, Text
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
