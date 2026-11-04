"""Environment based application configuration."""

import os

from dotenv import load_dotenv
from sqlalchemy import URL


load_dotenv()


def _parse_origins(value: str | None) -> list[str]:
    if not value:
        return ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
    return [origin.strip() for origin in value.split(",") if origin.strip()]


class Settings:
    """Settings read from the process environment (and a local .env file)."""

    def __init__(self) -> None:
        self.database_url: str | URL | None = os.getenv("DATABASE_URL") or None
        postgres_host = os.getenv("POSTGRES_HOST")
        if self.database_url is None and postgres_host:
            self.database_url = URL.create(
                "postgresql+psycopg",
                host=postgres_host,
                database=os.environ["POSTGRES_DB"],
                username=os.environ["POSTGRES_USER"],
                password=os.environ["POSTGRES_PASSWORD"],
            )
        self.cors_origins: list[str] = _parse_origins(os.getenv("CORS_ORIGINS"))
        self.auth_token_secret = os.getenv("AUTH_TOKEN_SECRET") or None
        self.auth_token_issuer = os.getenv("AUTH_TOKEN_ISSUER", "schoolhealth-api")
        try:
            self.auth_token_ttl_seconds = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "3600"))
        except ValueError as exc:
            raise ValueError("AUTH_TOKEN_TTL_SECONDS must be an integer") from exc
        if not 60 <= self.auth_token_ttl_seconds <= 86_400:
            raise ValueError("AUTH_TOKEN_TTL_SECONDS must be between 60 and 86400")


settings = Settings()
