from pydantic import BaseModel, Field


class MicrophoneCreate(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    notes: str | None = None


class MicrophoneUpdate(BaseModel):
    identifier: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None


class MicrophoneResponse(BaseModel):
    id: int
    identifier: str
    notes: str | None


class MomentMicrophoneCreate(BaseModel):
    microphone_id: int
    character_id: int | None = None
    notes: str | None = None


class MomentMicrophoneResponse(BaseModel):
    id: int
    microphone_id: int
    microphone_identifier: str
    character_id: int | None
    character_name: str | None
    notes: str | None
