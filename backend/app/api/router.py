"""Top-level API router."""

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.checkups import router as checkups_router
from app.api.students import router as students_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(checkups_router)
api_router.include_router(students_router)


@api_router.get("/", tags=["system"], summary="API welcome")
def root() -> dict[str, str]:
    return {"message": "Welcome to SchoolHealth API"}


@api_router.get("/health", tags=["system"], summary="Health check")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "message": "SchoolHealth backend is running"}
