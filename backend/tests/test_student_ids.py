import os
from datetime import date
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateSchema, DropSchema

from app.database import Base, engine as application_engine, get_db
from app.main import app
from app.models.student import HealthProfile, Student, accounts, checkup_sessions, parent_students, checkup_results, student_nurses


@pytest.fixture
def client():
    schema = None
    if os.getenv("RUN_POSTGRES_TESTS") == "1":
        assert application_engine is not None
        schema = "student_id_test_" + uuid4().hex
        engine = create_engine(
            application_engine.url,
            execution_options={"schema_translate_map": {"public": schema}},
        )
        with engine.begin() as connection:
            connection.execute(CreateSchema(schema))
    else:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            execution_options={"schema_translate_map": {"public": None}},
        )

    tables = [accounts, Student.__table__, HealthProfile.__table__, checkup_sessions, parent_students, checkup_results, student_nurses]
    Base.metadata.create_all(engine, tables=tables)
    with engine.begin() as connection:
        connection.execute(accounts.insert(), [
            {"id": "parent", "email": "parent@example.test", "role": "parent", "password_hash": "test"},
            {"id": "NURSE001", "email": "nurse001@example.test", "role": "nurse", "password_hash": "test"},
            {"id": "NURSE002", "email": "nurse002@example.test", "role": "nurse", "password_hash": "test"},
            {"id": "parent2", "email": "parent2@example.test", "role": "parent", "password_hash": "test"},
        ])
        connection.execute(checkup_sessions.insert().values(
            id="session", title="Test", checkup_date=date(2026, 11, 4)
        ))

    def test_db():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = test_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
        if schema:
            with engine.begin() as connection:
                connection.execute(DropSchema(schema, cascade=True))
        engine.dispose()


@pytest.mark.parametrize("student_id", ["DEMO025", "demo026", "025", "A"])
def test_accepted_id_can_be_created_read_and_updated(client, student_id):
    payload = {"id": student_id, "full_name": "Synthetic Student", "class_name": "6A1", "parentid": "parent", "nurseid": "NURSE001"}
    created = client.post("/students", json=payload)
    assert created.status_code == 201, created.text
    assert client.get(f"/students/{student_id}").json()["id"] == student_id

    changed = client.patch(f"/students/{student_id}", json={"medical_notes": "Saved"})
    assert changed.status_code == 200, changed.text
    assert client.get(f"/students/{student_id}").json()["medical_notes"] == "Saved"


@pytest.mark.parametrize("student_id", [
    "DEMO-025", "demo_026", "DEMO/025", "DEMO%2F025", "DEMO?025", "DEMO#025", "DEMO 025",
    "DEMO\\025", ".", "ĐEMO-025", "A" * 51,
])
def test_unsafe_id_is_rejected_without_creating_a_student(client, student_id):
    response = client.post("/students", json={
        "id": student_id, "full_name": "Synthetic Student", "class_name": "6A1", "parentid": "parent", "nurseid": "NURSE001",
    })
    assert response.status_code == 422, response.text
    assert client.get("/students").json() == []


@pytest.mark.parametrize("changes", [
    {"full_name": ""}, {"full_name": "   "}, {"full_name": None},
    {"class_name": ""}, {"class_name": "   "}, {"class_name": None},
    {"full_name": "A" * 201}, {"class_name": "A" * 51},
    {"allergies": "A" * 2001}, {"medical_notes": "A" * 2001},
])
def test_invalid_create_and_update_preserve_data(client, changes):
    original = {
        "id": "QAVALIDATION", "full_name": "Synthetic Student", "class_name": "6A1", "parentid": "parent", "nurseid": "NURSE001",
        "allergies": "Peanuts", "medical_notes": "Original",
    }
    invalid_create = client.post("/students", json={**original, **changes})
    assert invalid_create.status_code == 422, invalid_create.text
    assert client.get("/students").json() == []
    assert client.post("/students", json=original).status_code == 201
    invalid_update = client.patch("/students/QAVALIDATION", json=changes)
    assert invalid_update.status_code == 422, invalid_update.text
    assert client.get("/students/QAVALIDATION").json() == original


def test_duplicate_and_partial_updates_preserve_other_fields(client):
    original = {
        "id": "QAPARTIAL", "full_name": "Synthetic Student", "class_name": "6A1", "parentid": "parent", "nurseid": "NURSE001",
        "allergies": "Peanuts", "medical_notes": "Original",
    }
    assert client.post("/students", json=original).status_code == 201
    assert client.post("/students", json={**original, "full_name": "Duplicate"}).status_code == 409
    assert client.get("/students/QAPARTIAL").json() == original
    assert client.patch("/students/QAPARTIAL", json={"class_name": "6A2"}).status_code == 200
    expected = {**original, "class_name": "6A2"}
    assert client.get("/students/QAPARTIAL").json() == expected
    assert client.patch("/students/QAPARTIAL", json={}).json() == expected
    assert client.patch("/students/QAPARTIAL", json={"allergies": "", "medical_notes": None}).status_code == 200
    assert client.get("/students/QAPARTIAL").json() == {**expected, "allergies": None, "medical_notes": None}


