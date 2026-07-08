from sqlalchemy import ForeignKey, String, Text
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

    production: Mapped["Production"] = relationship(back_populates="songs")
    moments: Mapped[list["Moment"]] = relationship(back_populates="song")
