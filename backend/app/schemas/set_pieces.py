from typing import Literal

from pydantic import BaseModel, Field, model_validator


def _reject_both_character_and_user(character_id: int | None, user_id: int | None) -> None:
    if character_id is not None and user_id is not None:
        raise ValueError("A set piece event can have a character or a user, not both")


class SetPieceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    mobile: bool = False
    description: str | None = None


class SetPieceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    mobile: bool | None = None
    description: str | None = None


class SetPieceResponse(BaseModel):
    id: int
    name: str
    mobile: bool
    description: str | None


class MomentSetPieceEventCreate(BaseModel):
    set_piece_id: int
    kind: Literal["on", "off"]
    character_id: int | None = None
    user_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_person(self) -> "MomentSetPieceEventCreate":
        _reject_both_character_and_user(self.character_id, self.user_id)
        return self


class MomentSetPieceEventUpdate(BaseModel):
    """Full replace of the mutable fields on a set piece event (see props schema note)."""

    kind: Literal["on", "off"]
    character_id: int | None = None
    user_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_person(self) -> "MomentSetPieceEventUpdate":
        _reject_both_character_and_user(self.character_id, self.user_id)
        return self


class MomentSetPieceEventResponse(BaseModel):
    id: int
    set_piece_id: int
    set_piece_name: str
    kind: str
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    notes: str | None


class SetPieceInPlayResponse(BaseModel):
    """Derived: where a set piece stands as of a given Moment."""

    set_piece_id: int
    set_piece_name: str
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    notes: str | None
