"""Tests for reusable authentication and role guards."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.guards import AuthenticatedUser, get_current_user, require_role


@pytest.fixture
def test_app() -> FastAPI:
    # App và các API này chỉ tồn tại trong test.
    app = FastAPI()

    @app.get("/admin-overview")
    def admin_overview(
        user: AuthenticatedUser = Depends(require_role("admin")),
    ) -> dict[str, str]:
        return {"message": "Admin access granted", "user_id": user.id}

    @app.put("/nurse-profile")
    def edit_profile(
        user: AuthenticatedUser = Depends(require_role("nurse")),
    ) -> dict[str, str]:
        return {"message": "Nurse access granted", "user_id": user.id}

    @app.get("/parent-results")
    def parent_results(
        user: AuthenticatedUser = Depends(require_role("parent")),
    ) -> dict[str, str]:
        return {"message": "Parent role granted", "user_id": user.id}

    return app


def test_unauthenticated_request_is_rejected(test_app: FastAPI) -> None:
    # Không giả lập user: dependency hiện tại phải từ chối.
    with TestClient(test_app) as client:
        response = client.get("/admin-overview")

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("role", "method", "path", "expected_status"),
    [
        ("admin", "GET", "/admin-overview", 200),
        ("nurse", "GET", "/admin-overview", 403),
        ("parent", "GET", "/admin-overview", 403),
        ("nurse", "PUT", "/nurse-profile", 200),
        ("admin", "PUT", "/nurse-profile", 403),
        ("parent", "PUT", "/nurse-profile", 403),
        ("parent", "GET", "/parent-results", 200),
        ("nurse", "GET", "/parent-results", 403),
        ("admin", "GET", "/parent-results", 403),
    ],
)
def test_role_access(
    test_app: FastAPI,
    role: str,
    method: str,
    path: str,
    expected_status: int,
) -> None:
    # Giả lập kết quả xác thực chỉ trong app test.
    test_app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=f"test-{role}",
        role=role,
    )

    with TestClient(test_app) as client:
        response = client.request(method, path)

    assert response.status_code == expected_status