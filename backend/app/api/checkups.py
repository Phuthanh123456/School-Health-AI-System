from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.guards import require_role
from app.database import get_db
from app.models.student import CheckupResult, CheckupSession, HealthProfile, Student
from app.schemas.student import (
    CheckupResultInput,
    CheckupRosterItem,
    CheckupSessionSummary,
)


router = APIRouter(
    prefix="/checkup-sessions",
    tags=["checkups"],
    dependencies=[Depends(require_role("nurse"))],
)


def result_payload(row: CheckupResult) -> CheckupRosterItem:
    height = float(row.height_cm) if row.height_cm is not None else None
    weight = float(row.weight_kg) if row.weight_kg is not None else None
    bmi = round(weight / ((height / 100) ** 2), 1) if height and weight else None
    student = row.student
    return CheckupRosterItem(
        id=student.id,
        full_name=student.full_name,
        class_name=student.class_name,
        allergies=student.health_profile.allergies if student.health_profile else None,
        medical_notes=student.health_profile.medical_notes if student.health_profile else None,
        status=row.status,
        height_cm=height,
        weight_kg=weight,
        bmi=bmi,
        vision_left=row.vision_left,
        vision_right=row.vision_right,
        notes=row.notes,
    )


@router.get("")
def list_checkup_sessions(
    db: Annotated[Session, Depends(get_db)],
) -> list[CheckupSessionSummary]:
    sessions = db.scalars(
        select(CheckupSession).order_by(CheckupSession.checkup_date.desc(), CheckupSession.id)
    )
    return [CheckupSessionSummary.model_validate(session) for session in sessions]


@router.get("/{session_id}/results")
def list_session_results(
    session_id: str,
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> list[CheckupRosterItem]:
    if db.get(CheckupSession, session_id) is None:
        raise HTTPException(status_code=404, detail="Checkup session not found")

    query = (
        select(Student, HealthProfile, CheckupResult)
        .outerjoin(HealthProfile, HealthProfile.student_id == Student.id)
        .outerjoin(
            CheckupResult,
            (CheckupResult.student_id == Student.id)
            & (CheckupResult.session_id == session_id),
        )
    )
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(Student.id.ilike(term), Student.full_name.ilike(term), Student.class_name.ilike(term))
        )
    rows = db.execute(query.order_by(Student.id).limit(200)).all()
    results = []
    for student, profile, result in rows:
        if result is None:
            results.append(
                CheckupRosterItem(
                    id=student.id,
                    full_name=student.full_name,
                    class_name=student.class_name,
                    allergies=profile.allergies if profile else None,
                    medical_notes=profile.medical_notes if profile else None,
                    status="pending",
                )
            )
        else:
            results.append(result_payload(result))
    return results


@router.put("/{session_id}/results/{student_id}")
def upsert_checkup_result(
    session_id: str,
    student_id: str,
    values: CheckupResultInput,
    db: Annotated[Session, Depends(get_db)],
) -> CheckupRosterItem:
    with db.begin():
        if db.get(CheckupSession, session_id) is None:
            raise HTTPException(status_code=404, detail="Checkup session not found")
        student = db.get(Student, student_id)
        if student is None:
            raise HTTPException(status_code=404, detail="Student not found")
        result = db.get(CheckupResult, (session_id, student_id), with_for_update=True)
        if result is None:
            result = CheckupResult(session_id=session_id, student_id=student_id)
            db.add(result)
        for field, value in values.model_dump().items():
            setattr(result, field, value or None if field in {"vision_left", "vision_right", "notes"} else value)
        db.flush()
        db.refresh(result)
        return result_payload(result)


@router.delete(
    "/{session_id}/results/{student_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_checkup_result(
    session_id: str,
    student_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    with db.begin():
        if db.get(CheckupSession, session_id) is None:
            raise HTTPException(status_code=404, detail="Checkup session not found")
        result = db.get(CheckupResult, (session_id, student_id), with_for_update=True)
        if result is None:
            raise HTTPException(status_code=404, detail="Checkup result not found")
        db.delete(result)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
