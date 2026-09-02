from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Announcement(Base):
    """Authored broadcast: org-wide or production-scoped, with optional banner/modal."""

    __tablename__ = "announcements"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('info', 'success', 'warning', 'urgent')",
            name="ck_announcements_severity",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="info")
    show_as_banner: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    show_as_modal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    production_id: Mapped[int | None] = mapped_column(
        ForeignKey("productions.id"),
        nullable=True,
        index=True,
    )
    # Optional path segment filter for banners, e.g. "rehearse" or "timeline".
    # Null means all pages in the announcement's scope.
    route_filter: Mapped[str | None] = mapped_column(String(64), nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    production: Mapped["Production | None"] = relationship(back_populates="announcements")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_user_id])
    ctas: Mapped[list["AnnouncementCta"]] = relationship(
        back_populates="announcement",
        cascade="all, delete-orphan",
        order_by="AnnouncementCta.sort_order",
    )
    audience_roles: Mapped[list["AnnouncementAudienceRole"]] = relationship(
        back_populates="announcement",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="announcement",
    )


class AnnouncementCta(Base):
    __tablename__ = "announcement_ctas"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('internal', 'external')",
            name="ck_announcement_ctas_kind",
        ),
        CheckConstraint(
            "style IN ('primary', 'secondary', 'link')",
            name="ck_announcement_ctas_style",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    announcement_id: Mapped[int] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    target: Mapped[str] = mapped_column(String(1000), nullable=False)
    style: Mapped[str] = mapped_column(String(16), nullable=False, default="primary")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    announcement: Mapped["Announcement"] = relationship(back_populates="ctas")


class AnnouncementAudienceRole(Base):
    __tablename__ = "announcement_audience_roles"
    __table_args__ = (
        UniqueConstraint(
            "announcement_id",
            "role_name",
            name="uq_announcement_audience_roles_announcement_role",
        ),
        CheckConstraint(
            "role_name IN ('Admin', 'Director', 'Actor', 'Member')",
            name="ck_announcement_audience_roles_role_name",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    announcement_id: Mapped[int] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_name: Mapped[str] = mapped_column(String(32), nullable=False)

    announcement: Mapped["Announcement"] = relationship(back_populates="audience_roles")
