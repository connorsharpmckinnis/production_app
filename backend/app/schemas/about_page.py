from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AboutPageResponse(BaseModel):
    markdown: str | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class AboutPageUpdate(BaseModel):
    markdown: str = Field(min_length=1, max_length=200_000)

    model_config = ConfigDict(extra="forbid")


class AboutImageUploadResponse(BaseModel):
    id: str
    url: str
    markdown: str
