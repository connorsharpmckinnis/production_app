from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MomentBlocking(Base):
    __tablename__ = "moment_blocking"
    __table_args__ = (
        UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_moment_blocking_moment_id_character_id",
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
    notes: Mapped[str] = mapped_column(Text, nullable=False)

    moment: Mapped["Moment"] = relationship(back_populates="moment_blocking")
    character: Mapped["Character"] = relationship(back_populates="moment_blocking")
