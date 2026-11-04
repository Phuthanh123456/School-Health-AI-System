from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.student import HealthProfile, Student
from app.schemas.student import StudentCreate, StudentProfile, StudentSummary, StudentUpdate


router = APIRouter(prefix="/students", tags=["students"])


def read_profile(db: Session, student_id: str) -> StudentProfile:
    row = db.execute(
        select(Student.id, Student.full_name, Student.class_name,
               HealthProfile.allergies, HealthProfile.medical_notes)
        .outerjoin(HealthProfile, HealthProfile.student_id == Student.id)
        .where(Student.id == student_id)
    ).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return StudentProfile.model_validate(row)


@router.get("")
def list_students(db: Annotated[Session, Depends(get_db)]) -> list[StudentSummary]:
    students = db.scalars(select(Student).order_by(Student.id))
    return [StudentSummary.model_validate(student) for student in students]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_student(
    student: StudentCreate, db: Annotated[Session, Depends(get_db)]
) -> StudentProfile:
    profile = StudentProfile(
        **student.model_dump(exclude={"allergies", "medical_notes"}),
        allergies=student.allergies or None,
        medical_notes=student.medical_notes or None,
    )
    with db.begin():
        new_id = db.scalar(
            insert(Student)
            .values(id=profile.id, full_name=profile.full_name, class_name=profile.class_name)
            .on_conflict_do_nothing(index_elements=[Student.id])
            .returning(Student.id)
        )
        if new_id is None:
            raise HTTPException(status_code=409, detail="Student ID already exists")
        db.add(
            HealthProfile(
                student_id=new_id,
                allergies=profile.allergies,
                medical_notes=profile.medical_notes,
            )
        )
    return profile


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

        for field in ("full_name", "class_name"):
            if field in changes:
                setattr(student, field, changes.pop(field))
        if changes:
            health_changes = {field: value or None for field, value in changes.items()}
            db.execute(
                insert(HealthProfile)
                .values(student_id=student_id, **health_changes)
                .on_conflict_do_update(
                    index_elements=[HealthProfile.student_id], set_=health_changes
                )
            )
        db.flush()
        return read_profile(db, student_id)
