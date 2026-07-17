from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.db.encouragement_defaults import (
    ENCOURAGEMENT_BAND_SET,
    MESSAGE_KINDS,
    ROTATION_MAX_SECONDS,
    ROTATION_MIN_SECONDS,
    is_valid_rotation_seconds,
)


def _validate_rotation(value: int) -> int:
    if not is_valid_rotation_seconds(value):
        raise ValueError(
            f"rotation_seconds must be 0 (off) or {ROTATION_MIN_SECONDS}–{ROTATION_MAX_SECONDS}"
        )
    return value


class OverviewMessageDefaultItem(BaseModel):
    # Legacy field kept for API compatibility; spotlight no longer filters by band.
    band: str = "0"
    title: str | None = None
    body: str = Field(min_length=1)
    sort_order: int = 0
    active: bool = True

    model_config = ConfigDict(extra="forbid")

    @field_validator("band")
    @classmethod
    def validate_band(cls, value: str) -> str:
        if value not in ENCOURAGEMENT_BAND_SET:
            raise ValueError(
                f"band must be one of: {', '.join(sorted(ENCOURAGEMENT_BAND_SET))}"
            )
        return value


class OverviewMessageDefaultResponse(OverviewMessageDefaultItem):
    id: int

    model_config = ConfigDict(from_attributes=True)


class OverviewMessageDefaultsReplace(BaseModel):
    messages: list[OverviewMessageDefaultItem]

    model_config = ConfigDict(extra="forbid")


class ProductionOverviewMessageItem(BaseModel):
    kind: str
    # Legacy optional field for encouragement; spotlight ignores band filtering.
    band: str | None = None
    title: str | None = None
    body: str = Field(min_length=1)
    sort_order: int = 0
    active: bool = True

    model_config = ConfigDict(extra="forbid")

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, value: str) -> str:
        if value not in MESSAGE_KINDS:
            raise ValueError(f"kind must be one of: {', '.join(MESSAGE_KINDS)}")
        return value

    @model_validator(mode="after")
    def validate_band_for_kind(self) -> "ProductionOverviewMessageItem":
        if self.kind == "encouragement":
            if self.band is not None and self.band not in ENCOURAGEMENT_BAND_SET:
                raise ValueError(
                    "encouragement band must be one of: "
                    f"{', '.join(sorted(ENCOURAGEMENT_BAND_SET))}"
                )
        elif self.band is not None:
            raise ValueError(f"{self.kind} messages must not have a band")
        return self


class ProductionOverviewMessageResponse(ProductionOverviewMessageItem):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ProductionOverviewMessagesReplace(BaseModel):
    messages: list[ProductionOverviewMessageItem]

    model_config = ConfigDict(extra="forbid")


class ProductionOverviewSettingsResponse(BaseModel):
    message_rotation_seconds: int | None
    effective_rotation_seconds: int


class ProductionOverviewSettingsUpdate(BaseModel):
    # Required field: null clears the override (inherit global).
    message_rotation_seconds: int | None

    model_config = ConfigDict(extra="forbid")

    @field_validator("message_rotation_seconds")
    @classmethod
    def validate_production_rotation(cls, value: int | None) -> int | None:
        if value is None:
            return value
        return _validate_rotation(value)


class SpotlightMessage(BaseModel):
    kind: str
    band: str | None = None
    title: str | None = None
    body: str
    source: str
