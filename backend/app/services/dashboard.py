"""Database-side school-wide counts; no student records are loaded for AI."""

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.checkup import CheckupResult
from app.models.student import Student
from app.schemas.insights import Aggregates, DashboardSnapshot


def read_dashboard_snapshot(db: Session) -> DashboardSnapshot:
    # Match US-5.2: saved records across sessions, not distinct examined students.
    # A single statement reads both populations in the same database snapshot.
    query = select(
        select(func.count(Student.id)).scalar_subquery().label("total_students"),
        func.coalesce(func.sum(case((CheckupResult.status.in_(["completed", "Normal", "follow_up", "Needs Follow-up"]), 1), else_=0)), 0).label("checkups_completed"),
        func.coalesce(func.sum(case((CheckupResult.status.in_(["follow_up", "Needs Follow-up"]), 1), else_=0)), 0).label("followups_pending"),
    ).select_from(CheckupResult)
    try:
        row = db.execute(query).mappings().one()
    except SQLAlchemyError:
        raise HTTPException(503, "School health statistics are temporarily unavailable. Please try again.") from None
    return DashboardSnapshot(
        aggregates=Aggregates(**{key: row[key] for key in Aggregates.model_fields}),
        session_title=None, session_date=None,
    )
