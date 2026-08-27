from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import PositiveInt, SecretStr, model_validator
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

    jwt_secret: SecretStr = SecretStr("development-only-jwt-secret")
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: PositiveInt = 120

    cron_secret: SecretStr = SecretStr("development-only-cron-secret")

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @model_validator(mode="after")
    def validate_security_settings(self) -> Settings:
        if self.session_cookie_samesite == "none" and not self.session_cookie_secure:
            raise ValueError("SameSite=None requires a secure session cookie")

        if self.environment == "production":
            development_secrets = {
                "development-only-jwt-secret",
                "development-only-cron-secret",
            }
            configured_secrets = {
                self.jwt_secret.get_secret_value(),
                self.cron_secret.get_secret_value(),
            }
            if development_secrets & configured_secrets:
                raise ValueError("Production requires explicit JWT_SECRET and CRON_SECRET")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
