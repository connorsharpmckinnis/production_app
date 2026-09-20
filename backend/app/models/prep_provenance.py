"""Shared columns for Timeline attachments that can be suggested and approved."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column


class PrepProvenanceMixin:
    """Author, timestamps, rehearsal stamp, and suggested/official status.

    Existing rows backfill to ``official`` with null authors. ``created_by_user_id``
    is separate from any subject ``user_id`` on blocking or asset events.
    """

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="official",
        server_default="official",
    )
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    rehearsal_id: Mapped[int | None] = mapped_column(
        ForeignKey("rehearsals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
