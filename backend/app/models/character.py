from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    production: Mapped["Production"] = relationship(back_populates="characters")
    # passive_deletes: catalog delete remaps these FKs in SQL first. Without it,
    # ORM parent-delete sync NULLs nullable XOR character_ids and violates CHECK.
    dialogue_lines: Mapped[list["Dialogue"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    lyric_lines: Mapped[list["LyricLine"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    song_attribution_characters: Mapped[list["SongAttributionCharacter"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    actor_assignment: Mapped["UserCharacterAssignment | None"] = relationship(
        back_populates="character",
        uselist=False,
        cascade="all, delete-orphan",
    )
    notes: Mapped[list["Note"]] = relationship(
        back_populates="character",
        cascade="all, delete-orphan",
    )
    groups: Mapped[list["Group"]] = relationship(
        secondary="character_groups",
        back_populates="characters",
    )
    moment_prop_events: Mapped[list["MomentPropEvent"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    moment_set_piece_events: Mapped[list["MomentSetPieceEvent"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    moment_costume_events: Mapped[list["MomentCostumeEvent"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    costumes: Mapped[list["Costume"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    moment_entrances: Mapped[list["MomentEntrance"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    moment_exits: Mapped[list["MomentExit"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
    moment_blocking: Mapped[list["MomentBlocking"]] = relationship(
        back_populates="character",
        passive_deletes=True,
    )
