from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, status
from jwt import InvalidTokenError

from app.config import settings
from app.schemas.auth import AuthenticatedUser, UserRole


_ALLOWED_ROLES: frozenset[str] = frozenset({"admin", "nurse", "parent"})


def require_token_secret() -> str:
    secret = settings.auth_token_secret
    if not secret or len(secret.encode("utf-8")) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        )
    return secret


def verify_password(password: str, password_hash: str) -> bool:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        return False
    try:
        return bcrypt.checkpw(password_bytes, password_hash.encode("ascii"))
    except (UnicodeEncodeError, ValueError, TypeError):
        return False


def create_access_token(user: AuthenticatedUser) -> str:
    secret = require_token_secret()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.auth_token_ttl_seconds)
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "iss": settings.auth_token_issuer,
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str) -> AuthenticatedUser:
    secret = require_token_secret()
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer=settings.auth_token_issuer,
            options={"require": ["exp", "iat", "iss", "sub", "email", "role"]},
        )
        if payload.get("role") not in _ALLOWED_ROLES:
            raise InvalidTokenError("Invalid role")
        return AuthenticatedUser(
            id=payload["sub"],
            email=payload["email"],
            role=payload["role"],
        )
    except (InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def is_supported_role(role: str) -> bool:
    return role in _ALLOWED_ROLES


def parse_role(role: str) -> UserRole:
    if role not in _ALLOWED_ROLES:
        raise ValueError("Unsupported user role")
    return role  # type: ignore[return-value]
