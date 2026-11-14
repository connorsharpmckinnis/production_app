"""Add analytics_events append-only product event log.

Revision ID: 037
Revises: 036
Create Date: 2026-11-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "037"
down_revision: Union[str, None] = "036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("production_id", sa.Integer(), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("event_name", sa.String(length=120), nullable=False),
        sa.Column("properties", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["production_id"],
            ["productions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_analytics_events_created_at",
        "analytics_events",
        ["created_at"],
    )
    op.create_index(
        "ix_analytics_events_organization_id",
        "analytics_events",
        ["organization_id"],
    )
    op.create_index(
        "ix_analytics_events_production_id",
        "analytics_events",
        ["production_id"],
    )
    op.create_index(
        "ix_analytics_events_actor_user_id",
        "analytics_events",
        ["actor_user_id"],
    )
    op.create_index(
        "ix_analytics_events_event_name",
        "analytics_events",
        ["event_name"],
    )


def downgrade() -> None:
    op.drop_index("ix_analytics_events_event_name", table_name="analytics_events")
    op.drop_index("ix_analytics_events_actor_user_id", table_name="analytics_events")
    op.drop_index("ix_analytics_events_production_id", table_name="analytics_events")
    op.drop_index("ix_analytics_events_organization_id", table_name="analytics_events")
    op.drop_index("ix_analytics_events_created_at", table_name="analytics_events")
    op.drop_table("analytics_events")
