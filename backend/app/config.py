from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/production_app"
    SECRET_KEY: str = "dev-secret-change-in-production-32chars"
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str | None = None
    ORG_NAME: str = "Default Organization"
    ENVIRONMENT: Literal["dev", "prod"] = "dev"

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.ENVIRONMENT == "prod" and not self.ADMIN_PASSWORD:
            raise ValueError("ADMIN_PASSWORD is required when ENVIRONMENT=prod")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
