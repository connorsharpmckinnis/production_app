from pydantic import BaseModel, Field


class AssignedActorResponse(BaseModel):
    user_id: int
    display_name: str


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
