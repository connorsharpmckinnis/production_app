from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Moment(Base):
    __tablename__ = "moments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    scene_id: Mapped[int] = mapped_column(
        ForeignKey("scenes.id"),
        nullable=False,
        index=True,
    )
    moment_type_id: Mapped[int] = mapped_column(
        ForeignKey("moment_types.id"),
        nullable=False,
        index=True,
    )
    song_id: Mapped[int | None] = mapped_column(
        ForeignKey("songs.id"),
        nullable=True,
        index=True,
    )
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_text: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    scene: Mapped["Scene"] = relationship(back_populates="moments")
    moment_type: Mapped["MomentType"] = relationship(back_populates="moments")
    song: Mapped["Song | None"] = relationship(back_populates="moments")
    dialogue_lines: Mapped[list["Dialogue"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    lyric_lines: Mapped[list["LyricLine"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    song_attribution_characters: Mapped[list["SongAttributionCharacter"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    stage_directions: Mapped[list["StageDirection"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    notes: Mapped[list["Note"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    moment_prop_events: Mapped[list["MomentPropEvent"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    cues: Mapped[list["Cue"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    moment_set_piece_events: Mapped[list["MomentSetPieceEvent"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    moment_costume_events: Mapped[list["MomentCostumeEvent"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    moment_entrances: Mapped[list["MomentEntrance"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    moment_exits: Mapped[list["MomentExit"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
    moment_blocking: Mapped[list["MomentBlocking"]] = relationship(
        back_populates="moment",
        cascade="all, delete-orphan",
    )
