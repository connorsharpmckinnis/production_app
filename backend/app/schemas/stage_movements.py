from pydantic import BaseModel, Field, model_validator


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
    character_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None
    notes: str = Field(min_length=1)

    @model_validator(mode="after")
    def _exactly_one_subject(self) -> "MomentBlockingCreate":
        subjects = [
            self.character_id is not None,
            self.user_id is not None,
            self.group_id is not None,
        ]
        if sum(subjects) != 1:
            raise ValueError(
                "Blocking must target exactly one of character, user, or group",
            )
        return self


class MomentBlockingUpdate(BaseModel):
    notes: str = Field(min_length=1)


class MomentBlockingResponse(BaseModel):
    id: int
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    group_id: int | None
    group_name: str | None
    notes: str
