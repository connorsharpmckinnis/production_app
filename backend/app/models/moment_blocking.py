from sqlalchemy import CheckConstraint, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MomentBlocking(Base):
    __tablename__ = "moment_blocking"
    __table_args__ = (
        CheckConstraint(
            "(character_id IS NOT NULL AND user_id IS NULL AND group_id IS NULL) OR "
            "(character_id IS NULL AND user_id IS NOT NULL AND group_id IS NULL) OR "
            "(character_id IS NULL AND user_id IS NULL AND group_id IS NOT NULL)",
            name="ck_moment_blocking_exactly_one_subject",
        ),
        UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_moment_blocking_moment_id_character_id",
        ),
        UniqueConstraint(
            "moment_id",
            "user_id",
            name="uq_moment_blocking_moment_id_user_id",
        ),
        UniqueConstraint(
            "moment_id",
            "group_id",
            name="uq_moment_blocking_moment_id_group_id",
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
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id"),
        nullable=True,
        index=True,
    )
    notes: Mapped[str] = mapped_column(Text, nullable=False)

    moment: Mapped["Moment"] = relationship(back_populates="moment_blocking")
    character: Mapped["Character | None"] = relationship(back_populates="moment_blocking")
    user: Mapped["User | None"] = relationship()
    group: Mapped["Group | None"] = relationship()
