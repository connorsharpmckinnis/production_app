from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MomentCostumeEvent(Base):
    """A costume change (wear/clear) for a character at a Moment (Phase 14 WP5).

    Thin sibling of MomentPropEvent / MomentSetPieceEvent: who is currently
    wearing what is not stored here — it is derived by walking these events
    in show order (see app/services/asset_state.py). Unlike props/set
    pieces, the wearer is always a character (no user option) and at most
    one event exists per (moment, character) — a character can only make
    one costume change per Moment.
    """

    __tablename__ = "moment_costume_events"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('on', 'off')",
            name="ck_moment_costume_events_kind",
        ),
        CheckConstraint(
            "(kind = 'off') OR (costume_id IS NOT NULL)",
            name="ck_moment_costume_events_on_requires_costume",
        ),
        UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_moment_costume_events_moment_id_character_id",
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
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    costume_id: Mapped[int | None] = mapped_column(
        ForeignKey("costumes.id"),
        nullable=True,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    moment: Mapped["Moment"] = relationship(back_populates="moment_costume_events")
    character: Mapped["Character"] = relationship(back_populates="moment_costume_events")
    costume: Mapped["Costume | None"] = relationship(back_populates="moment_events")
