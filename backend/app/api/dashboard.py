"""Admin-only school-wide health overview."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.guards import AuthenticatedUser, require_role
from app.database import get_db
from app.models.checkup import CheckupResult
from app.models.student import Student
from app.schemas.dashboard import CheckupStatusCounts, SchoolHealthOverview

router = APIRouter(prefix="/api/admin", tags=["admin dashboard"])

_NORMAL_STATUSES = frozenset({"completed", "Normal"})
_FOLLOW_UP_STATUSES = frozenset({"follow_up", "Needs Follow-up"})


@router.get("/dashboard", response_model=SchoolHealthOverview, summary="Read school-wide health aggregates")
def school_health_overview(
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[AuthenticatedUser, Depends(require_role("admin"))],
) -> SchoolHealthOverview:
    """Return distinct student totals and saved result counts by nurse-selected status."""
    total_students = db.scalar(select(func.count(func.distinct(Student.id)))) or 0

    # CheckupResult has a composite (session_id, student_id) primary key, so
    # each saved student/session result contributes exactly one record.
    result_rows = db.execute(
        select(CheckupResult.status, func.count())
        .group_by(CheckupResult.status)
    ).all()
    status_counts = {status: count for status, count in result_rows}
    normal = sum(status_counts.get(status, 0) for status in _NORMAL_STATUSES)
    needs_follow_up = sum(status_counts.get(status, 0) for status in _FOLLOW_UP_STATUSES)

    return SchoolHealthOverview(
        total_students=total_students,
        completed_checkups=normal + needs_follow_up,
        status_counts=CheckupStatusCounts(
            normal=normal,
            needs_follow_up=needs_follow_up,
        ),
    )
