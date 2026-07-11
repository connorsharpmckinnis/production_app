from pydantic import BaseModel, Field


class OnStageCharacterResponse(BaseModel):
    id: int
    name: str


class MomentEntranceCreate(BaseModel):
    character_id: int
    notes: str | None = None


class MomentEntranceResponse(BaseModel):
    id: int
    character_id: int
    character_name: str
    notes: str | None


class MomentExitCreate(BaseModel):
    character_id: int
    notes: str | None = None


class MomentExitResponse(BaseModel):
    id: int
    character_id: int
    character_name: str
    notes: str | None


class MomentBlockingCreate(BaseModel):
    character_id: int
    notes: str = Field(min_length=1)


class MomentBlockingUpdate(BaseModel):
    notes: str = Field(min_length=1)


class MomentBlockingResponse(BaseModel):
    id: int
    character_id: int
    character_name: str
    notes: str
