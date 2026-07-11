from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    act_id: Mapped[int] = mapped_column(
        ForeignKey("acts.id"),
        nullable=False,
        index=True,
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)

    act: Mapped["Act"] = relationship(back_populates="scenes")
    moments: Mapped[list["Moment"]] = relationship(
        back_populates="scene",
        cascade="all, delete-orphan",
    )
    costumes: Mapped[list["Costume"]] = relationship(back_populates="scene")
