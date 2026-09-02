from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ProductionRole(Base):
    """Reusable role definition assigned to a user within a production."""

    __tablename__ = "production_roles"
    __table_args__ = (
        UniqueConstraint("code", name="uq_production_roles_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    membership_roles: Mapped[list["ProductionMembershipRole"]] = relationship(
        back_populates="production_role",
        passive_deletes=True,
    )
    memberships: Mapped[list["ProductionMembership"]] = relationship(
        secondary="production_membership_roles",
        back_populates="production_roles",
        viewonly=True,
    )
    permissions: Mapped[list["ProductionRolePermission"]] = relationship(
        back_populates="production_role",
        passive_deletes=True,
    )


class ProductionRolePermission(Base):
    """One enabled/disabled CRUD capability for a production role."""

    __tablename__ = "production_role_permissions"
    __table_args__ = (
        CheckConstraint(
            "action IN ('read', 'create', 'update', 'delete')",
            name="ck_production_role_permissions_action",
        ),
        UniqueConstraint(
            "production_role_id",
            "resource",
            "action",
            name="uq_production_role_permissions_role_resource_action",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    production_role_id: Mapped[int] = mapped_column(
        ForeignKey("production_roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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

    production_role: Mapped["ProductionRole"] = relationship(back_populates="permissions")