def test_missing_student_and_immutable_id(client):
    assert client.get("/students/QAMISSING").status_code == 404
    assert client.patch("/students/QAMISSING", json={"medical_notes": "Test"}).status_code == 404
    assert client.post("/students", json={
        "id": "QAORIGINAL", "full_name": "Synthetic Student", "class_name": "6A1", "parentid": "parent", "nurseid": "NURSE001",
    }).status_code == 201
    assert client.patch("/students/QAORIGINAL", json={"id": "QANEW"}).status_code == 422
    assert client.get("/students/QAORIGINAL").status_code == 200
    assert client.get("/students/QANEW").status_code == 404


def test_existing_demo_id_remains_readable_and_editable(client):
    database = app.dependency_overrides[get_db]()
    db = next(database)
    try:
        db.add(Student(id="DEMO-001", full_name="Synthetic Student", class_name="6A1"))
        db.commit()
    finally:
        database.close()
    assert client.get("/students/DEMO-001").status_code == 200
    response = client.patch("/students/DEMO-001", json={"medical_notes": "Updated"})
    assert response.status_code == 200, response.text
    assert client.get("/students/DEMO-001").json()["medical_notes"] == "Updated"


def test_search_and_delete_student_with_dependent_records(client):
    for student_id in ("DEMO025", "DEMO026"):
        assert client.post("/students", json={
            "id": student_id, "full_name": "Synthetic Student", "class_name": "6A1", "parentid": "parent", "nurseid": "NURSE001",
        }).status_code == 201
    assert [s["id"] for s in client.get("/students?student_id=demo025").json()] == ["DEMO025"]
    assert len(client.get("/students?student_id=DEMO02").json()) == 2
    assert client.get("/students?student_id=%25").json() == []
    database = app.dependency_overrides[get_db]()
    db = next(database)
    try:
        db.execute(parent_students.delete().where(parent_students.c.student_id == "DEMO025"))
        db.execute(parent_students.insert().values(parent_id="parent", student_id="DEMO025"))
        db.execute(checkup_results.insert().values(session_id="session", student_id="DEMO025", status="completed"))
        db.commit()
    finally:
        database.close()
    assert client.delete("/students/DEMO025").status_code == 204
    assert client.get("/students/DEMO025").status_code == 404
    assert client.delete("/students/DEMO025").status_code == 404
    assert client.get("/students/DEMO026").status_code == 200


def test_parent_id_can_be_created_and_changed(client):
    response = client.post("/students", json={
        "id": "PARENTTEST", "full_name": "Synthetic Student", "class_name": "6A1", "parentid": "parent", "nurseid": "NURSE001",
        "parentid": "parent", "nurseid": "NURSE001",
    })
    assert response.status_code == 201, response.text
    assert response.json()["parentid"] == "parent"
    assert client.patch("/students/PARENTTEST", json={"parentid": "missing"}).status_code == 422
    assert client.get("/students/PARENTTEST").json()["parentid"] == "parent"
    response = client.patch("/students/PARENTTEST", json={"parentid": "parent2"})
    assert response.status_code == 200, response.text
    assert client.get("/students/PARENTTEST").json()["parentid"] == "parent2"


@pytest.mark.skipif(os.getenv("RUN_POSTGRES_TESTS") != "1", reason="CSV accounts use PostgreSQL pgcrypto")
def test_csv_import_is_repeatable_and_preserves_edits(client, monkeypatch):
    from app import seed_demo

    database = app.dependency_overrides[get_db]()
    db = next(database)
    try:
        monkeypatch.setattr(seed_demo, "engine", db.get_bind())
    finally:
        database.close()
    folder = Path(seed_demo.__file__).resolve().parent.parent / "data"
    seed_demo.seed(folder, uuid4().hex)
    roster = client.get("/students").json()
    assert len({student["parentid"] for student in roster}) == 24
    assert client.get("/students/DEMO001").json()["parentid"] == "PARENT001"
    assert client.get("/students/DEMO024").json()["parentid"] == "PARENT024"
    response = client.patch("/students/DEMO001", json={
        "medical_notes": "Preserved edit", "parentid": "parent2",
    })
    assert response.status_code == 200, response.text
    seed_demo.seed(folder, uuid4().hex)
    assert len(client.get("/students").json()) == 24
    profile = client.get("/students/DEMO001").json()
    assert profile["medical_notes"] == "Preserved edit"
    assert profile["parentid"] == "parent2"


def test_nurse_assignment_validation_and_update(client):
    response = client.post("/students", json={
        "id": "NURSETEST", "full_name": "Synthetic Student", "class_name": "6A1",
        "parentid": "parent", "nurseid": "NURSE001",
    })
    assert response.status_code == 201, response.text
    assert client.patch("/students/NURSETEST", json={"nurseid": "parent"}).status_code == 422
    assert client.get("/students/NURSETEST").json()["nurseid"] == "NURSE001"
    assert client.patch("/students/NURSETEST", json={"nurseid": "NURSE002"}).status_code == 200
    assert client.get("/students/NURSETEST").json()["nurseid"] == "NURSE002"
