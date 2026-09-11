from datetime import datetime

from pydantic import BaseModel, Field

from app.services.importer.profiles import ImportProfileDefinition


class ImportProfileResponse(ImportProfileDefinition):
    id: int
    is_builtin: bool
    created_at: datetime
    updated_at: datetime


class ImportProfileDuplicate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)

