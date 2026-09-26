from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# kind
REHEARSAL_KIND_ALL_CALL = "all_call"
REHEARSAL_KIND_CALLED = "called"

# status
REHEARSAL_STATUS_SCHEDULED = "scheduled"
REHEARSAL_STATUS_PLANNED = "planned"
REHEARSAL_STATUS_PUBLISHED = "published"
REHEARSAL_STATUS_IN_PROGRESS = "in_progress"
REHEARSAL_STATUS_COMPLETED = "completed"
REHEARSAL_STATUS_CANCELLED = "cancelled"

REHEARSAL_KINDS = (REHEARSAL_KIND_ALL_CALL, REHEARSAL_KIND_CALLED)
REHEARSAL_STATUSES = (
    REHEARSAL_STATUS_SCHEDULED,
    REHEARSAL_STATUS_PLANNED,
    REHEARSAL_STATUS_PUBLISHED,
    REHEARSAL_STATUS_IN_PROGRESS,
    REHEARSAL_STATUS_COMPLETED,
    REHEARSAL_STATUS_CANCELLED,
)

# Statuses actors may see call details for
ACTOR_VISIBLE_STATUSES = (
    REHEARSAL_STATUS_PUBLISHED,
    REHEARSAL_STATUS_IN_PROGRESS,
    REHEARSAL_STATUS_COMPLETED,
)

# Typed work focus for block targets
REHEARSAL_FOCUS_DIALOG = "dialog"
REHEARSAL_FOCUS_MUSIC = "music"
REHEARSAL_FOCUS_CHOREO = "choreo"
REHEARSAL_FOCUSES = (
    REHEARSAL_FOCUS_DIALOG,
    REHEARSAL_FOCUS_MUSIC,
    REHEARSAL_FOCUS_CHOREO,
)
REHEARSAL_SONG_FOCUSES = (REHEARSAL_FOCUS_MUSIC, REHEARSAL_FOCUS_CHOREO)


class Rehearsal(Base):
    __tablename__ = "rehearsals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id"),
        nullable=False,
        index=True,
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default=REHEARSAL_KIND_CALLED)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=REHEARSAL_STATUS_SCHEDULED,
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id"),
        nullable=True,
        index=True,
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

    production: Mapped["Production"] = relationship(back_populates="rehearsals")
    location: Mapped["Location | None"] = relationship(back_populates="rehearsals")
    blocks: Mapped[list["RehearsalBlock"]] = relationship(
        back_populates="rehearsal",
        cascade="all, delete-orphan",
        order_by="RehearsalBlock.sort_order",
    )


class RehearsalBlock(Base):
    __tablename__ = "rehearsal_blocks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rehearsal_id: Mapped[int] = mapped_column(
        ForeignKey("rehearsals.id"),
        nullable=False,
        index=True,
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("locations.id"),
        nullable=True,
        index=True,
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    rehearsal: Mapped["Rehearsal"] = relationship(back_populates="blocks")
    location: Mapped["Location | None"] = relationship(back_populates="blocks")
    targets: Mapped[list["RehearsalBlockTarget"]] = relationship(
        back_populates="block",
        cascade="all, delete-orphan",
    )
    calls: Mapped[list["RehearsalBlockCall"]] = relationship(
        back_populates="block",
        cascade="all, delete-orphan",
    )


class RehearsalBlockTarget(Base):
    """What a block rehearses: scene dialog, or a song as music/choreo."""

    __tablename__ = "rehearsal_block_targets"
    __table_args__ = (
        CheckConstraint(
            "focus IN ('dialog', 'music', 'choreo')",
            name="ck_rehearsal_block_targets_focus",
        ),
        CheckConstraint(
            "(focus = 'dialog' AND scene_id IS NOT NULL AND song_id IS NULL) OR "
            "(focus IN ('music', 'choreo') AND song_id IS NOT NULL AND scene_id IS NULL)",
            name="ck_rehearsal_block_targets_focus_refs",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    block_id: Mapped[int] = mapped_column(
        ForeignKey("rehearsal_blocks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    focus: Mapped[str] = mapped_column(String(16), nullable=False)
    scene_id: Mapped[int | None] = mapped_column(
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    song_id: Mapped[int | None] = mapped_column(
        ForeignKey("songs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    block: Mapped["RehearsalBlock"] = relationship(back_populates="targets")
    scene: Mapped["Scene | None"] = relationship()
    song: Mapped["Song | None"] = relationship()


class RehearsalBlockCall(Base):
    __tablename__ = "rehearsal_block_calls"
    __table_args__ = (
        UniqueConstraint(
            "block_id",
            "user_id",
            name="uq_rehearsal_block_calls_block_user",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    block_id: Mapped[int] = mapped_column(
        ForeignKey("rehearsal_blocks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    block: Mapped["RehearsalBlock"] = relationship(back_populates="calls")
    user: Mapped["User"] = relationship()
