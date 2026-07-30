from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PropCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    notes: str | None = None


class PropUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    notes: str | None = None


class PropResponse(BaseModel):
    id: int
    name: str
    description: str | None
    notes: str | None


def _reject_both_character_and_user(character_id: int | None, user_id: int | None) -> None:
    if character_id is not None and user_id is not None:
        raise ValueError("A prop event can have a character or a user, not both")


class MomentPropEventCreate(BaseModel):
    prop_id: int
    kind: Literal["on", "off"]
    character_id: int | None = None
    user_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_person(self) -> "MomentPropEventCreate":
        _reject_both_character_and_user(self.character_id, self.user_id)
        return self


class MomentPropEventUpdate(BaseModel):
    """Full replace of the mutable fields on a prop event.

    There is no partial "just clear the person" shortcut — send the whole
    intended state (kind, person, notes) the same way Create does.
    """

    kind: Literal["on", "off"]
    character_id: int | None = None
    user_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_person(self) -> "MomentPropEventUpdate":
        _reject_both_character_and_user(self.character_id, self.user_id)
        return self


class MomentPropEventResponse(BaseModel):
    id: int
    prop_id: int
    prop_name: str
    kind: str
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    notes: str | None


class PropInPlayResponse(BaseModel):
    """Derived: where a prop stands as of a given Moment."""

    prop_id: int
    prop_name: str
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    notes: str | None
    # Moment that last set this in-play state (last ON / future MOVE).
    source_moment_id: int
    source_scene_id: int
    source_act_number: int
    source_scene_number: int
    source_sequence_number: int
    # Next ON/OFF/MOVE after the viewed Moment, if any.
    next_change_moment_id: int | None = None
    next_change_scene_id: int | None = None
    next_change_act_number: int | None = None
    next_change_scene_number: int | None = None
    next_change_sequence_number: int | None = None
