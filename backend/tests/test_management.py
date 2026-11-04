from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, insert, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api import management
from app.api.guards import AuthenticatedUser, get_current_user
from app.database import Base, get_db
from app.main import app
from app.models.checkup import Account, CheckupResult, CheckupSession
from app.models.management import AssignmentAudit, student_nurses
from app.models.student import HealthProfile, Student, parent_students


@pytest.fixture
def api():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
                           execution_options={"schema_translate_map": {"schoolhealth_demo": None}})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([Account(id=id, email=f"{id}@schoolhealth.example", role=role, password_hash="NEVER-EXPOSE")
                    for id, role in [("admin", "admin"), ("p1", "parent"), ("p2", "parent"), ("empty", "parent"), ("n1", "nurse"), ("n2", "nurse")]])
        db.add_all([Student(id=id, full_name=f"Synthetic {id}", class_name=class_name)
                    for id, class_name in [("S1", "6A1"), ("S2", "6A1"), ("S3", "6A2")]])
        db.add_all([HealthProfile(student_id="S1", allergies="Test allergy", medical_notes="Own health note"),
                    HealthProfile(student_id="S2", allergies=None, medical_notes="OTHER-CHILD-PRIVATE")])
        db.add_all([CheckupSession(id=id, title=id, checkup_date=date(2026, month, 1))
                    for id, month in [("old", 9), ("new", 10), ("pending", 11)]])
        db.flush()
        db.execute(insert(parent_students), [{"parent_id": "p1", "student_id": "S1"},
                                            {"parent_id": "p1", "student_id": "S3"},
                                            {"parent_id": "p2", "student_id": "S2"}])
        db.execute(insert(student_nurses), [{"student_id": "S1", "nurse_id": "n1"},
                                          {"student_id": "S2", "nurse_id": "n2"},
                                          {"student_id": "S3", "nurse_id": "n2"}])
        db.add_all([CheckupResult(student_id="S1", session_id="old", status="completed", height_cm=150, weight_kg=40),
                    CheckupResult(student_id="S1", session_id="new", status="follow_up", height_cm=160, weight_kg=50, bmi=999),
                    CheckupResult(student_id="S1", session_id="pending", status="pending"),
                    CheckupResult(student_id="S2", session_id="new", status="completed", height_cm=150, weight_kg=45)])
        db.commit()

    def get_test_db():
        with Session(engine) as db:
            yield db

    def login(id, role):
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=id, role=role)

    app.dependency_overrides[get_db] = get_test_db
    login("admin", "admin")
    try:
        with TestClient(app) as client:
            yield client, login, engine
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()


def current_record(client, student_id="S1"):
    return next(row for row in client.get("/api/admin/health-records").json()["items"] if row["id"] == student_id)


def test_parent_multi_child_latest_and_private_contract(api):
    client, login, _ = api
    login("p1", "parent")
    response = client.get("/api/parent/dashboard?parentId=p2")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["parent"]["id"] == "p1"
    assert [child["id"] for child in body["children"]] == ["S1", "S3"]
    assert "OTHER-CHILD-PRIVATE" not in response.text
    assert "NEVER-EXPOSE" not in response.text
    child = body["children"][0]
    assert "parents" not in child and "assignment_version" not in child
    assert child["latest_checkup"]["session_id"] == "new"
    assert child["latest_checkup"]["status"] == "Needs Follow-up"
    assert child["latest_checkup"]["bmi"] == 19.53
    assert len(child["checkups"]) == 3
    assert body["children"][1]["latest_checkup"] is None
    assert client.get("/api/parent/children/S1").status_code == 200
    for child_id in ("S2", "unknown"):
        assert client.get(f"/api/parent/children/{child_id}").status_code == 404
    assert client.get("/students/S2").status_code == 403


@pytest.mark.parametrize("id,children", [("p2", ["S2"]), ("empty", [])])
def test_parent_one_or_no_child_preserves_profile(api, id, children):
    client, login, _ = api
    login(id, "parent")
    body = client.get("/api/parent/dashboard").json()
    assert body["parent"]["id"] == id
    assert [row["id"] for row in body["children"]] == children


@pytest.mark.parametrize("path", ["/api/parent/dashboard", "/api/parent/children/S1", "/api/admin/health-records", "/api/admin/health-records/options", "/students/S1"])
def test_missing_auth_is_rejected(api, path):
    client, _, _ = api
    app.dependency_overrides.pop(get_current_user)
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("id,role,path", [("p1", "parent", "/api/admin/health-records"), ("n1", "nurse", "/api/admin/health-records/options"), ("admin", "admin", "/api/parent/dashboard"), ("n1", "nurse", "/api/parent/children/S1")])
def test_wrong_role_is_forbidden(api, id, role, path):
    client, login, _ = api
    login(id, role)
    assert client.get(path).status_code == 403


def test_deleted_or_demoted_account_cannot_use_claims(api):
    client, login, _ = api
    login("missing", "parent")
    assert client.get("/api/parent/dashboard").status_code == 401
    login("p1", "admin")
    assert client.get("/api/admin/health-records").status_code == 401


