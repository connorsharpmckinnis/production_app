from pydantic import BaseModel, Field, model_validator

from app.schemas.prep import OptionalAttachmentStatus, PrepRecordResponse


class OnStageCharacterResponse(BaseModel):
    id: int
    name: str


class OnStageGroupResponse(BaseModel):
    id: int
    name: str


class OnStageUserResponse(BaseModel):
    id: int
    name: str


class MomentEntranceCreate(OptionalAttachmentStatus):
    character_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _exactly_one_subject(self) -> "MomentEntranceCreate":
        subjects = [
            self.character_id is not None,
            self.user_id is not None,
            self.group_id is not None,
        ]
        if sum(subjects) != 1:
            raise ValueError(
                "Entrance must target exactly one of character, user, or group",
            )
        return self


class MomentEntranceResponse(PrepRecordResponse):
    id: int
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    group_id: int | None
    group_name: str | None
    notes: str | None


class MomentExitCreate(OptionalAttachmentStatus):
    character_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _exactly_one_subject(self) -> "MomentExitCreate":
        subjects = [
            self.character_id is not None,
            self.user_id is not None,
            self.group_id is not None,
        ]
        if sum(subjects) != 1:
            raise ValueError(
                "Exit must target exactly one of character, user, or group",
            )
        return self


class MomentExitResponse(PrepRecordResponse):
    id: int
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    group_id: int | None
    group_name: str | None
    notes: str | None


class MomentBlockingCreate(OptionalAttachmentStatus):
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


class MomentBlockingResponse(PrepRecordResponse):
    id: int
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    group_id: int | None
    group_name: str | None
    notes: str
