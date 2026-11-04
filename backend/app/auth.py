"""Nurse authentication against the demo account table."""

import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBasic, HTTPBearer, HTTPBasicCredentials
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.checkup import Account
from app.services.auth import decode_access_token

basic_auth = HTTPBasic(auto_error=False)
bearer_auth = HTTPBearer(auto_error=False)


def require_nurse(
    credentials: HTTPBasicCredentials | None = Depends(basic_auth),
    token: HTTPAuthorizationCredentials | None = Depends(bearer_auth),
    db: Session = Depends(get_db),
) -> str:
    if token is not None and token.scheme.casefold() == "bearer":
        user = decode_access_token(token.credentials)
        if not secrets.compare_digest(user.role, "nurse"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Nurse accounts can access checkup records.",
            )
        account = db.scalar(select(Account).where(Account.id == user.id, Account.role == "nurse"))
        if account is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nurse account is unavailable. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return account.id

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid Nurse credentials are required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    account = db.scalar(
        select(Account).where(
            or_(Account.id == credentials.username, Account.email == credentials.username)
        )
    )
    password_matches = False
    if account is not None:
        # Password hashes are created with PostgreSQL pgcrypto's bcrypt crypt().
        password_matches = bool(
            db.scalar(select(func.crypt(credentials.password, account.password_hash) == account.password_hash))
        )
    # Keep the role check separate from password verification so the database
    # never authorizes based on client-supplied role information.
    if account is None or not password_matches or not secrets.compare_digest(account.role, "nurse"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid Nurse credentials are required.",
            headers={"WWW-Authenticate": "Basic"},
        )
    return account.id
