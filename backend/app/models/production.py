from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Production(Base):
    __tablename__ = "productions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    season: Mapped[str | None] = mapped_column(String(100), nullable=True)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Null inherits app_settings.default_message_rotation_seconds.
    message_rotation_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
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

    organization: Mapped["Organization"] = relationship(back_populates="productions")
    acts: Mapped[list["Act"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    characters: Mapped[list["Character"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    songs: Mapped[list["Song"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    groups: Mapped[list["Group"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    props: Mapped[list["Prop"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    cue_categories: Mapped[list["CueCategory"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    costumes: Mapped[list["Costume"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    wires: Mapped[list["Wire"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    packs: Mapped[list["Pack"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    lav_wire_assignments: Mapped[list["LavWireAssignment"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    lav_pack_assignments: Mapped[list["LavPackAssignment"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    lav_row_locks: Mapped[list["LavRowLock"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    set_pieces: Mapped[list["SetPiece"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    overview_messages: Mapped[list["ProductionOverviewMessage"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
    rehearsals: Mapped[list["Rehearsal"]] = relationship(
        back_populates="production",
        cascade="all, delete-orphan",
    )
