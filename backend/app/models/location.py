from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Location(Base):
    """Org-level rehearsal room / venue label (Main Stage, Dance Room, …)."""

    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "name",
            name="uq_locations_organization_id_name",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    organization: Mapped["Organization"] = relationship(back_populates="locations")
    rehearsals: Mapped[list["Rehearsal"]] = relationship(back_populates="location")
    blocks: Mapped[list["RehearsalBlock"]] = relationship(back_populates="location")
