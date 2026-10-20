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


def _require_exactly_one_subject(
    character_id: int | None,
    user_id: int | None,
    group_id: int | None,
    *,
    label: str,
) -> None:
    subjects = [
        character_id is not None,
        user_id is not None,
        group_id is not None,
    ]
    if sum(subjects) != 1:
        raise ValueError(f"{label} must target exactly one of character, user, or group")


class MomentEntranceCreate(OptionalAttachmentStatus):
    character_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _exactly_one_subject(self) -> "MomentEntranceCreate":
        _require_exactly_one_subject(
            self.character_id,
            self.user_id,
            self.group_id,
            label="Entrance",
        )
        return self


class MomentEntranceUpdate(BaseModel):
    """Full replace of mutable entrance fields (same moment; no move)."""

    character_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _exactly_one_subject(self) -> "MomentEntranceUpdate":
        _require_exactly_one_subject(
            self.character_id,
            self.user_id,
            self.group_id,
            label="Entrance",
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
        _require_exactly_one_subject(
            self.character_id,
            self.user_id,
            self.group_id,
            label="Exit",
        )
        return self


class MomentExitUpdate(BaseModel):
    """Full replace of mutable exit fields (same moment; no move)."""

    character_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _exactly_one_subject(self) -> "MomentExitUpdate":
        _require_exactly_one_subject(
            self.character_id,
            self.user_id,
            self.group_id,
            label="Exit",
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
        _require_exactly_one_subject(
            self.character_id,
            self.user_id,
            self.group_id,
            label="Blocking",
        )
        return self


class MomentBlockingUpdate(BaseModel):
    """Update notes; optionally replace subject when exactly one subject id is sent."""

    notes: str = Field(min_length=1)
    character_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None

    @model_validator(mode="after")
    def _at_most_one_subject(self) -> "MomentBlockingUpdate":
        subjects = [
            self.character_id is not None,
            self.user_id is not None,
            self.group_id is not None,
        ]
        if sum(subjects) > 1:
            raise ValueError(
                "Blocking update may change at most one of character, user, or group",
            )
        return self


class MomentBlockingResponse(PrepRecordResponse):
    id: int
    character_id: int | None
    character_name: str | None
    user_id: int | None
    user_display_name: str | None
    group_id: int | None
    group_name: str | None
    notes: str
