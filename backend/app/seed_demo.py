"""Load the committed fictional CSV dataset into PostgreSQL."""

import csv
import os
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert

from app.database import Base, engine
from app.models.student import (
    HealthProfile, Student, accounts, checkup_results, checkup_sessions, parent_students,
)
from app.schemas.student import StudentCreate


def load_csv(folder: Path, name: str) -> list[dict]:
    with (folder / f"{name}.csv").open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def seed(folder: Path, password: str) -> None:
    if engine is None:
        raise ValueError("Configure DATABASE_URL or PostgreSQL environment variables")
    if not 8 <= len(password.encode("utf-8")) <= 72:
        raise ValueError("Demo password must contain 8–72 UTF-8 bytes")
    students = [StudentCreate.model_validate(row) for row in load_csv(folder, "students")]
    account_rows = load_csv(folder, "accounts")
    sessions = load_csv(folder, "checkup_sessions")
    results = load_csv(folder, "checkup_results")
    parent_ids = {row["id"] for row in account_rows if row["role"] == "parent"}
    for rows in ([s.model_dump() for s in students], account_rows, sessions):
        ids = [row["id"] for row in rows]
        if len(ids) != len(set(ids)):
            raise ValueError("CSV contains duplicate IDs")
    if any(s.parentid not in parent_ids for s in students):
        raise ValueError("Every student must reference a parent account in accounts.csv")
    if any(row["role"] not in {"admin", "nurse", "parent"} for row in account_rows):
        raise ValueError("Unsupported account role")
    student_ids = {s.id for s in students}
    session_ids = {s["id"] for s in sessions}
    for row in sessions:
        row["checkup_date"] = date.fromisoformat(row["checkup_date"])
    for row in results:
        if row["student_id"] not in student_ids or row["session_id"] not in session_ids:
            raise ValueError("Checkup references an unknown student or session")
        if row["status"] not in {"completed", "follow_up", "pending", "absent"}:
            raise ValueError("Unsupported checkup status")
        for field in ("height_cm", "weight_kg"):
            row[field] = Decimal(row[field]) if row[field] else None
        row["notes"] = row["notes"] or None

    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public"))
        Base.metadata.create_all(connection)
        for row in account_rows:
            connection.execute(insert(accounts).values(
                **row, password_hash=func.public.crypt(password, func.public.gen_salt("bf", 10))
            ).on_conflict_do_nothing(index_elements=["id"]))
        for student in students:
            values = student.model_dump()
            connection.execute(insert(Student).values(
                id=student.id, full_name=student.full_name, class_name=student.class_name
            ).on_conflict_do_nothing(index_elements=["id"]))
            connection.execute(insert(HealthProfile).values(
                student_id=student.id, allergies=values["allergies"] or None,
                medical_notes=values["medical_notes"] or None,
            ).on_conflict_do_nothing(index_elements=["student_id"]))
            linked = connection.scalar(select(parent_students.c.parent_id).where(
                parent_students.c.student_id == student.id
            ).limit(1))
            if linked is None:
                connection.execute(insert(parent_students).values(
                    parent_id=student.parentid, student_id=student.id
                ).on_conflict_do_nothing())
        for row in sessions:
            connection.execute(insert(checkup_sessions).values(**row).on_conflict_do_nothing())
        for row in results:
            connection.execute(insert(checkup_results).values(**row).on_conflict_do_nothing())


if __name__ == "__main__":
    seed(Path(__file__).resolve().parent.parent / "data",
         os.environ.get("SCHOOLHEALTH_DEMO_PASSWORD", ""))
    print("CSV demo data imported successfully.")
