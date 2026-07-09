from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


NoteVisibility = Literal["public", "private"]


class NoteCreate(BaseModel):
    moment_id: int | None = None
    character_id: int | None = None
    visibility: NoteVisibility
    content: str = Field(min_length=1)

    @model_validator(mode="after")
    def exactly_one_target(self) -> "NoteCreate":
        has_moment = self.moment_id is not None
        has_character = self.character_id is not None
        if has_moment == has_character:
            raise ValueError("Provide exactly one of moment_id or character_id")
        return self


class NoteUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1)
    visibility: NoteVisibility | None = None


class NoteResponse(BaseModel):
    id: int
    user_id: int
    author_display_name: str
    visibility: NoteVisibility
    moment_id: int | None
    character_id: int | None
    content: str
    created_at: datetime
    is_mine: bool
