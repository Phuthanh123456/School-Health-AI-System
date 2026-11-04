"""Read-only endpoints for the nurse checkup session selector."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.checkup_session import CheckupSessionDetail, CheckupSessionSummary
from app.services.checkup_sessions import get_checkup_session, list_checkup_sessions


router = APIRouter(prefix="/api/checkup-sessions", tags=["checkup-sessions"])


@router.get(
    "",
    response_model=list[CheckupSessionSummary],
    summary="List checkup sessions",
    description="Returns predefined sessions with their class and participant count.",
)
def read_checkup_sessions(db: Session = Depends(get_db)) -> list[CheckupSessionSummary]:
    return list_checkup_sessions(db)


@router.get(
    "/{session_id}",
    response_model=CheckupSessionDetail,
    summary="Get a checkup session and its student roster",
)
def read_checkup_session(
    session_id: str,
    db: Session = Depends(get_db),
) -> CheckupSessionDetail:
    session = get_checkup_session(db, session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkup session not found",
        )
    return session
