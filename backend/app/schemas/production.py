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
    # Derived from timeline Acts — not author metadata (imports may omit Author).
    has_imported_script: bool

    model_config = {"from_attributes": True}


class ProductionAccessResponse(BaseModel):
    production_id: int
    role_codes: list[str]
    capabilities: list[str]


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


class ImportIssueResponse(BaseModel):
    line_number: int
    line_content: str
    message: str
    kind: str = "line"
    source_format: str | None = None
    paragraph_number: int | None = None
    paragraph_style: str | None = None
    context_snippet: str | None = None
    song_title: str | None = None


class ImportErrorResponse(BaseModel):
    message: str
    errors: list[ImportIssueResponse]


class ImportSuccessResponse(BaseModel):
    acts_created: int
    scenes_created: int
    moments_created: int
    characters_created: int
    songs_created: int


class ImportPreviewMomentResponse(BaseModel):
    type: str
    text: str
    page: int | None = None
    line_number: int | None = None
    speakers: list[str] = Field(default_factory=list)
    title: str | None = None
    x0: float | None = None
    y0: float | None = None
    x1: float | None = None


class ImportPreviewSceneResponse(BaseModel):
    number: int
    title: str | None = None
    moments: list[ImportPreviewMomentResponse]


class ImportPreviewActResponse(BaseModel):
    number: int
    title: str | None = None
    scenes: list[ImportPreviewSceneResponse]


class ImportPreviewWarningResponse(BaseModel):
    line_number: int
    message: str
    page: int | None = None


class ImportPreviewUnclassifiedResponse(BaseModel):
    line_number: int
    text: str
    page: int | None = None
    x0: float | None = None
    y0: float | None = None
    x1: float | None = None


class ImportPreviewWindowResponse(BaseModel):
    page_from: int | None
    page_to: int | None
    line_count: int


class ImportPreviewCountsResponse(BaseModel):
    acts: int
    scenes: int
    moments: int
    characters: int
    unclassified: int


class ImportPreviewResponse(BaseModel):
    source_format: str
    preview_window: ImportPreviewWindowResponse
    counts: ImportPreviewCountsResponse
    acts: list[ImportPreviewActResponse]
    warnings: list[ImportPreviewWarningResponse]
    unclassified: list[ImportPreviewUnclassifiedResponse]
