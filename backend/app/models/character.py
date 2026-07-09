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
    dialogue_lines: Mapped[list["Dialogue"]] = relationship(back_populates="character")
    actor_assignment: Mapped["UserCharacterAssignment | None"] = relationship(
        back_populates="character",
        uselist=False,
    )
    notes: Mapped[list["Note"]] = relationship(back_populates="character")
    groups: Mapped[list["Group"]] = relationship(
        secondary="character_groups",
        back_populates="characters",
    )
