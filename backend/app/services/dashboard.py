"""Database-side school-wide counts; no student records are loaded for AI."""

from fastapi import HTTPException
from sqlalchemy import and_, case, func, select, true
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.student import CheckupResult, CheckupSession, Student
from app.schemas.insights import Aggregates, DashboardSnapshot


def read_dashboard_snapshot(db: Session) -> DashboardSnapshot:
    # One SQL statement gives counts and the matching session in one DB snapshot.
    latest = select(CheckupSession.id, CheckupSession.title, CheckupSession.checkup_date).order_by(
        CheckupSession.checkup_date.desc(), CheckupSession.id
    ).limit(1).cte("latest_session")
    counts = select(
        func.count(Student.id).label("total_students"),
        func.coalesce(func.sum(case((CheckupResult.status.in_(["completed", "follow_up"]), 1), else_=0)), 0).label("checkups_completed"),
        func.coalesce(func.sum(case((CheckupResult.status == "follow_up", 1), else_=0)), 0).label("followups_pending"),
    ).select_from(Student).outerjoin(CheckupResult, and_(
        CheckupResult.student_id == Student.id,
        CheckupResult.session_id == select(latest.c.id).scalar_subquery(),
    )).subquery("school_counts")
    query = select(counts, latest.c.title, latest.c.checkup_date).select_from(counts).outerjoin(latest, true())
    try:
        row = db.execute(query).mappings().one()
    except SQLAlchemyError:
        raise HTTPException(503, "Chưa tải được thống kê nhà trường. Vui lòng thử lại.") from None
    return DashboardSnapshot(
        aggregates=Aggregates(**{key: row[key] for key in Aggregates.model_fields}),
        session_title=row["title"], session_date=row["checkup_date"],
    )