def test_admin_filters_are_combined_and_paginated_without_duplicates(api):
    client, _, engine = api
    with Session(engine) as db:
        db.execute(insert(parent_students).values(parent_id="p2", student_id="S1")); db.commit()
    page = client.get("/api/admin/health-records?pageSize=1&page=2").json()
    assert page["total"] == 3 and page["page"] == 2 and len(page["items"]) == 1
    body = client.get("/api/admin/health-records?classId=6A1&parentId=p1&nurseId=n1").json()
    assert body["total"] == 1 and body["items"][0]["id"] == "S1"
    assert len(body["items"][0]["parents"]) == 2
    assert client.get("/api/admin/health-records?classId=6A2&nurseId=n1").json()["total"] == 0
    assert client.get("/api/admin/health-records?page=0").status_code == 422
    assert client.get("/api/admin/health-records?pageSize=101").status_code == 422
    options = client.get("/api/admin/health-records/options").json()
    assert [row["id"] for row in options["classes"]] == ["6A1", "6A2"]
    assert {row["id"] for row in options["parents"]} == {"p1", "p2", "empty"}
    assert {row["id"] for row in options["nurses"]} == {"n1", "n2"}


def test_parent_change_updates_ownership_and_stale_writes_are_rejected(api):
    client, login, engine = api
    original = current_record(client)
    path = "/api/admin/students/S1/parent"
    changed = client.put(path, json={"account_id": "p2"}, headers={"If-Match": original["assignment_version"]})
    assert changed.status_code == 200
    assert [row["id"] for row in changed.json()["parents"]] == ["p2"]
    assert client.delete(path, headers={"If-Match": original["assignment_version"]}).status_code == 409
    login("p1", "parent")
    assert client.get("/api/parent/children/S1").status_code == 404
    login("p2", "parent")
    assert client.get("/api/parent/children/S1").status_code == 200
    login("admin", "admin")
    removed = client.delete(path, headers={"If-Match": changed.json()["assignment_version"]})
    assert removed.status_code == 200 and removed.json()["parents"] == []
    with Session(engine) as db:
        audits = db.scalars(select(AssignmentAudit).order_by(AssignmentAudit.id)).all()
        assert len(audits) == 2 and audits[0].actor_id == "admin"
        assert audits[0].old_ids == ["p1"] and audits[0].new_ids == ["p2"]
        assert audits[1].new_ids == []


def test_nurse_assignment_and_removal(api):
    client, _, _ = api
    row = current_record(client)
    changed = client.put("/api/admin/students/S1/nurse", json={"account_id": "n2"}, headers={"If-Match": row["assignment_version"]})
    assert changed.status_code == 200 and changed.json()["nurse"]["id"] == "n2"
    removed = client.delete("/api/admin/students/S1/nurse", headers={"If-Match": changed.json()["assignment_version"]})
    assert removed.status_code == 200 and removed.json()["nurse"] is None


@pytest.mark.parametrize("kind,bad_id", [("parent", "unknown"), ("parent", "n1"), ("nurse", "p1"), ("nurse", "unknown")])
def test_invalid_ids_or_roles_do_not_mutate_assignments(api, kind, bad_id):
    client, _, engine = api
    original = current_record(client)
    response = client.put(f"/api/admin/students/S1/{kind}", json={"account_id": bad_id}, headers={"If-Match": original["assignment_version"]})
    assert response.status_code == 422
    assert current_record(client)["assignment_version"] == original["assignment_version"]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(AssignmentAudit)) == 0


def test_mutation_role_and_precondition_protection(api):
    client, login, _ = api
    assert client.delete("/api/admin/students/S1/parent").status_code == 428
    login("p1", "parent")
    assert client.put("/api/admin/students/S1/parent", json={"account_id": "p2"}).status_code == 403
    app.dependency_overrides.pop(get_current_user)
    assert client.delete("/api/admin/students/S1/nurse").status_code == 401


def test_assignment_transaction_rolls_back_and_hides_database_errors(api, monkeypatch):
    client, _, engine = api
    original = current_record(client)
    def fail(*args, **kwargs):
        raise OperationalError("SENSITIVE SQL", {}, Exception("SENSITIVE DATABASE"))
    monkeypatch.setattr(management, "load_records", fail)
    response = client.put("/api/admin/students/S1/parent", json={"account_id": "p2"}, headers={"If-Match": original["assignment_version"]})
    assert response.status_code == 503 and "SENSITIVE" not in response.text
    with Session(engine) as db:
        assert list(db.scalars(select(parent_students.c.parent_id).where(parent_students.c.student_id == "S1"))) == ["p1"]
        assert db.scalar(select(func.count()).select_from(AssignmentAudit)) == 0


def test_validation_does_not_echo_private_input(api):
    client, _, _ = api
    response = client.put("/api/admin/students/S1/parent", json={"account_id": "p1", "notes": "PRIVATE HEALTH"})
    assert response.status_code == 422 and "PRIVATE HEALTH" not in response.text
