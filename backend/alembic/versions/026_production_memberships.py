"""Add production memberships and scoped role capabilities.

Revision ID: 026
Revises: 025
Create Date: 2026-08-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Global Director/Actor assignments are replaced by production membership
    # roles. Remove only those legacy links and role definitions; Admin remains
    # the organization-wide role.
    op.execute(
        sa.text(
            "DELETE FROM user_app_roles "
            "WHERE app_role_id IN "
            "(SELECT id FROM app_roles WHERE name IN ('Director', 'Actor'))"
        )
    )
    op.execute(
        sa.text("DELETE FROM app_roles WHERE name IN ('Director', 'Actor')")
    )

    op.create_table(
        "production_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_production_roles_code"),
    )

    op.create_table(
        "production_memberships",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["production_id"],
            ["productions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "production_id",
            "user_id",
            name="uq_production_memberships_production_user",
        ),
    )
    op.create_index(
        "ix_production_memberships_production_id",
        "production_memberships",
        ["production_id"],
    )
    op.create_index(
        "ix_production_memberships_user_id",
        "production_memberships",
        ["user_id"],
    )

    op.create_table(
        "production_membership_roles",
        sa.Column("membership_id", sa.Integer(), nullable=False),
        sa.Column("production_role_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["membership_id"],
            ["production_memberships.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["production_role_id"],
            ["production_roles.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("membership_id", "production_role_id"),
    )
    op.create_index(
        "ix_production_membership_roles_membership_id",
        "production_membership_roles",
        ["membership_id"],
    )
    op.create_index(
        "ix_production_membership_roles_production_role_id",
        "production_membership_roles",
        ["production_role_id"],
    )

    op.create_table(
        "production_role_permissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_role_id", sa.Integer(), nullable=False),
        sa.Column("resource", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "action IN ('read', 'create', 'update', 'delete')",
            name="ck_production_role_permissions_action",
        ),
        sa.ForeignKeyConstraint(
            ["production_role_id"],
            ["production_roles.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "production_role_id",
            "resource",
            "action",
            name="uq_production_role_permissions_role_resource_action",
        ),
    )
    op.create_index(
        "ix_production_role_permissions_production_role_id",
        "production_role_permissions",
        ["production_role_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_production_role_permissions_production_role_id",
        table_name="production_role_permissions",
    )
    op.drop_table("production_role_permissions")
    op.drop_index(
        "ix_production_membership_roles_production_role_id",
        table_name="production_membership_roles",
    )
    op.drop_index(
        "ix_production_membership_roles_membership_id",
        table_name="production_membership_roles",
    )
    op.drop_table("production_membership_roles")
    op.drop_index(
        "ix_production_memberships_user_id",
        table_name="production_memberships",
    )
    op.drop_index(
        "ix_production_memberships_production_id",
        table_name="production_memberships",
    )
    op.drop_table("production_memberships")
    op.drop_table("production_roles")
