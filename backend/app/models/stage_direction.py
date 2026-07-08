from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StageDirection(Base):
    __tablename__ = "stage_directions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    moment_id: Mapped[int] = mapped_column(
        ForeignKey("moments.id"),
        nullable=False,
        index=True,
    )
    direction_text: Mapped[str] = mapped_column(Text, nullable=False)

    moment: Mapped["Moment"] = relationship(back_populates="stage_directions")
