from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Song(Base):
    __tablename__ = "songs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    composer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lyricist: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    times_music_rehearsed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_music_rehearsed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    times_choreo_rehearsed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_choreo_rehearsed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    production: Mapped["Production"] = relationship(back_populates="songs")
    # Moments own the FK; do not cascade-delete lyrics when a song row is removed.
    moments: Mapped[list["Moment"]] = relationship(
        back_populates="song",
        passive_deletes=True,
    )
