from datetime import datetime

from pydantic import BaseModel, Field


class BookmarkCreate(BaseModel):
    moment_id: int
    label: str | None = Field(default=None, max_length=255)


class BookmarkResponse(BaseModel):
    id: int
    moment_id: int
    label: str | None
    created_at: datetime
    production_id: int
    production_title: str
    scene_id: int
    act_number: int
    scene_number: int
    sequence_number: int
    moment_preview: str
