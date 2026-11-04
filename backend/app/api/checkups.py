from decimal import Decimal, ROUND_HALF_UP
from typing import TypedDict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import require_nurse
from app.database import get_db
from app.models.checkup import CheckupResult, CheckupSession, Student
from app.schemas.checkup import ResultRead, ResultWrite, SessionDetailRead, SessionRead, StudentRead

router = APIRouter(prefix="/checkups", tags=["checkups"])
UI_TO_DB_STATUS = {"Normal": "completed", "Needs Follow-up": "follow_up"}
DB_TO_UI_STATUS = {value: key for key, value in UI_TO_DB_STATUS.items()}


class _SessionAggregate(TypedDict):
    session: CheckupSession
    class_names: set[str]
    participant_count: int


def calculate_bmi(height_cm: Decimal | float, weight_kg: Decimal | float) -> Decimal:
    """Return BMI from centimeters and kilograms without early rounding."""
    height_m = Decimal(str(height_cm)) / Decimal("100")
    weight = Decimal(str(weight_kg))
    return weight / (height_m * height_m)


def _result_read(result: CheckupResult) -> ResultRead:
    height = float(result.height_cm)
    weight = float(result.weight_kg)
    # Historical rows may contain BMI calculated before the DB rounded measurements.
    # Always derive the public BMI from the actual stored measurements.
    bmi = float(calculate_bmi(result.height_cm, result.weight_kg).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))
    return ResultRead(
        session_id=result.session_id,
        student_id=result.student_id,
        height_cm=height,
        weight_kg=weight,
        bmi=bmi,
        vision=result.vision,
        notes=result.notes,
        status=DB_TO_UI_STATUS[result.status],
        created_at=result.created_at,
        updated_at=result.updated_at,
    )


def _require_participation(db: Session, session_id: str, student_id: str) -> CheckupResult:
    session_exists = db.get(CheckupSession, session_id)
    if session_exists is None:
        raise HTTPException(status_code=404, detail="Checkup session not found.")
    student_exists = db.get(Student, student_id)
    if student_exists is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    participation = db.get(CheckupResult, (session_id, student_id))
    if participation is None:
        raise HTTPException(status_code=404, detail="Student does not participate in this session.")
    return participation


@router.get("/sessions", response_model=list[SessionRead])
def list_sessions(
    db: Session = Depends(get_db),
    _nurse: str = Depends(require_nurse),
) -> list[SessionRead]:
    rows = db.execute(
        select(CheckupSession, Student.class_name, func.count(CheckupResult.student_id))
        .outerjoin(CheckupResult, CheckupResult.session_id == CheckupSession.id)
        .outerjoin(Student, Student.id == CheckupResult.student_id)
        .group_by(CheckupSession.id, Student.class_name)
        .order_by(CheckupSession.checkup_date.desc(), CheckupSession.id, Student.class_name)
    ).all()
    grouped: dict[str, _SessionAggregate] = {}
    for session, class_name, participant_count in rows:
        item = grouped.setdefault(
            session.id,
            {
                "session": session,
                "class_names": set(),
                "participant_count": 0,
            },
        )
        if class_name is not None:
            item["class_names"].add(class_name)
            item["participant_count"] += participant_count
    return [
        SessionRead(
            id=item["session"].id,
            title=item["session"].title,
            checkup_date=item["session"].checkup_date,
            class_name=", ".join(sorted(item["class_names"])) or None,
            participant_count=item["participant_count"],
        )
        for item in grouped.values()
    ]


@router.get("/sessions/{session_id}", response_model=SessionDetailRead)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    _nurse: str = Depends(require_nurse),
) -> SessionDetailRead:
    session = db.get(CheckupSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Checkup session not found.")
    students = _list_participants(db, session_id)
    class_names = sorted({student.class_name for student in students})
    return SessionDetailRead(
        id=session.id,
        title=session.title,
        checkup_date=session.checkup_date,
        class_name=", ".join(class_names) or None,
        participant_count=len(students),
        students=students,
    )


@router.get("/sessions/{session_id}/students", response_model=list[StudentRead])
def search_participants(
    session_id: str,
    q: str = Query(default="", max_length=100),
    db: Session = Depends(get_db),
    _nurse: str = Depends(require_nurse),
) -> list[StudentRead]:
    return _list_participants(db, session_id, q)


def _list_participants(db: Session, session_id: str, q: str = "") -> list[StudentRead]:
    if db.get(CheckupSession, session_id) is None:
        raise HTTPException(status_code=404, detail="Checkup session not found.")
    statement = (
        select(Student)
        .join(CheckupResult, CheckupResult.student_id == Student.id)
        .where(CheckupResult.session_id == session_id)
        .order_by(Student.full_name, Student.id)
    )
    if q.strip():
        term = q.strip()
        statement = statement.where(
            or_(Student.full_name.contains(term, autoescape=True), Student.id.contains(term, autoescape=True))
        )
    students = db.scalars(statement).unique().all()
    return [
        StudentRead(id=student.id, student_code=student.id, full_name=student.full_name, class_name=student.class_name)
        for student in students
    ]


@router.get("/sessions/{session_id}/students/{student_id}/result", response_model=ResultRead)
def get_result(
    session_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    _nurse: str = Depends(require_nurse),
) -> ResultRead:
    result = _require_participation(db, session_id, student_id)
    if result.height_cm is None or result.weight_kg is None or result.status not in DB_TO_UI_STATUS:
        raise HTTPException(status_code=404, detail="No checkup result has been saved for this student.")
    return _result_read(result)


@router.put(
    "/sessions/{session_id}/students/{student_id}/result",
    response_model=ResultRead,
    status_code=status.HTTP_200_OK,
)
def save_result(
    session_id: str,
    student_id: str,
    payload: ResultWrite,
    db: Session = Depends(get_db),
    _nurse: str = Depends(require_nurse),
) -> ResultRead:
    # Validate IDs and participation before mutating the existing row.
    result = _require_participation(db, session_id, student_id)
    height = payload.height_cm
    weight = payload.weight_kg
    bmi = calculate_bmi(height, weight).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    result.height_cm = height
    result.weight_kg = weight
    result.bmi = bmi
    result.vision = payload.vision
    result.notes = payload.notes
    result.status = UI_TO_DB_STATUS[payload.status]
    db.commit()
    db.refresh(result)
    return _result_read(result)
