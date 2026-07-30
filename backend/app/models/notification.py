from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Notification(Base):
    """Per-user inbox row. Announcements fan out here; system events write directly."""

    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('announcement', 'system', 'mention', 'task_assigned')",
            name="ck_notifications_kind",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    production_id: Mapped[int | None] = mapped_column(
        ForeignKey("productions.id"),
        nullable=True,
        index=True,
    )
    announcement_id: Mapped[int | None] = mapped_column(
        ForeignKey("announcements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    resource_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deep_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    severity: Mapped[str | None] = mapped_column(String(16), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    actor: Mapped["User | None"] = relationship(foreign_keys=[actor_user_id])
    production: Mapped["Production | None"] = relationship()
    announcement: Mapped["Announcement | None"] = relationship(back_populates="notifications")
