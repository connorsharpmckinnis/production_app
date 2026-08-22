from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
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
    notes: Mapped[list["RehearsalNote"]] = relationship(
        back_populates="rehearsal",
        cascade="all, delete-orphan",
        order_by="RehearsalNote.created_at",
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
    scenes: Mapped[list["Scene"]] = relationship(
        secondary="rehearsal_block_scenes",
        back_populates="rehearsal_blocks",
    )
    calls: Mapped[list["RehearsalBlockCall"]] = relationship(
        back_populates="block",
        cascade="all, delete-orphan",
    )


class RehearsalBlockScene(Base):
    __tablename__ = "rehearsal_block_scenes"
    __table_args__ = (
        UniqueConstraint(
            "block_id",
            "scene_id",
            name="uq_rehearsal_block_scenes_block_scene",
        ),
    )

    block_id: Mapped[int] = mapped_column(
        ForeignKey("rehearsal_blocks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    scene_id: Mapped[int] = mapped_column(
        ForeignKey("scenes.id", ondelete="CASCADE"),
        primary_key=True,
    )


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


class RehearsalNote(Base):
    __tablename__ = "rehearsal_notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rehearsal_id: Mapped[int] = mapped_column(
        ForeignKey("rehearsals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
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

    rehearsal: Mapped["Rehearsal"] = relationship(back_populates="notes")
    author: Mapped["User"] = relationship()
