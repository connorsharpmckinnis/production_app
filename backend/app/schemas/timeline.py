from pydantic import BaseModel

from app.schemas.notes import NoteResponse


class SceneSummary(BaseModel):
    id: int
    number: int
    title: str | None
    sort_order: int

    model_config = {"from_attributes": True}


class ActSummary(BaseModel):
    id: int
    number: int
    title: str
    sort_order: int
    scenes: list[SceneSummary]

    model_config = {"from_attributes": True}


class DialogueLineResponse(BaseModel):
    character_id: int
    character_name: str
    dialogue_text: str


class MomentSummary(BaseModel):
    id: int
    sequence_number: int
    moment_type: str
    original_text: str
    song_id: int | None
    speaking_character_ids: list[int]

    model_config = {"from_attributes": True}


class MomentDetailResponse(BaseModel):
    id: int
    sequence_number: int
    moment_type: str
    original_text: str
    parsed_text: str | None
    song_id: int | None
    song_title: str | None
    dialogue: list[DialogueLineResponse]
    stage_direction: str | None
    notes: list[NoteResponse]
    is_bookmarked: bool


class CharacterResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
