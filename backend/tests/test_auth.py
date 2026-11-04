from collections.abc import Iterator
from typing import Any

import bcrypt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.auth import router as auth_router
from app.api.guards import AuthenticatedUser as GuardUser, require_role
from app.api.parent_guard import require_parent_student_link
from app.config import settings
from app.database import get_db
from app.main import app


TEST_PASSWORD = "synthetic-test-password"
TEST_SECRET = "unit-test-only-signing-secret-32-bytes-minimum"
DEMO_USERS = {
    "admin@schoolhealth.example": ("admin", "admin"),
    "nurse@schoolhealth.example": ("nurse", "nurse"),
    "parent@schoolhealth.example": ("parent", "parent"),
}


class FakeResult:
    def __init__(self, row: Any | None) -> None:
        self.row = row

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> Any | None:
        return self.row


class FakeSession:
    def __init__(self, accounts: dict[str, dict[str, str]]) -> None:
        self.accounts = accounts

    def execute(self, statement: Any, parameters: dict[str, str]) -> FakeResult:
        if "schoolhealth_demo.parent_students" in str(statement):
            linked = (parameters["parent_id"], parameters["student_id"]) in {
                ("parent", "DEMO-001"),
                ("parent", "DEMO-017"),
            }
            return FakeResult((1,) if linked else None)
        return FakeResult(self.accounts.get(parameters["email"]))


@pytest.fixture
def auth_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(settings, "auth_token_secret", TEST_SECRET)
    password_hash = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
    accounts = {
        email: {"id": account_id, "email": email, "role": role, "password_hash": password_hash}
        for email, (account_id, role) in DEMO_USERS.items()
    }
    fake_session = FakeSession(accounts)
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = lambda: fake_session

    try:
        with TestClient(app) as client:
            yield client
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override


@pytest.fixture
def auth_guard_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Exercise a real login token through the role guard dependency."""
    monkeypatch.setattr(settings, "auth_token_secret", TEST_SECRET)
    password_hash = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
    accounts = {
        email: {"id": account_id, "email": email, "role": role, "password_hash": password_hash}
        for email, (account_id, role) in DEMO_USERS.items()
    }
    fake_session = FakeSession(accounts)
    guard_app = FastAPI()
    guard_app.include_router(auth_router)

    @guard_app.get("/nurse-only")
    def nurse_only(user: GuardUser = Depends(require_role("nurse"))) -> dict[str, str]:
        return {"user_id": user.id, "role": user.role}

    @guard_app.get("/students/{student_id}/results")
    def parent_results(
        student_id: str,
        user: GuardUser = Depends(require_parent_student_link),
    ) -> dict[str, str]:
        return {"student_id": student_id, "parent_id": user.id}

    guard_app.dependency_overrides[get_db] = lambda: fake_session
    with TestClient(guard_app) as client:
        yield client


@pytest.mark.parametrize(("email", "expected_role"), DEMO_USERS.items())
def test_each_seeded_role_can_sign_in_and_read_authenticated_user(
    auth_client: TestClient, email: str, expected_role: tuple[str, str]
) -> None:
    account_id, role = expected_role
    response = auth_client.post(
        "/auth/login",
        json={"email": email, "password": TEST_PASSWORD},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 3600
    assert body["user"] == {"id": account_id, "email": email, "role": role}
    assert "password" not in body
    assert "password_hash" not in body

    me = auth_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json() == body["user"]


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "admin@schoolhealth.example", "password": "wrong-password"},
        {"email": "unknown@schoolhealth.example", "password": TEST_PASSWORD},
    ],
)
def test_invalid_credentials_are_rejected_without_a_token(
    auth_client: TestClient, payload: dict[str, str]
) -> None:
    response = auth_client.post("/auth/login", json=payload)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."
    assert "access_token" not in response.json()


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer not-a-valid-token"},
    ],
)
def test_authenticated_endpoint_rejects_missing_or_invalid_token(
    auth_client: TestClient, headers: dict[str, str]
) -> None:
    response = auth_client.get("/auth/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_login_token_is_consumed_by_role_guard(auth_guard_client: TestClient) -> None:
    login = auth_guard_client.post(
        "/auth/login",
        json={"email": "nurse@schoolhealth.example", "password": TEST_PASSWORD},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    allowed = auth_guard_client.get(
        "/nurse-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert allowed.status_code == 200
    assert allowed.json() == {"user_id": "nurse", "role": "nurse"}

    admin_login = auth_guard_client.post(
        "/auth/login",
        json={"email": "admin@schoolhealth.example", "password": TEST_PASSWORD},
    )
    denied = auth_guard_client.get(
        "/nurse-only",
        headers={"Authorization": f"Bearer {admin_login.json()['access_token']}"},
    )
    assert denied.status_code == 403

    unauthenticated = auth_guard_client.get("/nurse-only")
    assert unauthenticated.status_code == 401


def test_parent_login_token_is_limited_to_linked_students(auth_guard_client: TestClient) -> None:
    login = auth_guard_client.post(
        "/auth/login",
        json={"email": "parent@schoolhealth.example", "password": TEST_PASSWORD},
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    allowed = auth_guard_client.get("/students/DEMO-001/results", headers=headers)
    assert allowed.status_code == 200
    assert allowed.json() == {"student_id": "DEMO-001", "parent_id": "parent"}

    denied = auth_guard_client.get("/students/DEMO-002/results", headers=headers)
    assert denied.status_code == 403
