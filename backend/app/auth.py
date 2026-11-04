"""Nurse authentication against the demo account table."""

import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.checkup import Account

basic_auth = HTTPBasic()


def require_nurse(
    credentials: HTTPBasicCredentials = Depends(basic_auth),
    db: Session = Depends(get_db),
) -> str:
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
