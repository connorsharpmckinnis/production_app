from pydantic import BaseModel

from app.schemas.cues import CueResponse
from app.schemas.microphones import MomentMicrophoneResponse
from app.schemas.notes import NoteResponse
from app.schemas.props import MomentPropResponse
from app.schemas.set_pieces import MomentSetPieceResponse
from app.schemas.stage_movements import (
    MomentBlockingResponse,
    MomentEntranceResponse,
    MomentExitResponse,
    OnStageCharacterResponse,
)


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
    id: int
    character_id: int
    character_name: str
    dialogue_text: str


class MomentSummary(BaseModel):
    id: int
    sequence_number: int
    moment_type: str
    original_text: str
    display_text: str
    song_id: int | None
    speaking_character_ids: list[int]
    has_props: bool
    has_cues: bool
    has_microphone: bool
    has_set_piece: bool
    has_costume: bool
    has_entrance: bool
    has_exit: bool
    has_blocking: bool

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
    props: list[MomentPropResponse]
    microphones: list[MomentMicrophoneResponse]
    set_pieces: list[MomentSetPieceResponse]
    entrances: list[MomentEntranceResponse]
    exits: list[MomentExitResponse]
    blocking: list[MomentBlockingResponse]
    on_stage_characters: list[OnStageCharacterResponse]
    cues: list[CueResponse]
    notes: list[NoteResponse]
    is_bookmarked: bool


class CharacterResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
