from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LavPackAssignment(Base):
    """Per-scene pack wear for a lav-chart row (actor or uncast character)."""

    __tablename__ = "lav_pack_assignments"
    __table_args__ = (
        CheckConstraint(
            "(user_id IS NOT NULL AND character_id IS NULL) OR "
            "(user_id IS NULL AND character_id IS NOT NULL)",
            name="ck_lav_pack_assignments_wearer",
        ),
        UniqueConstraint(
            "production_id",
            "scene_id",
            "user_id",
            name="uq_lav_pack_assignments_prod_scene_user",
        ),
        UniqueConstraint(
            "production_id",
            "scene_id",
            "character_id",
            name="uq_lav_pack_assignments_prod_scene_character",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id"),
        nullable=False,
        index=True,
    )
    scene_id: Mapped[int] = mapped_column(
        ForeignKey("scenes.id"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    character_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id"),
        nullable=True,
        index=True,
    )
    pack_id: Mapped[int | None] = mapped_column(
        ForeignKey("packs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    production: Mapped["Production"] = relationship(back_populates="lav_pack_assignments")
    scene: Mapped["Scene"] = relationship()
    user: Mapped["User | None"] = relationship()
    character: Mapped["Character | None"] = relationship()
    pack: Mapped["Pack | None"] = relationship(back_populates="lav_assignments")
