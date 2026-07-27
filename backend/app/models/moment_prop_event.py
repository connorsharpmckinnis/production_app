from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MomentPropEvent(Base):
    """An on/off change for a prop at a Moment (Phase 14).

    Whether a prop is currently in play — and who has it — is not stored
    here. It is derived by walking these events in show order. See
    app/services/asset_state.py for the derivation logic.
    """

    __tablename__ = "moment_prop_events"
    __table_args__ = (
        CheckConstraint(
            "(character_id IS NULL OR user_id IS NULL)",
            name="ck_moment_prop_events_person",
        ),
        CheckConstraint(
            "kind IN ('on', 'off')",
            name="ck_moment_prop_events_kind",
        ),
        UniqueConstraint(
            "moment_id",
            "prop_id",
            name="uq_moment_prop_events_moment_id_prop_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    moment_id: Mapped[int] = mapped_column(
        ForeignKey("moments.id"),
        nullable=False,
        index=True,
    )
    prop_id: Mapped[int] = mapped_column(
        ForeignKey("props.id"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
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
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    moment: Mapped["Moment"] = relationship(back_populates="moment_prop_events")
    prop: Mapped["Prop"] = relationship(back_populates="moment_events")
    character: Mapped["Character | None"] = relationship(back_populates="moment_prop_events")
    user: Mapped["User | None"] = relationship()
