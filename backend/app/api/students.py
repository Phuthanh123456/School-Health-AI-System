from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.api.guards import require_role
from app.database import get_db
from app.models.student import (
    HealthProfile, Student, accounts, checkup_results, parent_students, student_nurses,
)
from app.schemas.student import StudentCreate, StudentProfile, StudentSummary, StudentUpdate


router = APIRouter(
    prefix="/students", tags=["students"], dependencies=[Depends(require_role("nurse"))]
)

parent_id_query = (
    select(func.min(parent_students.c.parent_id))
    .where(parent_students.c.student_id == Student.id)
    .correlate(Student).scalar_subquery().label("parentid")
)
nurse_id_query = (
    select(student_nurses.c.nurse_id).where(student_nurses.c.student_id == Student.id)
    .correlate(Student).scalar_subquery().label("nurseid")
)


def validate_account(db: Session, account_id: str, role: str) -> None:
    if db.scalar(select(accounts.c.id).where(
        accounts.c.id == account_id, accounts.c.role == role
    )) is None:
        raise HTTPException(status_code=422, detail=f"Account with role {role} does not exist")


def read_profile(db: Session, student_id: str) -> StudentProfile:
    row = db.execute(
        select(Student.id, Student.full_name, Student.class_name,
               HealthProfile.allergies, HealthProfile.medical_notes, parent_id_query, nurse_id_query)
        .outerjoin(HealthProfile, HealthProfile.student_id == Student.id)
        .where(Student.id == student_id)
    ).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return StudentProfile.model_validate(row)


@router.get("")
def list_students(
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    student_id: Annotated[str | None, Query(max_length=50)] = None,
) -> list[StudentSummary]:
    query = select(
        Student.id, Student.full_name, Student.class_name, parent_id_query, nurse_id_query
    )
    term = (q or student_id or "").strip()
    if term:
        query = query.where(or_(
            Student.id.icontains(term, autoescape=True),
            Student.full_name.icontains(term, autoescape=True),
            Student.class_name.icontains(term, autoescape=True),
        ))
    rows = db.execute(query.order_by(Student.id).limit(200)).mappings()
    return [StudentSummary.model_validate(row) for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_student(
    student: StudentCreate, db: Annotated[Session, Depends(get_db)]
) -> StudentProfile:
    with db.begin():
        validate_account(db, student.parentid, "parent")
        validate_account(db, student.nurseid, "nurse")
        new_id = db.scalar(
            insert(Student)
            .values(id=student.id, full_name=student.full_name, class_name=student.class_name)
            .on_conflict_do_nothing(index_elements=[Student.id])
            .returning(Student.id)
        )
        if new_id is None:
            raise HTTPException(status_code=409, detail="Student ID already exists")
        db.add(HealthProfile(
            student_id=new_id,
            allergies=student.allergies or None,
            medical_notes=student.medical_notes or None,
        ))
        db.execute(insert(parent_students).values(parent_id=student.parentid, student_id=new_id))
        db.execute(insert(student_nurses).values(student_id=new_id, nurse_id=student.nurseid))
        db.flush()
        return read_profile(db, new_id)


@router.get("/{student_id}")
def get_student(student_id: str, db: Annotated[Session, Depends(get_db)]) -> StudentProfile:
    return read_profile(db, student_id)


@router.patch("/{student_id}")
def update_student(
    student_id: str, update: StudentUpdate, db: Annotated[Session, Depends(get_db)]
) -> StudentProfile:
    changes = update.model_dump(exclude_unset=True)
    with db.begin():
        student = db.get(Student, student_id, with_for_update=True)
        if student is None:
            raise HTTPException(status_code=404, detail="Student not found")
        if "parentid" in changes:
            parentid = changes.pop("parentid")
            validate_account(db, parentid, "parent")
            db.execute(delete(parent_students).where(parent_students.c.student_id == student_id))
            db.execute(insert(parent_students).values(parent_id=parentid, student_id=student_id))
        if "nurseid" in changes:
            nurseid = changes.pop("nurseid")
            validate_account(db, nurseid, "nurse")
            db.execute(insert(student_nurses).values(
                student_id=student_id, nurse_id=nurseid
            ).on_conflict_do_update(
                index_elements=["student_id"], set_={"nurse_id": nurseid}
            ))
        for field in ("full_name", "class_name"):
            if field in changes:
                setattr(student, field, changes.pop(field))
        if changes:
            health_changes = {field: value or None for field, value in changes.items()}
            db.execute(insert(HealthProfile).values(
                student_id=student_id, **health_changes
            ).on_conflict_do_update(
                index_elements=[HealthProfile.student_id], set_=health_changes
            ))
        db.flush()
        return read_profile(db, student_id)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: str, db: Annotated[Session, Depends(get_db)]) -> Response:
    with db.begin():
        student = db.get(Student, student_id, with_for_update=True)
        if student is None:
            raise HTTPException(status_code=404, detail="Student not found")
        db.execute(delete(checkup_results).where(checkup_results.c.student_id == student_id))
        db.execute(delete(parent_students).where(parent_students.c.student_id == student_id))
        db.execute(delete(student_nurses).where(student_nurses.c.student_id == student_id))
        db.execute(delete(HealthProfile).where(HealthProfile.student_id == student_id))
        db.delete(student)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
