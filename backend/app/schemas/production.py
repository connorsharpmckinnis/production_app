from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.overview_messages import SpotlightMessage


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


class ReadinessDimension(BaseModel):
    key: str
    label: str
    score: int | None
    summary: str
    href_hint: str
    gaps: list[str] = Field(default_factory=list)


class ProductionOverviewResponse(BaseModel):
    id: int
    title: str
    season: str | None
    author: str | None
    created_at: datetime
    imported_at: datetime | None
    act_count: int
    scene_count: int
    moment_count: int
    character_count: int
    cast_count: int
    readiness_percent: int | None
    dimensions: list[ReadinessDimension]
    readiness_band: str
    rotation_seconds: int
    spotlight: list[SpotlightMessage]


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
