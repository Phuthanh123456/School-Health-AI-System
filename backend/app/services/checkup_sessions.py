"""Queries for the read-only nurse checkup session selector."""

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.checkup_session import CheckupSession
from app.schemas.checkup_session import (
    CheckupSessionDetail,
    CheckupSessionSummary,
    StudentSummary,
)


_SESSION_ROLLUPS = text(
    """
    SELECT
        cr.session_id,
        STRING_AGG(DISTINCT s.class_name, ', ' ORDER BY s.class_name) AS class_name,
        COUNT(*) AS participant_count
    FROM schoolhealth_demo.checkup_results AS cr
    JOIN schoolhealth_demo.students AS s ON s.id = cr.student_id
    GROUP BY cr.session_id
    """
)

_SESSION_STUDENTS = text(
    """
    SELECT s.id, s.full_name, s.class_name
    FROM schoolhealth_demo.checkup_results AS cr
    JOIN schoolhealth_demo.students AS s ON s.id = cr.student_id
    WHERE cr.session_id = :session_id
    ORDER BY s.full_name, s.id
    """
)


def list_checkup_sessions(db: Session) -> list[CheckupSessionSummary]:
    """Return sessions newest first, including an empty session if one exists."""
    sessions = db.scalars(
        select(CheckupSession).order_by(
            CheckupSession.checkup_date.desc(), CheckupSession.id
        )
    ).all()
    rollups = {
        row.session_id: (row.class_name, row.participant_count)
        for row in db.execute(_SESSION_ROLLUPS)
    }
    return [
        CheckupSessionSummary(
            id=session.id,
            title=session.title,
            checkup_date=session.checkup_date,
            class_name=rollups.get(session.id, (None, 0))[0],
            participant_count=rollups.get(session.id, (None, 0))[1],
        )
        for session in sessions
    ]


def get_checkup_session(db: Session, session_id: str) -> CheckupSessionDetail | None:
    """Return one session and its roster, or ``None`` when the ID is unknown."""
    session = db.get(CheckupSession, session_id)
    if session is None:
        return None

    students = [
        StudentSummary.model_validate(row)
        for row in db.execute(
            _SESSION_STUDENTS, {"session_id": session.id}
        ).mappings()
    ]
    class_names = sorted({student.class_name for student in students})

    return CheckupSessionDetail(
        id=session.id,
        title=session.title,
        checkup_date=session.checkup_date,
        class_name=", ".join(class_names) if class_names else None,
        participant_count=len(students),
        students=students,
    )
