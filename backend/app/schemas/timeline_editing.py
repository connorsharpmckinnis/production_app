from pydantic import BaseModel, ConfigDict, Field


class MomentTypeResponse(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class MomentCreate(BaseModel):
    sequence_number: int = Field(ge=1)
    moment_type_id: int
    original_text: str = Field(min_length=1)
    character_id: int | None = None

    model_config = ConfigDict(extra="forbid")


class MomentSequenceUpdate(BaseModel):
    sequence_number: int = Field(ge=1)

    model_config = ConfigDict(extra="forbid")


class MomentUpdate(BaseModel):
    moment_type_id: int | None = None
    parsed_text: str | None = None
    song_id: int | None = None
    force_type_change: bool = False

    model_config = ConfigDict(extra="forbid")


class DialogueUpdate(BaseModel):
    character_id: int | None = None
    dialogue_text: str | None = None

    model_config = ConfigDict(extra="forbid")


class StageDirectionUpdate(BaseModel):
    direction_text: str | None = None

    model_config = ConfigDict(extra="forbid")
