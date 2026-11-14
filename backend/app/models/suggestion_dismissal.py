"""Persisted instance dismissals for the rules-based suggestion engine."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SuggestionDismissal(Base):
    """One dismissed suggestion fingerprint per production."""

    __tablename__ = "suggestion_dismissals"
    __table_args__ = (
        UniqueConstraint(
            "production_id",
            "fingerprint",
            name="uq_suggestion_dismissals_prod_fingerprint",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fingerprint: Mapped[str] = mapped_column(String(255), nullable=False)
    dismissed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    production: Mapped["Production"] = relationship(
        back_populates="suggestion_dismissals"
    )
