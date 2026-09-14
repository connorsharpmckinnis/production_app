from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SongAttributionCharacter(Base):
    """Performer subject on a song_attribution Moment (Character or Group)."""

    __tablename__ = "song_attribution_characters"
    __table_args__ = (
        CheckConstraint(
            "(character_id IS NOT NULL AND group_id IS NULL) OR "
            "(character_id IS NULL AND group_id IS NOT NULL)",
            name="ck_song_attribution_characters_exactly_one_subject",
        ),
        UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_song_attribution_characters_moment_character",
        ),
        UniqueConstraint(
            "moment_id",
            "group_id",
            name="uq_song_attribution_characters_moment_id_group_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    moment_id: Mapped[int] = mapped_column(
        ForeignKey("moments.id"),
        nullable=False,
        index=True,
    )
    character_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id"),
        nullable=True,
        index=True,
    )
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id"),
        nullable=True,
        index=True,
    )

    moment: Mapped["Moment"] = relationship(back_populates="song_attribution_characters")
    character: Mapped["Character | None"] = relationship(
        back_populates="song_attribution_characters",
    )
    group: Mapped["Group | None"] = relationship()
