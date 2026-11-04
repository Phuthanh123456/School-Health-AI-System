"""Top-level API router."""

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.checkups import router as checkups_router
from app.api.dashboard import router as dashboard_router
from app.api.insights import router as insights_router
from app.api.management import router as management_router
from app.api.students import router as students_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(students_router)
api_router.include_router(checkups_router)
api_router.include_router(dashboard_router)
api_router.include_router(insights_router)
api_router.include_router(management_router)


@api_router.get("/", tags=["system"], summary="API welcome")
def root() -> dict[str, str]:
    return {"message": "Welcome to SchoolHealth API"}


@api_router.get("/health", tags=["system"], summary="Health check")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "message": "SchoolHealth backend is running"}
