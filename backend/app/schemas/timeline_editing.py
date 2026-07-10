from pydantic import BaseModel, ConfigDict


class MomentTypeResponse(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class MomentUpdate(BaseModel):
    moment_type_id: int | None = None
    parsed_text: str | None = None
    song_id: int | None = None

    model_config = ConfigDict(extra="forbid")


class DialogueUpdate(BaseModel):
    character_id: int | None = None
    dialogue_text: str | None = None

    model_config = ConfigDict(extra="forbid")


class StageDirectionUpdate(BaseModel):
    direction_text: str | None = None

    model_config = ConfigDict(extra="forbid")
