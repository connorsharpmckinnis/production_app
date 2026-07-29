from typing import Literal

from pydantic import BaseModel, Field, model_validator


class CostumeCreate(BaseModel):
    character_id: int
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class CostumeUpdate(BaseModel):
    character_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class CostumeResponse(BaseModel):
    id: int
    character_id: int
    character_name: str
    name: str
    description: str | None


class MomentCostumeEventCreate(BaseModel):
    character_id: int
    kind: Literal["on", "off"]
    costume_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_costume_required_for_on(self) -> "MomentCostumeEventCreate":
        if self.kind == "on" and self.costume_id is None:
            raise ValueError("costume_id is required when kind is 'on'")
        return self


class MomentCostumeEventUpdate(BaseModel):
    """Full replace of the mutable fields on a costume event.

    There is no partial "just clear the costume" shortcut — send the whole
    intended state (kind, costume, notes) the same way Create does.
    """

    kind: Literal["on", "off"]
    costume_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_costume_required_for_on(self) -> "MomentCostumeEventUpdate":
        if self.kind == "on" and self.costume_id is None:
            raise ValueError("costume_id is required when kind is 'on'")
        return self


class MomentCostumeEventResponse(BaseModel):
    id: int
    character_id: int
    character_name: str
    kind: str
    costume_id: int | None
    costume_name: str | None
    notes: str | None


class CostumeWearingResponse(BaseModel):
    """Derived: what a character is currently wearing as of a given Moment."""

    character_id: int
    character_name: str
    costume_id: int
    costume_name: str
    notes: str | None
