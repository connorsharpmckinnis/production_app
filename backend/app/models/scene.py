from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Scene(Base):
    __tablename__ = "scenes"
    __table_args__ = (
        UniqueConstraint(
            "act_id",
            "number",
            name="uq_scenes_act_id_number",
        ),
    )

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
