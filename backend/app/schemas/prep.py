from datetime import datetime
from typing import Literal

from pydantic import BaseModel

AttachmentStatus = Literal["suggested", "official"]


class OptionalAttachmentStatus(BaseModel):
    """Optional status on create. Omitted means the server picks the default."""

    status: AttachmentStatus | None = None


class PrepRecordResponse(BaseModel):
    status: str = "official"
    created_by_user_id: int | None = None
    created_by_display_name: str | None = None
    updated_by_user_id: int | None = None
    updated_by_display_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    rehearsal_id: int | None = None
    rehearsal_label: str | None = None
