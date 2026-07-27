from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Wire(Base):
    __tablename__ = "wires"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id"),
        nullable=False,
        index=True,
    )
    identifier: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    production: Mapped["Production"] = relationship(back_populates="wires")
    lav_assignments: Mapped[list["LavWireAssignment"]] = relationship(
        back_populates="wire",
    )
