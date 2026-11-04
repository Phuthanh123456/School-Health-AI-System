import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import CreateSchema, DropSchema

from app.database import Base, engine as application_engine, get_db
from app.main import app
from app.models.student import HealthProfile, Student


@pytest.fixture
def client():
    schema = None
    if os.getenv("RUN_POSTGRES_TESTS") == "1":
        assert application_engine is not None
        schema = "student_id_test_" + uuid4().hex
        engine = create_engine(
            application_engine.url,
            execution_options={"schema_translate_map": {"schoolhealth_demo": schema}},
        )
        with engine.begin() as connection:
            connection.execute(CreateSchema(schema))
    else:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            execution_options={"schema_translate_map": {"schoolhealth_demo": None}},
        )

    tables = [Student.__table__, HealthProfile.__table__]
    Base.metadata.create_all(engine, tables=tables)

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


@pytest.mark.parametrize("student_id", ["DEMO-025", "demo_026", "025", "A"])
def test_accepted_id_can_be_created_read_and_updated(client, student_id):
    payload = {"id": student_id, "full_name": "Synthetic Student", "class_name": "6A1"}
    created = client.post("/students", json=payload)
    assert created.status_code == 201, created.text
    assert client.get(f"/students/{student_id}").json()["id"] == student_id

    changed = client.patch(f"/students/{student_id}", json={"medical_notes": "Saved"})
    assert changed.status_code == 200, changed.text
    assert client.get(f"/students/{student_id}").json()["medical_notes"] == "Saved"


@pytest.mark.parametrize("student_id", [
    "DEMO/025", "DEMO%2F025", "DEMO?025", "DEMO#025", "DEMO 025",
    "DEMO\\025", ".", "ĐEMO-025", "A" * 51,
])
def test_unsafe_id_is_rejected_without_creating_a_student(client, student_id):
    response = client.post("/students", json={
        "id": student_id, "full_name": "Synthetic Student", "class_name": "6A1",
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
        "id": "QA-VALIDATION", "full_name": "Synthetic Student", "class_name": "6A1",
        "allergies": "Peanuts", "medical_notes": "Original",
    }
    invalid_create = client.post("/students", json={**original, **changes})
    assert invalid_create.status_code == 422, invalid_create.text
    assert client.get("/students").json() == []
    assert client.post("/students", json=original).status_code == 201
    invalid_update = client.patch("/students/QA-VALIDATION", json=changes)
    assert invalid_update.status_code == 422, invalid_update.text
    assert client.get("/students/QA-VALIDATION").json() == original


def test_duplicate_and_partial_updates_preserve_other_fields(client):
    original = {
        "id": "QA-PARTIAL", "full_name": "Synthetic Student", "class_name": "6A1",
        "allergies": "Peanuts", "medical_notes": "Original",
    }
    assert client.post("/students", json=original).status_code == 201
    assert client.post("/students", json={**original, "full_name": "Duplicate"}).status_code == 409
    assert client.get("/students/QA-PARTIAL").json() == original
    assert client.patch("/students/QA-PARTIAL", json={"class_name": "6A2"}).status_code == 200
    expected = {**original, "class_name": "6A2"}
    assert client.get("/students/QA-PARTIAL").json() == expected
    assert client.patch("/students/QA-PARTIAL", json={}).json() == expected
    assert client.patch("/students/QA-PARTIAL", json={"allergies": "", "medical_notes": None}).status_code == 200
    assert client.get("/students/QA-PARTIAL").json() == {**expected, "allergies": None, "medical_notes": None}


def test_missing_student_and_immutable_id(client):
    assert client.get("/students/QA-MISSING").status_code == 404
    assert client.patch("/students/QA-MISSING", json={"medical_notes": "Test"}).status_code == 404
    assert client.post("/students", json={
        "id": "QA-ORIGINAL", "full_name": "Synthetic Student", "class_name": "6A1",
    }).status_code == 201
    assert client.patch("/students/QA-ORIGINAL", json={"id": "QA-NEW"}).status_code == 422
    assert client.get("/students/QA-ORIGINAL").status_code == 200
    assert client.get("/students/QA-NEW").status_code == 404
