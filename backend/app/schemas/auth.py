import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator


UserRole = Literal["admin", "nurse", "parent"]
EmailAddress = Annotated[str, StringConstraints(min_length=3, max_length=254, strip_whitespace=True)]
Password = Annotated[str, StringConstraints(min_length=1, max_length=1024)]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailAddress
    password: Password

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.casefold()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class AuthenticatedUser(BaseModel):
    id: str
    email: str
    role: UserRole


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: AuthenticatedUser
