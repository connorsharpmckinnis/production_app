"""API schemas for the rules-based suggestion engine."""

from pydantic import BaseModel, Field


class SuggestionSubjectResponse(BaseModel):
    kind: str  # "character" | "group"
    id: int
    name: str


class SuggestionActionResponse(BaseModel):
    kind: str  # e.g. "create_entrance"
    moment_id: int
    character_id: int | None = None
    group_id: int | None = None
    user_id: int | None = None
    notes: str | None = None


class SuggestionResponse(BaseModel):
    fingerprint: str
    rule_id: str
    severity: str = "info"
    title: str
    rationale: str
    anchor_moment_id: int
    speaking_moment_id: int | None = None
    scene_id: int
    subject: SuggestionSubjectResponse
    actions: list[SuggestionActionResponse] = Field(default_factory=list)
    dismissed: bool = False


class SuggestionFingerprintBody(BaseModel):
    fingerprint: str = Field(min_length=1, max_length=255)


class SuggestionAcceptResponse(BaseModel):
    fingerprint: str
    applied: bool
    detail: str | None = None
