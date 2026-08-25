from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known toy values that must never ship as prod secrets.
_DEFAULT_SECRET_KEY = "dev-secret-change-in-production-32chars"
_WEAK_ADMIN_PASSWORDS = frozenset({"admin", "password", "password123", "changeme"})

# Prefer repo-root .env (same file docker compose reads), then backend/.env.
_REPO_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
_BACKEND_ENV = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_REPO_ROOT_ENV, _BACKEND_ENV),
        env_file_encoding="utf-8",
        # Root .env also has Compose-only keys (POSTGRES_*), which Settings must ignore.
        extra="ignore",
    )

    DATABASE_URL: str = (
        "postgresql://production_app:production_app@127.0.0.1:5432/production_app"
    )
    SECRET_KEY: str = _DEFAULT_SECRET_KEY
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str | None = None
    ORG_NAME: str = "Default Organization"
    ENVIRONMENT: Literal["dev", "prod"] = "dev"
    # Comma-separated browser origins allowed to call the API (CORS).
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional: fine-grained PAT (or classic) with Issues: Read and write on GITHUB_REPO.
    GITHUB_TOKEN: str | None = None
    GITHUB_REPO: str = "connorsharpmckinnis/production_app"

    @field_validator("GITHUB_TOKEN", mode="before")
    @classmethod
    def empty_github_token_as_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def strip_cors(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    def cors_origin_list(self) -> list[str]:
        origins = [part.strip() for part in self.CORS_ORIGINS.split(",")]
        return [origin for origin in origins if origin]

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.ENVIRONMENT != "prod":
            return self
        if not self.ADMIN_PASSWORD:
            raise ValueError("ADMIN_PASSWORD is required when ENVIRONMENT=prod")
        if self.ADMIN_PASSWORD.lower() in _WEAK_ADMIN_PASSWORDS or len(self.ADMIN_PASSWORD) < 8:
            raise ValueError(
                "ADMIN_PASSWORD must be at least 8 characters and not a common default "
                "when ENVIRONMENT=prod"
            )
        if self.SECRET_KEY == _DEFAULT_SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY must be a unique value at least 32 characters "
                "(not the documented default) when ENVIRONMENT=prod"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
