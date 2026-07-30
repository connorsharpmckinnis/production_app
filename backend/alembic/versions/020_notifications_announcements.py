"""Notifications + announcements (in-app bell, banners, modals).

Revision ID: 020
Revises: 019
Create Date: 2026-07-29

Adds announcements (authored broadcasts), CTAs, audience roles, and a
multi-kind per-user notifications feed. Future mention/task kinds plug into
notifications without a second inbox.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="info"),
        sa.Column("show_as_banner", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("show_as_modal", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("production_id", sa.Integer(), nullable=True),
        sa.Column("route_filter", sa.String(length=64), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "severity IN ('info', 'success', 'warning', 'urgent')",
            name="ck_announcements_severity",
        ),
    )
    op.create_index("ix_announcements_production_id", "announcements", ["production_id"])
    op.create_index(
        "ix_announcements_created_by_user_id", "announcements", ["created_by_user_id"]
    )

    op.create_table(
        "announcement_ctas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("announcement_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("target", sa.String(length=1000), nullable=False),
        sa.Column("style", sa.String(length=16), nullable=False, server_default="primary"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["announcement_id"], ["announcements.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "kind IN ('internal', 'external')",
            name="ck_announcement_ctas_kind",
        ),
        sa.CheckConstraint(
            "style IN ('primary', 'secondary', 'link')",
            name="ck_announcement_ctas_style",
        ),
    )
    op.create_index(
        "ix_announcement_ctas_announcement_id", "announcement_ctas", ["announcement_id"]
    )

    op.create_table(
        "announcement_audience_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("announcement_id", sa.Integer(), nullable=False),
        sa.Column("role_name", sa.String(length=32), nullable=False),
        sa.ForeignKeyConstraint(
            ["announcement_id"], ["announcements.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "announcement_id",
            "role_name",
            name="uq_announcement_audience_roles_announcement_role",
        ),
        sa.CheckConstraint(
            "role_name IN ('Admin', 'Director', 'Actor')",
            name="ck_announcement_audience_roles_role_name",
        ),
    )
    op.create_index(
        "ix_announcement_audience_roles_announcement_id",
        "announcement_audience_roles",
        ["announcement_id"],
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("production_id", sa.Integer(), nullable=True),
        sa.Column("announcement_id", sa.Integer(), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("resource_type", sa.String(length=64), nullable=True),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("deep_link", sa.String(length=500), nullable=True),
        sa.Column("severity", sa.String(length=16), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.ForeignKeyConstraint(
            ["announcement_id"], ["announcements.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "kind IN ('announcement', 'system', 'mention', 'task_assigned')",
            name="ck_notifications_kind",
        ),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_production_id", "notifications", ["production_id"])
    op.create_index(
        "ix_notifications_announcement_id", "notifications", ["announcement_id"]
    )
    op.create_index("ix_notifications_actor_user_id", "notifications", ["actor_user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index(
        "ix_notifications_user_id_read_at",
        "notifications",
        ["user_id", "read_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id_read_at", table_name="notifications")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_actor_user_id", table_name="notifications")
    op.drop_index("ix_notifications_announcement_id", table_name="notifications")
    op.drop_index("ix_notifications_production_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index(
        "ix_announcement_audience_roles_announcement_id",
        table_name="announcement_audience_roles",
    )
    op.drop_table("announcement_audience_roles")

    op.drop_index("ix_announcement_ctas_announcement_id", table_name="announcement_ctas")
    op.drop_table("announcement_ctas")

    op.drop_index("ix_announcements_created_by_user_id", table_name="announcements")
    op.drop_index("ix_announcements_production_id", table_name="announcements")
    op.drop_table("announcements")
