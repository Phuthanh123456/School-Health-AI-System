"""Existing CSV nurse assignments and an append-only assignment audit."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, Table, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.checkup import Account  # Register the shared account table.


student_nurses = Table(
    "student_nurses", Base.metadata,
    Column("student_id", Text, ForeignKey("schoolhealth_demo.students.id"), primary_key=True),
    Column("nurse_id", Text, ForeignKey("schoolhealth_demo.accounts.id"), nullable=False),
    Index("ix_student_nurses_nurse", "nurse_id"),
    schema="schoolhealth_demo",
)


class AssignmentAudit(Base):
    __tablename__ = "assignment_audit"
    __table_args__ = (Index("ix_assignment_audit_student_kind", "student_id", "kind"), {"schema": "schoolhealth_demo"})

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(Text, nullable=False)
    student_id: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    old_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    new_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
