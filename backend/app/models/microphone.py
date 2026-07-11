from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Microphone(Base):
    __tablename__ = "microphones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id"),
        nullable=False,
        index=True,
    )
    identifier: Mapped[str] = mapped_column(String(255), nullable=False)

    production: Mapped["Production"] = relationship(back_populates="microphones")
    moment_attachments: Mapped[list["MomentMicrophone"]] = relationship(
        back_populates="microphone",
        cascade="all, delete-orphan",
    )
