from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LavRowLock(Base):
    """Per-row lock on the lav chart (actor or uncast character row)."""

    __tablename__ = "lav_row_locks"
    __table_args__ = (
        UniqueConstraint(
            "production_id",
            "row_key",
            name="uq_lav_row_locks_prod_row_key",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_key: Mapped[str] = mapped_column(String(64), nullable=False)

    production: Mapped["Production"] = relationship(back_populates="lav_row_locks")
