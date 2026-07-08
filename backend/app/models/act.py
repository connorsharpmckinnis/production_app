from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Act(Base):
    __tablename__ = "acts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id"),
        nullable=False,
        index=True,
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)

    production: Mapped["Production"] = relationship(back_populates="acts")
    scenes: Mapped[list["Scene"]] = relationship(back_populates="act")
