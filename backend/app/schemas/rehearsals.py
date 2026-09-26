from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.rehearsal import (
    REHEARSAL_FOCUSES,
    REHEARSAL_FOCUS_DIALOG,
    REHEARSAL_KINDS,
    REHEARSAL_SONG_FOCUSES,
    REHEARSAL_STATUSES,
)


class LocationResponse(BaseModel):
    id: int
    name: str
    sort_order: int

    model_config = {"from_attributes": True}


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sort_order: int = 0


class RehearsalBlockTargetResponse(BaseModel):
    focus: str
    scene_id: int | None = None
    song_id: int | None = None
    scene_number: int | None = None
    scene_title: str | None = None
    act_number: int | None = None
    song_title: str | None = None
    times_rehearsed: int = 0
    label: str


class RehearsalBlockCallResponse(BaseModel):
    user_id: int
    display_name: str
    available: bool = True


class RehearsalBlockResponse(BaseModel):
    id: int
    starts_at: datetime
    ends_at: datetime
    location_id: int | None
    location_name: str | None
    label: str | None
    sort_order: int
    targets: list[RehearsalBlockTargetResponse]
    calls: list[RehearsalBlockCallResponse]
    double_book_user_ids: list[int] = []


class RehearsalNoteResponse(BaseModel):
    id: int
    author_user_id: int
    author_display_name: str
    content: str
    created_at: datetime
    updated_at: datetime


class RehearsalSummaryResponse(BaseModel):
    id: int
    starts_at: datetime
    ends_at: datetime
    kind: str
    status: str
    title: str | None
    location_id: int | None
    location_name: str | None
    block_count: int = 0


class RehearsalDetailResponse(BaseModel):
    id: int
    production_id: int
    starts_at: datetime
    ends_at: datetime
    kind: str
    status: str
    title: str | None
    location_id: int | None
    location_name: str | None
    blocks: list[RehearsalBlockResponse]
    notes: list[RehearsalNoteResponse] = []
    created_at: datetime
    updated_at: datetime


class RehearsalCreate(BaseModel):
    starts_at: datetime
    ends_at: datetime
    kind: str = "called"
    title: str | None = Field(default=None, max_length=255)
    location_id: int | None = None

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, value: str) -> str:
        if value not in REHEARSAL_KINDS:
            raise ValueError(f"kind must be one of {REHEARSAL_KINDS}")
        return value

    @model_validator(mode="after")
    def validate_times(self) -> "RehearsalCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class RehearsalUpdate(BaseModel):
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    kind: str | None = None
    title: str | None = Field(default=None, max_length=255)
    location_id: int | None = None

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, value: str | None) -> str | None:
        if value is not None and value not in REHEARSAL_KINDS:
            raise ValueError(f"kind must be one of {REHEARSAL_KINDS}")
        return value


class RehearsalBlockTargetWrite(BaseModel):
    focus: str
    scene_id: int | None = None
    song_id: int | None = None

    @field_validator("focus")
    @classmethod
    def validate_focus(cls, value: str) -> str:
        if value not in REHEARSAL_FOCUSES:
            raise ValueError(f"focus must be one of {REHEARSAL_FOCUSES}")
        return value

    @model_validator(mode="after")
    def validate_refs(self) -> "RehearsalBlockTargetWrite":
        if self.focus == REHEARSAL_FOCUS_DIALOG:
            if self.scene_id is None or self.song_id is not None:
                raise ValueError("dialog targets require scene_id and must not set song_id")
        elif self.focus in REHEARSAL_SONG_FOCUSES:
            if self.song_id is None or self.scene_id is not None:
                raise ValueError(
                    f"{self.focus} targets require song_id and must not set scene_id"
                )
        return self


class RehearsalBlockWrite(BaseModel):
    starts_at: datetime
    ends_at: datetime
    location_id: int | None = None
    label: str | None = Field(default=None, max_length=255)
    sort_order: int = 0
    targets: list[RehearsalBlockTargetWrite] = Field(default_factory=list)
    # Legacy: treated as dialog targets when targets is empty.
    scene_ids: list[int] = Field(default_factory=list)
    user_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_times_and_targets(self) -> "RehearsalBlockWrite":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        if not self.targets and self.scene_ids:
            self.targets = [
                RehearsalBlockTargetWrite(focus=REHEARSAL_FOCUS_DIALOG, scene_id=sid)
                for sid in self.scene_ids
            ]
        return self


class RehearsalPlanReplace(BaseModel):
    """Replace all blocks for a rehearsal (full plan save)."""

    blocks: list[RehearsalBlockWrite]
    mark_planned: bool = True


class RehearsalStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in REHEARSAL_STATUSES:
            raise ValueError(f"status must be one of {REHEARSAL_STATUSES}")
        return value


class RehearsalNoteCreate(BaseModel):
    content: str = Field(min_length=1)


class RehearsalNoteUpdate(BaseModel):
    content: str = Field(min_length=1)


class RehearsalActivityItem(BaseModel):
    kind: str
    id: int
    summary: str
    status: str | None = None
    visibility: str | None = None
    created_at: datetime
    created_by_display_name: str | None = None
    moment_id: int | None = None
    scene_id: int | None = None


class SuggestedCallResponse(BaseModel):
    user_id: int
    display_name: str
    character_names: list[str]
    available: bool = True


class RehearsalRecommendationResponse(BaseModel):
    focus: str
    scene_id: int | None = None
    song_id: int | None = None
    act_number: int | None = None
    number: int | None = None
    title: str | None = None
    times_rehearsed: int
    last_rehearsed_at: datetime | None
    label: str


class MyCallBlockResponse(BaseModel):
    block_id: int
    starts_at: datetime
    ends_at: datetime
    location_name: str | None
    label: str | None
    targets: list[RehearsalBlockTargetResponse]


class MyCallResponse(BaseModel):
    rehearsal_id: int
    starts_at: datetime
    ends_at: datetime
    kind: str
    status: str
    title: str | None
    location_name: str | None
    blocks: list[MyCallBlockResponse]
