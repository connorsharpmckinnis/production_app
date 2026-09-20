from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


NoteVisibility = Literal["public", "private"]


class NoteCreate(BaseModel):
    moment_id: int | None = None
    character_id: int | None = None
    rehearsal_id: int | None = None
    visibility: NoteVisibility = "private"
    content: str = Field(min_length=1)

    @model_validator(mode="after")
    def at_least_one_target(self) -> "NoteCreate":
        if self.moment_id is None and self.character_id is None and self.rehearsal_id is None:
            raise ValueError("Provide a moment_id, character_id, or rehearsal_id")
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
    rehearsal_id: int | None
    content: str
    created_at: datetime
    updated_at: datetime | None = None
    updated_by_display_name: str | None = None
    is_mine: bool
    scene_id: int | None = None
