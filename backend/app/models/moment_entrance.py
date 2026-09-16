from sqlalchemy import CheckConstraint, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MomentEntrance(Base):
    __tablename__ = "moment_entrances"
    __table_args__ = (
        CheckConstraint(
            "(character_id IS NOT NULL AND group_id IS NULL) OR "
            "(character_id IS NULL AND group_id IS NOT NULL)",
            name="ck_moment_entrances_character_xor_group",
        ),
        UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_moment_entrances_moment_id_character_id",
        ),
        UniqueConstraint(
            "moment_id",
            "group_id",
            name="uq_moment_entrances_moment_id_group_id",
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
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    moment: Mapped["Moment"] = relationship(back_populates="moment_entrances")
    character: Mapped["Character | None"] = relationship(back_populates="moment_entrances")
    group: Mapped["Group | None"] = relationship(back_populates="moment_entrances")
