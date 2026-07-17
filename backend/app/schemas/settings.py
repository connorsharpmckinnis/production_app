from pydantic import BaseModel, ConfigDict, field_validator

from app.db.encouragement_defaults import (
    ROTATION_MAX_SECONDS,
    ROTATION_MIN_SECONDS,
    is_valid_rotation_seconds,
)


class AppSettingsResponse(BaseModel):
    show_original_text: bool
    show_parsed_text: bool
    default_message_rotation_seconds: int

    model_config = ConfigDict(from_attributes=True)


class AppSettingsUpdate(BaseModel):
    show_original_text: bool | None = None
    show_parsed_text: bool | None = None
    default_message_rotation_seconds: int | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("default_message_rotation_seconds")
    @classmethod
    def validate_default_rotation(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if not is_valid_rotation_seconds(value):
            raise ValueError(
                f"rotation_seconds must be 0 (off) or "
                f"{ROTATION_MIN_SECONDS}–{ROTATION_MAX_SECONDS}"
            )
        return value
