from datetime import datetime

from pydantic import BaseModel, Field


class ProductionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    season: str | None = None


class ProductionResponse(BaseModel):
    id: int
    title: str
    season: str | None
    author: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ImportErrorResponse(BaseModel):
    line_number: int
    line_content: str
    message: str


class ImportSuccessResponse(BaseModel):
    acts_created: int
    scenes_created: int
    moments_created: int
    characters_created: int
    songs_created: int
