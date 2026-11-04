from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.auth import AuthenticatedUser, LoginRequest, LoginResponse
from app.services.auth import (
    create_access_token,
    decode_access_token,
    is_supported_role,
    verify_password,
)


router = APIRouter(prefix="/auth", tags=["authentication"])
bearer_scheme = HTTPBearer(auto_error=False)


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_authenticated_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise unauthorized()
    return decode_access_token(credentials.credentials)


@router.post("/login", response_model=LoginResponse, summary="Authenticate a demo account")
def login(
    request: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> LoginResponse:
    account = db.execute(
        text(
            """
            SELECT id, email, role, password_hash
            FROM schoolhealth_demo.accounts
            WHERE lower(email) = :email
            LIMIT 1
            """
        ),
        {"email": request.email},
    ).mappings().first()

    if (
        account is None
        or not is_supported_role(account["role"])
        or not verify_password(request.password, account["password_hash"])
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = AuthenticatedUser(
        id=account["id"],
        email=account["email"],
        role=account["role"],
    )
    return LoginResponse(
        access_token=create_access_token(user),
        expires_in=settings.auth_token_ttl_seconds,
        user=user,
    )


@router.get("/me", response_model=AuthenticatedUser, summary="Return the authenticated user")
def read_current_user(
    current_user: Annotated[AuthenticatedUser, Depends(get_authenticated_user)],
) -> AuthenticatedUser:
    return current_user
