import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.schemas.insights import Aggregates, InsightResponse
from app.services.insights import generate_insights

router = APIRouter(prefix="/api/admin", tags=["admin insights"])
bearer = HTTPBearer(auto_error=False)


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    # Temporary fail-closed gate until the shared authentication story supplies RBAC.
    if not settings.insights_admin_token:
        raise HTTPException(503, "Quyền truy cập AI chưa được cấu hình.")
    if not credentials or not secrets.compare_digest(credentials.credentials.encode(), settings.insights_admin_token.encode()):
        raise HTTPException(403, "Cần quyền quản trị để tạo nhận xét AI.")


@router.post("/ai-insights", response_model=InsightResponse, dependencies=[Depends(require_admin)])
async def ai_insights(stats: Aggregates):
    return await generate_insights(stats)
