from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ProductionMembership(Base):
    """A user's participation record for one production."""

    __tablename__ = "production_memberships"
    __table_args__ = (
        UniqueConstraint(
            "production_id",
            "user_id",
            name="uq_production_memberships_production_user",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_id: Mapped[int] = mapped_column(
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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

    production: Mapped["Production"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="production_memberships")
    membership_roles: Mapped[list["ProductionMembershipRole"]] = relationship(
        back_populates="membership",
        cascade="all, delete-orphan",
    )
    production_roles: Mapped[list["ProductionRole"]] = relationship(
        secondary="production_membership_roles",
        back_populates="memberships",
        viewonly=True,
    )


class ProductionMembershipRole(Base):
    """Assignment of one reusable production role to one membership."""

    __tablename__ = "production_membership_roles"

    membership_id: Mapped[int] = mapped_column(
        ForeignKey("production_memberships.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    production_role_id: Mapped[int] = mapped_column(
        ForeignKey("production_roles.id", ondelete="RESTRICT"),
        primary_key=True,
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

    membership: Mapped["ProductionMembership"] = relationship(
        back_populates="membership_roles",
    )
    production_role: Mapped["ProductionRole"] = relationship(
        back_populates="membership_roles",
    )
