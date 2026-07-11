from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MomentMicrophone(Base):
    __tablename__ = "moment_microphones"
    __table_args__ = (
        UniqueConstraint(
            "moment_id",
            "microphone_id",
            name="uq_moment_microphones_moment_id_microphone_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    moment_id: Mapped[int] = mapped_column(
        ForeignKey("moments.id"),
        nullable=False,
        index=True,
    )
    microphone_id: Mapped[int] = mapped_column(
        ForeignKey("microphones.id"),
        nullable=False,
        index=True,
    )
    character_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id"),
        nullable=True,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    moment: Mapped["Moment"] = relationship(back_populates="moment_microphones")
    microphone: Mapped["Microphone"] = relationship(back_populates="moment_attachments")
    character: Mapped["Character | None"] = relationship(back_populates="moment_microphones")
