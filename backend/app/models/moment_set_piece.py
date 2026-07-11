from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MomentSetPiece(Base):
    __tablename__ = "moment_set_pieces"
    __table_args__ = (
        UniqueConstraint(
            "moment_id",
            "set_piece_id",
            name="uq_moment_set_pieces_moment_id_set_piece_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    moment_id: Mapped[int] = mapped_column(
        ForeignKey("moments.id"),
        nullable=False,
        index=True,
    )
    set_piece_id: Mapped[int] = mapped_column(
        ForeignKey("set_pieces.id"),
        nullable=False,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    moment: Mapped["Moment"] = relationship(back_populates="moment_set_pieces")
    set_piece: Mapped["SetPiece"] = relationship(back_populates="moment_attachments")
