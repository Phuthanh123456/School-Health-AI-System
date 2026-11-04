"""Import Zen's fictional CSVs into the single shared application schema.

Existing profiles, results, passwords and Admin assignment changes are preserved.
"""

import csv
import os
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert

from app.database import Base, engine
from app.models.checkup import Account, CheckupResult, CheckupSession
from app.models.management import AssignmentAudit, student_nurses
from app.models.student import HealthProfile, Student, parent_students


def read_csv(folder: Path, name: str) -> list[dict]:
    with (folder / f"{name}.csv").open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def seed(folder: Path, password: str) -> None:
    if engine is None:
        raise ValueError("Configure the PostgreSQL connection before seeding")
    if not 8 <= len(password.encode("utf-8")) <= 72:
        raise ValueError("Demo password must contain 8–72 UTF-8 bytes")
    students = read_csv(folder, "students")
    accounts = read_csv(folder, "accounts")
    sessions = read_csv(folder, "checkup_sessions")
    results = read_csv(folder, "checkup_results")
    for rows in (students, accounts, sessions):
        ids = [row["id"] for row in rows]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate CSV identifiers")
    by_account = {row["id"]: row for row in accounts}
    student_ids = {row["id"] for row in students}
    session_ids = {row["id"] for row in sessions}
    if any(row["role"] not in {"admin", "parent", "nurse"} for row in accounts):
        raise ValueError("Unsupported account role")
    for student in students:
        if not student["id"].isascii() or not student["id"].isalnum():
            raise ValueError("Invalid student ID")
        if not student["full_name"].strip() or not student["class_name"].strip():
            raise ValueError("Student name and class are required")
        for field, role in (("parentid", "parent"), ("nurseid", "nurse")):
            if by_account.get(student[field], {}).get("role") != role:
                raise ValueError("Invalid CSV account relationship")
    for session in sessions:
        session["checkup_date"] = date.fromisoformat(session["checkup_date"])
    pairs = set()
    for result in results:
        pair = (result["session_id"], result["student_id"])
        if pair in pairs or pair[0] not in session_ids or pair[1] not in student_ids:
            raise ValueError("Invalid or duplicate checkup relationship")
        pairs.add(pair)
        if result["status"] not in {"completed", "follow_up", "pending", "absent"}:
            raise ValueError("Unsupported result status")
        for field, maximum in (("height_cm", Decimal("9999.9")), ("weight_kg", Decimal("999.9"))):
            value = Decimal(result[field]) if result[field] else None
            if value is not None and (not value.is_finite() or not 0 < value <= maximum or value != value.quantize(Decimal("0.1"))):
                raise ValueError("Invalid checkup measurement")
            result[field] = value
        if result["status"] in {"completed", "follow_up"} and (result["height_cm"] is None or result["weight_kg"] is None):
            raise ValueError("Saved results require measurements")
        result["notes"] = result["notes"] or None

    with engine.begin() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS schoolhealth_demo"))
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public"))
        Base.metadata.create_all(connection)
        for table in (Student.__table__, CheckupResult.__table__, AssignmentAudit.__table__, parent_students, student_nurses):
            for index in table.indexes:
                index.create(connection, checkfirst=True)
        # Keep established demo logins working alongside the dedicated CSV accounts.
        known_ids = {row["id"] for row in accounts}
        for role in ("admin", "nurse", "parent"):
            if role not in known_ids:
                accounts.append(dict(id=role, email=f"{role}@schoolhealth.example", role=role))
        for row in accounts:
            connection.execute(insert(Account).values(
                **row, password_hash=func.public.crypt(password, func.public.gen_salt("bf", 10))
            ).on_conflict_do_nothing(index_elements=["id"]))
        for student in students:
            created = connection.scalar(insert(Student).values(
                id=student["id"], full_name=student["full_name"], class_name=student["class_name"]
            ).on_conflict_do_nothing(index_elements=["id"]).returning(Student.id))
            connection.execute(insert(HealthProfile).values(
                student_id=student["id"], allergies=student["allergies"] or None,
                medical_notes=student["medical_notes"] or None,
            ).on_conflict_do_nothing(index_elements=["student_id"]))
            for kind, table, key, value in (
                ("parent", parent_students, "parent_id", student["parentid"]),
                ("nurse", student_nurses, "nurse_id", student["nurseid"]),
            ):
                edited = connection.scalar(select(AssignmentAudit.id).where(
                    AssignmentAudit.student_id == student["id"], AssignmentAudit.kind == kind
                ).limit(1))
                existing = list(connection.scalars(select(table.c[key]).where(table.c.student_id == student["id"])))
                if edited is None and (not existing or (kind == "parent" and existing == ["parent"])):
                    connection.execute(insert(table).values(student_id=student["id"], **{key: value}).on_conflict_do_nothing())
            if created and student["id"] in {"DEMO001", "DEMO017"}:
                connection.execute(insert(parent_students).values(parent_id="parent", student_id=student["id"]).on_conflict_do_nothing())
        for session in sessions:
            connection.execute(insert(CheckupSession).values(**session).on_conflict_do_nothing())
        for result in results:
            connection.execute(insert(CheckupResult).values(**result).on_conflict_do_nothing())


if __name__ == "__main__":
    seed(Path(__file__).resolve().parent.parent / "data", os.environ.get("SCHOOLHEALTH_DEMO_PASSWORD", ""))
    print("Fictional CSV demo imported; existing edits and assignment removals preserved.")
