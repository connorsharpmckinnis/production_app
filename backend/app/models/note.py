"""User annotation on a moment, character, or rehearsal."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Note(Base):
    """Annotation about a moment, a character, a rehearsal, or a moment during a rehearsal."""

    __tablename__ = "notes"
    __table_args__ = (
        CheckConstraint(
            "moment_id IS NOT NULL OR character_id IS NOT NULL OR rehearsal_id IS NOT NULL",
            name="ck_notes_has_target",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    visibility: Mapped[str] = mapped_column(String(20), nullable=False)
    moment_id: Mapped[int | None] = mapped_column(
        ForeignKey("moments.id"),
        nullable=True,
        index=True,
    )
    character_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id"),
        nullable=True,
        index=True,
    )
    rehearsal_id: Mapped[int | None] = mapped_column(
        ForeignKey("rehearsals.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
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
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    user: Mapped["User"] = relationship(
        back_populates="notes",
        foreign_keys=[user_id],
    )
    updated_by: Mapped["User | None"] = relationship(foreign_keys=[updated_by_user_id])
    moment: Mapped["Moment | None"] = relationship(back_populates="notes")
    character: Mapped["Character | None"] = relationship(back_populates="notes")
    rehearsal: Mapped["Rehearsal | None"] = relationship()
