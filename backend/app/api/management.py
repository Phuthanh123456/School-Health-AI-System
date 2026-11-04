"""SCRUM-51/52: Parent ownership and Admin record/assignment management."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import delete, exists, func, insert, select
from sqlalchemy.orm import Session

from app.api.guards import AuthenticatedUser, require_role
from app.database import get_db
from app.models.checkup import Account
from app.models.management import AssignmentAudit, student_nurses
from app.models.student import Student, parent_students
from app.schemas.management import (
    AccountReference, AssignmentWrite, ClassOption, HealthRecord, ManagementOptions,
    ParentChild, ParentOverview, ParentProfile, RecordPage,
)
from app.services.management import assignment_version, load_records

router = APIRouter(prefix="/api", tags=["parent and admin management"])
DB = Annotated[Session, Depends(get_db)]


def database_actor(role: str):
    def actor(db: DB, user: Annotated[AuthenticatedUser, Depends(require_role(role))]):
        account = db.execute(select(Account.id, Account.email).where(Account.id == user.id, Account.role == role)).first()
        if account is None:
            raise HTTPException(401, "Account is unavailable. Please sign in again.")
        return AccountReference(id=account.id, email=account.email)
    return actor


Admin = Annotated[AccountReference, Depends(database_actor("admin"))]
Parent = Annotated[AccountReference, Depends(database_actor("parent"))]


@router.get("/parent/dashboard", response_model=ParentOverview)
def parent_dashboard(db: DB, parent: Parent):
    # Shared row locks keep ownership stable while this response is assembled.
    student_ids = list(db.scalars(
        select(Student.id).join(parent_students, parent_students.c.student_id == Student.id)
        .where(parent_students.c.parent_id == parent.id).order_by(Student.full_name, Student.id)
        .with_for_update(read=True, of=Student)
    ))
    # If an Admin held the row lock first, the join's initial snapshot may
    # predate its link change. Recheck ownership after obtaining the locks.
    if student_ids:
        still_owned = set(db.scalars(select(parent_students.c.student_id).where(
            parent_students.c.parent_id == parent.id, parent_students.c.student_id.in_(student_ids)
        )))
        student_ids = [student_id for student_id in student_ids if student_id in still_owned]
    return ParentOverview(
        parent=ParentProfile(**parent.model_dump()),
        children=load_records(db, student_ids, history=True),
    )


@router.get("/parent/children/{student_id}", response_model=ParentChild)
def parent_child(student_id: str, db: DB, parent: Parent):
    owned_id = db.scalar(
        select(Student.id).join(parent_students, parent_students.c.student_id == Student.id)
        .where(Student.id == student_id, parent_students.c.parent_id == parent.id)
        .with_for_update(read=True, of=Student)
    )
    still_owned = owned_id is not None and db.scalar(select(parent_students.c.student_id).where(
        parent_students.c.parent_id == parent.id, parent_students.c.student_id == owned_id
    )) is not None
    if not still_owned:
        raise HTTPException(404, "Linked child not found.")
    return load_records(db, [owned_id], history=True)[0]


@router.get("/admin/health-records/options", response_model=ManagementOptions)
def management_options(db: DB, admin: Admin):
    account_rows = db.execute(select(Account.id, Account.email, Account.role).where(
        Account.role.in_(["parent", "nurse"])
    ).order_by(Account.id)).all()
    return ManagementOptions(
        classes=[ClassOption(id=name, name=name) for name in db.scalars(
            select(Student.class_name).distinct().order_by(Student.class_name)
        )],
        parents=[AccountReference(id=row.id, email=row.email) for row in account_rows if row.role == "parent"],
        nurses=[AccountReference(id=row.id, email=row.email) for row in account_rows if row.role == "nurse"],
    )


@router.get("/admin/health-records", response_model=RecordPage)
def health_records(
    db: DB, admin: Admin,
    class_id: Annotated[str | None, Query(alias="classId", max_length=100)] = None,
    parent_id: Annotated[str | None, Query(alias="parentId", max_length=100)] = None,
    nurse_id: Annotated[str | None, Query(alias="nurseId", max_length=100)] = None,
    page: Annotated[int, Query(ge=1, le=1_000_000)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
):
    query = select(Student.id)
    if class_id:
        query = query.where(Student.class_name == class_id)
    if parent_id:
        query = query.where(exists(select(1).where(
            parent_students.c.student_id == Student.id, parent_students.c.parent_id == parent_id
        )))
    if nurse_id:
        query = query.where(exists(select(1).where(
            student_nurses.c.student_id == Student.id, student_nurses.c.nurse_id == nurse_id
        )))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    ids = list(db.scalars(query.order_by(Student.full_name, Student.id).offset((page - 1) * page_size).limit(page_size)))
    return RecordPage(items=load_records(db, ids), total=total, page=page, page_size=page_size)


def change_assignment(db: Session, admin: AccountReference, student_id: str, kind: str,
                      new_id: str | None, expected: str | None) -> HealthRecord:
    try:
        if expected is None:
            raise HTTPException(428, "Reload the record before changing its assignment.")
        if db.scalar(select(Student.id).where(Student.id == student_id).with_for_update()) is None:
            raise HTTPException(404, "Student not found.")
        parents = sorted(db.scalars(select(parent_students.c.parent_id).where(parent_students.c.student_id == student_id)))
        nurse = db.scalar(select(student_nurses.c.nurse_id).where(student_nurses.c.student_id == student_id))
        if expected.strip('"') != assignment_version(parents, nurse):
            raise HTTPException(409, "This assignment changed. Refresh the table before trying again.")
        if new_id is not None and db.scalar(select(Account.id).where(Account.id == new_id, Account.role == kind)) is None:
            raise HTTPException(422, f"Choose an existing {kind} account.")
        old_ids = parents if kind == "parent" else ([nurse] if nurse else [])
        new_ids = [new_id] if new_id else []
        if old_ids != new_ids:
            table = parent_students if kind == "parent" else student_nurses
            db.execute(delete(table).where(table.c.student_id == student_id))
            if new_id:
                field = "parent_id" if kind == "parent" else "nurse_id"
                db.execute(insert(table).values(student_id=student_id, **{field: new_id}))
            db.add(AssignmentAudit(actor_id=admin.id, student_id=student_id, kind=kind, old_ids=old_ids, new_ids=new_ids))
            db.flush()
        record = load_records(db, [student_id])[0]
        db.commit()
        return record
    except Exception:
        db.rollback()
        raise


Match = Annotated[str | None, Header(alias="If-Match", max_length=128)]


@router.put("/admin/students/{student_id}/parent", response_model=HealthRecord)
def assign_parent(student_id: str, payload: AssignmentWrite, db: DB, admin: Admin, if_match: Match = None):
    return change_assignment(db, admin, student_id, "parent", payload.account_id, if_match)


@router.delete("/admin/students/{student_id}/parent", response_model=HealthRecord)
def remove_parent(student_id: str, db: DB, admin: Admin, if_match: Match = None):
    return change_assignment(db, admin, student_id, "parent", None, if_match)


@router.put("/admin/students/{student_id}/nurse", response_model=HealthRecord)
def assign_nurse(student_id: str, payload: AssignmentWrite, db: DB, admin: Admin, if_match: Match = None):
    return change_assignment(db, admin, student_id, "nurse", payload.account_id, if_match)


@router.delete("/admin/students/{student_id}/nurse", response_model=HealthRecord)
def remove_nurse(student_id: str, db: DB, admin: Admin, if_match: Match = None):
    return change_assignment(db, admin, student_id, "nurse", None, if_match)
