from pydantic import BaseModel, Field


class CostumeCreate(BaseModel):
    character_id: int
    scene_id: int
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class CostumeUpdate(BaseModel):
    character_id: int | None = None
    scene_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class CostumeResponse(BaseModel):
    id: int
    character_id: int
    character_name: str
    scene_id: int
    scene_number: int
    scene_title: str | None
    name: str
    description: str | None
