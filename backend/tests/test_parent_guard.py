"""Tests for parent-student ownership checks."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.guards import AuthenticatedUser, get_current_user, require_role
from app.api.parent_guard import require_parent_student_link
from app.database import get_db


class FakeResult:
    """Giả lập kết quả truy vấn database."""

    def __init__(self, found: bool):
        self.found = found

    def first(self):
        return (1,) if self.found else None


class FakeDatabase:
    """Dữ liệu liên kết giả, chỉ sử dụng trong test."""

    def __init__(self):
        self.links = {
            ("parent-a", "student-a"),
            ("parent-b", "student-b"),
        }

    def execute(self, query, params):
        pair = (params["parent_id"], params["student_id"])
        return FakeResult(pair in self.links)


@pytest.fixture
def test_app() -> FastAPI:
    app = FastAPI()

    # API này chỉ tồn tại trong test.
    @app.get("/students/{student_id}/results")
    def read_results(
        student_id: str,
        user: AuthenticatedUser = Depends(require_parent_student_link),
    ):
        return {"student_id": student_id, "parent_id": user.id}

    # API sửa này chỉ dùng để test Parent bị guard role từ chối.
    @app.put("/students/{student_id}/profile")
    def update_profile(
        student_id: str,
        user: AuthenticatedUser = Depends(require_role("nurse")),
    ):
        return {"student_id": student_id, "updated_by": user.id}

    app.dependency_overrides[get_db] = lambda: FakeDatabase()

    return app


@pytest.mark.parametrize(
    ("parent_id", "student_id", "expected_status"),
    [
        ("parent-a", "student-a", 200),
        ("parent-b", "student-b", 200),
        ("parent-a", "student-b", 403),
        ("parent-b", "student-a", 403),
    ],
)
def test_parent_can_only_read_linked_student(
    test_app: FastAPI,
    parent_id: str,
    student_id: str,
    expected_status: int,
) -> None:
    test_app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=parent_id,
        role="parent",
    )

    with TestClient(test_app) as client:
        response = client.get(f"/students/{student_id}/results")

    assert response.status_code == expected_status

    if expected_status == 200:
        assert response.json()["student_id"] == student_id
    else:
        assert "student_id" not in response.json()


def test_parent_cannot_edit_profile(test_app: FastAPI) -> None:
    test_app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id="parent-a",
        role="parent",
    )

    with TestClient(test_app) as client:
        response = client.put("/students/student-a/profile")

    assert response.status_code == 403


def test_unauthenticated_parent_results_are_rejected(test_app: FastAPI) -> None:
    with TestClient(test_app) as client:
        response = client.get("/students/student-a/results")

    assert response.status_code == 401