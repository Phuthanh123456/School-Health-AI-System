"""Admin-only school-wide health overview."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.guards import require_role
from app.database import get_db
from app.services.dashboard import read_dashboard_snapshot
from app.schemas.dashboard import CheckupStatusCounts, SchoolHealthOverview

router = APIRouter(prefix="/api/admin", tags=["admin dashboard"], dependencies=[Depends(require_role("admin"))])


@router.get("/dashboard", response_model=SchoolHealthOverview, summary="Read school-wide health aggregates")
def school_health_overview(
    db: Annotated[Session, Depends(get_db)],
) -> SchoolHealthOverview:
    """Return distinct student totals and saved result counts by nurse-selected status."""
    counts = read_dashboard_snapshot(db).aggregates
    return SchoolHealthOverview(
        total_students=counts.total_students,
        completed_checkups=counts.checkups_completed,
        status_counts=CheckupStatusCounts(
            normal=counts.checkups_completed - counts.followups_pending,
            needs_follow_up=counts.followups_pending,
        ),
    )
