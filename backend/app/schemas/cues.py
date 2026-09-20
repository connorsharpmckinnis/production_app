from pydantic import BaseModel, Field

from app.schemas.prep import OptionalAttachmentStatus, PrepRecordResponse


class CueCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class CueCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class CueCategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None


class CueCreate(OptionalAttachmentStatus):
    cue_category_id: int
    title: str = Field(min_length=1, max_length=255)
    notes: str | None = None
    payload: dict | None = None


class CueUpdate(BaseModel):
    cue_category_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None
    payload: dict | None = None


class CueResponse(PrepRecordResponse):
    id: int
    cue_category_id: int
    cue_category_name: str
    title: str
    notes: str | None
    payload: dict | None
