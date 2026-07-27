from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LyricLine(Base):
    __tablename__ = "lyric_lines"

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
    lyric_text: Mapped[str] = mapped_column(Text, nullable=False)

    moment: Mapped["Moment"] = relationship(back_populates="lyric_lines")
    character: Mapped["Character"] = relationship(back_populates="lyric_lines")
