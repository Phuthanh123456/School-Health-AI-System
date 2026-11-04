from collections.abc import Generator
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import require_nurse
from app.database import Base, get_db
from app.main import app
from app.models.checkup import Account, CheckupResult, CheckupSession, Student
from app.api.checkups import calculate_bmi


@pytest.fixture
def db_factory() -> Generator[sessionmaker[Session], None, None]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def attach_demo_schema(connection, _record) -> None:
        connection.execute("ATTACH DATABASE ':memory:' AS schoolhealth_demo")
        connection.create_function(
            "crypt", 2, lambda password, hashed: hashed if password == "synthetic-password" else "invalid"
        )

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add_all(
            [
                Student(id="STU-001", full_name="Alex Example", class_name="6A"),
                Student(id="STU-002", full_name="Jamie Sample", class_name="6A"),
                Student(id="STU-003", full_name="Taylor Demo", class_name="6A"),
                CheckupSession(id="SESSION-A", title="Synthetic annual checkup", checkup_date=date(2026, 11, 3)),
                CheckupResult(
                    session_id="SESSION-A", student_id="STU-001", status="completed", height_cm=150,
                    weight_kg=40, bmi=17.778, notes="Synthetic existing result",
                ),
                CheckupResult(session_id="SESSION-A", student_id="STU-002", status="pending"),
                Account(id="nurse", email="nurse@example.test", role="nurse", password_hash="synthetic-hash"),
                Account(id="parent", email="parent@example.test", role="parent", password_hash="synthetic-hash"),
            ]
        )
        db.commit()
    yield factory
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def client(db_factory: sessionmaker[Session]) -> Generator[TestClient, None, None]:
    def override_db() -> Generator[Session, None, None]:
        with db_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_nurse] = lambda: "nurse"
    with TestClient(app) as test_client:
        yield test_client


def test_bmi_uses_metric_units_and_keeps_unrounded_value() -> None:
    assert calculate_bmi(160, 64) == 25
    assert round(calculate_bmi(170, 65), 2) == Decimal("22.49")


def test_search_matches_name_and_student_code_and_only_returns_participants(client: TestClient) -> None:
    by_name = client.get("/checkups/sessions/SESSION-A/students", params={"q": "Alex"})
    by_code = client.get("/checkups/sessions/SESSION-A/students", params={"q": "STU-002"})
    all_participants = client.get("/checkups/sessions/SESSION-A/students")

    assert [student["student_code"] for student in by_name.json()] == ["STU-001"]
    assert [student["id"] for student in by_code.json()] == ["STU-002"]
    assert {student["id"] for student in all_participants.json()} == {"STU-001", "STU-002"}


def test_existing_result_can_be_reopened(client: TestClient) -> None:
    response = client.get("/checkups/sessions/SESSION-A/students/STU-001/result")
    assert response.status_code == 200
    assert response.json()["bmi"] == pytest.approx(17.778)
    assert response.json()["status"] == "Normal"


def test_pending_participant_has_no_saved_result_yet(client: TestClient) -> None:
    response = client.get("/checkups/sessions/SESSION-A/students/STU-002/result")
    assert response.status_code == 404
    assert response.json()["detail"] == "No checkup result has been saved for this student."


def test_save_creates_result_data_on_participation_row_and_preserves_nurse_status(
    client: TestClient, db_factory: sessionmaker[Session]
) -> None:
    response = client.put(
        "/checkups/sessions/SESSION-A/students/STU-002/result",
        json={"height_cm": 150, "weight_kg": 80, "vision": "Synthetic note", "notes": None, "status": "Normal"},
    )
    assert response.status_code == 200
    assert response.json()["bmi"] == pytest.approx(35.556, abs=0.001)
    assert response.json()["status"] == "Normal"
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(CheckupResult).where(
            CheckupResult.session_id == "SESSION-A", CheckupResult.student_id == "STU-002"
        )) == 1
        saved = db.get(CheckupResult, ("SESSION-A", "STU-002"))
        assert saved is not None and saved.status == "completed"


def test_updating_does_not_create_duplicate_rows(client: TestClient, db_factory: sessionmaker[Session]) -> None:
    response = client.put(
        "/checkups/sessions/SESSION-A/students/STU-001/result",
        json={"height_cm": 151, "weight_kg": 41, "status": "Needs Follow-up"},
    )
    assert response.status_code == 200
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(CheckupResult).where(
            CheckupResult.session_id == "SESSION-A", CheckupResult.student_id == "STU-001"
        )) == 1
        saved = db.get(CheckupResult, ("SESSION-A", "STU-001"))
        assert saved is not None and saved.status == "follow_up"


@pytest.mark.parametrize(
    "body",
    [
        {"weight_kg": 40, "status": "Normal"},
        {"height_cm": 150, "status": "Normal"},
        {"height_cm": 0, "weight_kg": 40, "status": "Normal"},
        {"height_cm": -1, "weight_kg": 40, "status": "Normal"},
        {"height_cm": 150, "weight_kg": 0, "status": "Normal"},
        {"height_cm": 150, "weight_kg": -1, "status": "Normal"},
    ],
)
def test_invalid_updates_do_not_overwrite_existing_data(client: TestClient, db_factory: sessionmaker[Session], body: dict) -> None:
    response = client.put("/checkups/sessions/SESSION-A/students/STU-001/result", json=body)
    assert response.status_code == 422
    with db_factory() as db:
        saved = db.get(CheckupResult, ("SESSION-A", "STU-001"))
        assert saved is not None
        assert float(saved.height_cm) == 150
        assert float(saved.weight_kg) == 40
        assert saved.status == "completed"


def test_unknown_ids_and_nonparticipants_are_rejected(client: TestClient) -> None:
    body = {"height_cm": 150, "weight_kg": 40, "status": "Normal"}
    assert client.put("/checkups/sessions/UNKNOWN/students/STU-001/result", json=body).status_code == 404
    assert client.put("/checkups/sessions/SESSION-A/students/UNKNOWN/result", json=body).status_code == 404
    assert client.put("/checkups/sessions/SESSION-A/students/STU-003/result", json=body).status_code == 404


def test_only_nurse_account_can_write(client: TestClient) -> None:
    app.dependency_overrides.pop(require_nurse)
    url = "/checkups/sessions/SESSION-A/students/STU-001/result"
    body = {"height_cm": 151, "weight_kg": 41, "status": "Normal"}
    unauthorized = client.put(url, json=body)
    parent = client.put(url, json=body, auth=("parent", "synthetic-password"))
    nurse = client.get("/checkups/sessions", auth=("nurse", "synthetic-password"))
    assert unauthorized.status_code == 401
    assert parent.status_code == 401
    assert nurse.status_code == 200
