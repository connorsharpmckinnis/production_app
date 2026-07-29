from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Costume(Base):
    __tablename__ = "costumes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id"),
        nullable=False,
        index=True,
    )
    character_id: Mapped[int] = mapped_column(
        ForeignKey("characters.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    production: Mapped["Production"] = relationship(back_populates="costumes")
    character: Mapped["Character"] = relationship(back_populates="costumes")
    moment_events: Mapped[list["MomentCostumeEvent"]] = relationship(
        back_populates="costume",
        cascade="all, delete-orphan",
    )
