from typing import Literal

from pydantic import BaseModel, Field


class AssignedActorResponse(BaseModel):
    user_id: int
    display_name: str


class CatalogReassignTarget(BaseModel):
    type: Literal["character", "group"]
    id: int


class CatalogDeleteRequest(BaseModel):
    """Optional body for DELETE character/group when reassignment is required."""

    reassign_to: CatalogReassignTarget | None = None


class CatalogDeleteImpactResponse(BaseModel):
    reassignable: dict[str, int]
    character_only_blockers: dict[str, int]
    auto_removed: dict[str, int]
    requires_reassignment: bool
    can_delete_without_reassignment: bool


class CharacterDetailResponse(BaseModel):
    id: int
    name: str
    description: str | None
    scene_count: int
    assigned_actor: AssignedActorResponse | None


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class CharacterUpdate(BaseModel):
    description: str | None = None


class SongDetailResponse(BaseModel):
    id: int
    title: str
    composer: str | None
    lyricist: str | None
    description: str | None


class SongCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    composer: str | None = None
    lyricist: str | None = None
    description: str | None = None


class SongUpdate(BaseModel):
    composer: str | None = None
    lyricist: str | None = None
    description: str | None = None


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None
    character_ids: list[int]
    user_ids: list[int]


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class GroupMembershipUpdate(BaseModel):
    character_ids: list[int] | None = None
    user_ids: list[int] | None = None
