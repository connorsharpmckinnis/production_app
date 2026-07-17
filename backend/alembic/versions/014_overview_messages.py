"""Phase 8 WP2: Overview messages and rotation settings

Revision ID: 014
Revises: 013
Create Date: 2026-07-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

DEFAULT_MESSAGE_ROTATION_SECONDS = 20
DEFAULT_ENCOURAGEMENT_MESSAGES = (
    ("0", "Blank stage — import a script and let's get rolling.", 0),
    ("1-24", "Good start — the bones are there.", 1),
    ("25-49", "You're building something real. Keep layering prep.", 2),
    ("50-74", "Solid progress — the show is taking shape.", 3),
    ("75-89", "You got it — almost at the finish line!", 4),
    ("90-99", "So close — knock out the last gaps.", 5),
    ("100", "Prep looks complete. Time to rehearse.", 6),
)

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "default_message_rotation_seconds",
            sa.Integer(),
            nullable=False,
            server_default=sa.text(str(DEFAULT_MESSAGE_ROTATION_SECONDS)),
        ),
    )
    op.add_column(
        "productions",
        sa.Column("message_rotation_seconds", sa.Integer(), nullable=True),
    )

    op.create_table(
        "app_overview_message_defaults",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("band", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
    )
    op.create_index(
        "ix_app_overview_message_defaults_band",
        "app_overview_message_defaults",
        ["band"],
    )

    op.create_table(
        "production_overview_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("band", sa.String(length=20), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_production_overview_messages_production_id",
        "production_overview_messages",
        ["production_id"],
    )
    op.create_index(
        "ix_production_overview_messages_band",
        "production_overview_messages",
        ["band"],
    )

    defaults_table = sa.table(
        "app_overview_message_defaults",
        sa.column("band", sa.String),
        sa.column("title", sa.String),
        sa.column("body", sa.Text),
        sa.column("sort_order", sa.Integer),
        sa.column("active", sa.Boolean),
    )
    op.bulk_insert(
        defaults_table,
        [
            {
                "band": band,
                "title": None,
                "body": body,
                "sort_order": sort_order,
                "active": True,
            }
            for band, body, sort_order in DEFAULT_ENCOURAGEMENT_MESSAGES
        ],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_production_overview_messages_band",
        table_name="production_overview_messages",
    )
    op.drop_index(
        "ix_production_overview_messages_production_id",
        table_name="production_overview_messages",
    )
    op.drop_table("production_overview_messages")
    op.drop_index(
        "ix_app_overview_message_defaults_band",
        table_name="app_overview_message_defaults",
    )
    op.drop_table("app_overview_message_defaults")
    op.drop_column("productions", "message_rotation_seconds")
    op.drop_column("app_settings", "default_message_rotation_seconds")
