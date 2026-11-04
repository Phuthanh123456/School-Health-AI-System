"""Reusable authentication and role guards."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.api.auth import get_authenticated_user
from app.schemas.auth import AuthenticatedUser as LoginUser


@dataclass(frozen=True)
class AuthenticatedUser:
    """Thông tin tối thiểu cần có từ hệ thống đăng nhập."""

    id: str
    role: str


def get_current_user(
    login_user: Annotated[LoginUser, Depends(get_authenticated_user)],
) -> AuthenticatedUser:
    """Expose the signed-in user's ID and role to access-control guards."""
    return AuthenticatedUser(id=login_user.id, role=login_user.role)


def require_role(*allowed_roles: str) -> Callable:
    """Chỉ cho phép user đã xác thực có role nằm trong danh sách."""

    def role_guard(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_guard
