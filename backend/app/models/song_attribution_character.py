from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SongAttributionCharacter(Base):
    __tablename__ = "song_attribution_characters"
    __table_args__ = (
        UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_song_attribution_characters_moment_character",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    moment_id: Mapped[int] = mapped_column(
        ForeignKey("moments.id"),
        nullable=False,
        index=True,
    )
    character_id: Mapped[int] = mapped_column(
        ForeignKey("characters.id"),
        nullable=False,
        index=True,
    )

    moment: Mapped["Moment"] = relationship(back_populates="song_attribution_characters")
    character: Mapped["Character"] = relationship(
        back_populates="song_attribution_characters",
    )
