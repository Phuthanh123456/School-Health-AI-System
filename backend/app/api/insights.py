from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.guards import require_role
from app.database import get_db
from app.schemas.insights import Aggregates, DashboardSnapshot, InsightResponse
from app.services.dashboard import read_dashboard_snapshot
from app.services.insights import generate_insights

router = APIRouter(prefix="/api/admin", tags=["admin insights"], dependencies=[Depends(require_role("admin"))])


def current_snapshot(db: Session = Depends(get_db)) -> DashboardSnapshot:
    return read_dashboard_snapshot(db)


@router.get("/dashboard-statistics", response_model=DashboardSnapshot)
def dashboard_statistics(response: Response, snapshot: DashboardSnapshot = Depends(current_snapshot)):
    response.headers["Cache-Control"] = "no-store"
    return snapshot


@router.post("/ai-insights", response_model=InsightResponse)
async def ai_insights(stats: Aggregates, response: Response, snapshot: DashboardSnapshot = Depends(current_snapshot)):
    if stats != snapshot.aggregates:
        raise HTTPException(409, "The dashboard statistics have changed. Refresh the dashboard before generating insights.")
    response.headers["Cache-Control"] = "no-store"
    return await generate_insights(snapshot.aggregates)
