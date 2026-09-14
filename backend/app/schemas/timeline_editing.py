from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    group_id: int | None = None
    dialogue_text: str | None = None

    model_config = ConfigDict(extra="forbid")


class LyricUpdate(BaseModel):
    character_id: int | None = None
    group_id: int | None = None
    lyric_text: str | None = None

    model_config = ConfigDict(extra="forbid")


class StageDirectionUpdate(BaseModel):
    direction_text: str | None = None

    model_config = ConfigDict(extra="forbid")


class AttributionSubjectInput(BaseModel):
    """One Character or Group subject for a dialogue / lyric / song-attribution Moment."""

    character_id: int | None = None
    group_id: int | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def exactly_one_subject(self) -> "AttributionSubjectInput":
        if (self.character_id is None) == (self.group_id is None):
            raise ValueError("Provide exactly one of character_id or group_id")
        return self


class DialogueAttributionsReplace(BaseModel):
    subjects: list[AttributionSubjectInput] = Field(default_factory=list)
    dialogue_text: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


class LyricAttributionsReplace(BaseModel):
    subjects: list[AttributionSubjectInput] = Field(default_factory=list)
    lyric_text: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


class SongAttributionsReplace(BaseModel):
    subjects: list[AttributionSubjectInput] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")
