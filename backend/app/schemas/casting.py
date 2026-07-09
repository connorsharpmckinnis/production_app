from pydantic import BaseModel, Field


class CastAssignmentResponse(BaseModel):
    character_id: int
    character_name: str
    user_id: int | None
    user_display_name: str | None


class CastCharacterRequest(BaseModel):
    user_id: int | None = None


class CastCharacterResponse(BaseModel):
    character_id: int
    user_id: int | None
    user_display_name: str | None


class CastableUserResponse(BaseModel):
    id: int
    display_name: str
