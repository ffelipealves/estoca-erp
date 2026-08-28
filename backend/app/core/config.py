from __future__ import annotations

from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import PositiveInt, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Estoca"
    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+asyncpg://estoca:estoca@postgres:5432/estoca"

    cors_origins: str = "http://localhost:3000"

    session_cookie_name: str = "estoca_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    session_inactivity_minutes: PositiveInt = 120
    session_max_age_hours: PositiveInt = 24

    jwt_secret: SecretStr = SecretStr("development-only-jwt-secret-change-me")
    jwt_algorithm: Literal["HS256"] = "HS256"
    jwt_expiration_minutes: PositiveInt = 120

    cron_secret: SecretStr = SecretStr("development-only-cron-secret-change-me")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value

        parts = urlsplit(value)
        if parts.scheme not in {"postgres", "postgresql", "postgresql+asyncpg"}:
            return value

        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        ssl_mode = query.pop("sslmode", None)
        query.pop("channel_binding", None)
        if ssl_mode and "ssl" not in query:
            query["ssl"] = ssl_mode

        return urlunsplit(
            (
                "postgresql+asyncpg",
                parts.netloc,
                parts.path,
                urlencode(query),
                parts.fragment,
            )
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]

    @model_validator(mode="after")
    def validate_security_settings(self) -> Settings:
        if self.session_cookie_samesite == "none" and not self.session_cookie_secure:
            raise ValueError("SameSite=None requires a secure session cookie")

        secret_values = {
            self.jwt_secret.get_secret_value(),
            self.cron_secret.get_secret_value(),
        }
        if any(len(secret) < 32 for secret in secret_values):
            raise ValueError(
                "JWT_SECRET and CRON_SECRET must have at least 32 characters"
            )

        if self.environment == "production":
            development_secrets = {
                "development-only-jwt-secret-change-me",
                "development-only-cron-secret-change-me",
            }
            if development_secrets & secret_values:
                raise ValueError(
                    "Production requires explicit JWT_SECRET and CRON_SECRET"
                )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
