from pydantic import BaseModel, Field


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


class MomentPropCreate(BaseModel):
    prop_id: int
    character_id: int | None = None
    notes: str | None = None


class MomentPropResponse(BaseModel):
    id: int
    prop_id: int
    prop_name: str
    character_id: int | None
    character_name: str | None
    notes: str | None
