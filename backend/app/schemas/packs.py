from pydantic import BaseModel, Field


class PackCreate(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    notes: str | None = None


class PackUpdate(BaseModel):
    identifier: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None


class PackResponse(BaseModel):
    id: int
    identifier: str
    notes: str | None
