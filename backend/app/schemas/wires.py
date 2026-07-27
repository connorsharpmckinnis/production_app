from pydantic import BaseModel, Field


class WireCreate(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    notes: str | None = None


class WireUpdate(BaseModel):
    identifier: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None


class WireResponse(BaseModel):
    id: int
    identifier: str
    notes: str | None
