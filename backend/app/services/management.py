"""Batch-load authorized health records without exposing account credentials."""

import hashlib
import json
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.checkup import Account, CheckupResult, CheckupSession
from app.models.management import student_nurses
from app.models.student import HealthProfile, Student, parent_students
from app.schemas.management import AccountReference, CheckupView, HealthRecord, ParentChild

SAVED_STATUSES = {"completed", "follow_up", "Normal", "Needs Follow-up"}
STATUS_LABELS = {"completed": "Normal", "follow_up": "Needs Follow-up", "pending": "Pending", "absent": "Absent"}


def assignment_version(parent_ids: list[str], nurse_id: str | None) -> str:
    values = json.dumps([sorted(parent_ids), nurse_id], separators=(",", ":"))
    return hashlib.sha256(values.encode()).hexdigest()


def checkup_view(result: CheckupResult, session: CheckupSession) -> CheckupView:
    bmi = None
    if result.height_cm and result.weight_kg and result.height_cm > 0 and result.weight_kg > 0:
        value = result.weight_kg / (result.height_cm / Decimal("100")) ** 2
        bmi = float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return CheckupView(
        session_id=session.id, title=session.title, checkup_date=session.checkup_date,
        status=STATUS_LABELS.get(result.status, result.status),
        height_cm=float(result.height_cm) if result.height_cm is not None else None,
        weight_kg=float(result.weight_kg) if result.weight_kg is not None else None,
        bmi=bmi, vision=result.vision, notes=result.notes, updated_at=result.updated_at,
    )


def load_records(db: Session, student_ids: list[str], *, history: bool = False) -> list[HealthRecord]:
    if not student_ids:
        return []
    rows = db.execute(
        select(Student, HealthProfile).outerjoin(HealthProfile, HealthProfile.student_id == Student.id)
        .where(Student.id.in_(student_ids))
    ).all()
    parents: dict[str, list[AccountReference]] = defaultdict(list)
    for student_id, account_id, email in db.execute(
        select(parent_students.c.student_id, Account.id, Account.email)
        .join(Account, Account.id == parent_students.c.parent_id)
        .where(parent_students.c.student_id.in_(student_ids), Account.role == "parent")
        .order_by(Account.id)
    ):
        parents[student_id].append(AccountReference(id=account_id, email=email))
    nurses = {
        student_id: AccountReference(id=account_id, email=email)
        for student_id, account_id, email in db.execute(
            select(student_nurses.c.student_id, Account.id, Account.email)
            .join(Account, Account.id == student_nurses.c.nurse_id)
            .where(student_nurses.c.student_id.in_(student_ids), Account.role == "nurse")
        )
    }
    # Rank in SQL so the Admin page loads at most one result per displayed student.
    from sqlalchemy import func
    ranked = select(
        CheckupResult.student_id.label("student_id"), CheckupResult.session_id.label("session_id"),
        func.row_number().over(partition_by=CheckupResult.student_id, order_by=(
            CheckupSession.checkup_date.desc(), CheckupResult.updated_at.desc(), CheckupResult.session_id.desc()
        )).label("rank"),
    ).join(CheckupSession, CheckupSession.id == CheckupResult.session_id).where(
        CheckupResult.student_id.in_(student_ids), CheckupResult.status.in_(SAVED_STATUSES),
        CheckupResult.height_cm > 0, CheckupResult.weight_kg > 0,
    ).subquery()
    latest = {}
    for result, session in db.execute(
        select(CheckupResult, CheckupSession)
        .join(CheckupSession, CheckupSession.id == CheckupResult.session_id)
        .join(ranked, (ranked.c.student_id == CheckupResult.student_id) &
              (ranked.c.session_id == CheckupResult.session_id))
        .where(ranked.c.rank == 1)
    ):
        latest[result.student_id] = checkup_view(result, session)
    histories: dict[str, list[CheckupView]] = defaultdict(list)
    if history:
        for result, session in db.execute(
            select(CheckupResult, CheckupSession)
            .join(CheckupSession, CheckupSession.id == CheckupResult.session_id)
            .where(CheckupResult.student_id.in_(student_ids))
            .order_by(CheckupSession.checkup_date.desc(), CheckupResult.updated_at.desc(), CheckupResult.session_id)
        ):
            histories[result.student_id].append(checkup_view(result, session))
    records = {}
    for student, profile in rows:
        parent_refs = parents[student.id]
        nurse = nurses.get(student.id)
        values = dict(
            id=student.id, full_name=student.full_name, class_name=student.class_name,
            allergies=profile.allergies if profile else None,
            medical_notes=profile.medical_notes if profile else None,
            parents=parent_refs, nurse=nurse, latest_checkup=latest.get(student.id),
            assignment_version=assignment_version([p.id for p in parent_refs], nurse.id if nurse else None),
        )
        records[student.id] = ParentChild(**values, checkups=histories[student.id]) if history else HealthRecord(**values)
    return [records[student_id] for student_id in student_ids if student_id in records]
