"""Add suggestion_dismissals for rules-based nudge engine.

Revision ID: 036
Revises: 035
Create Date: 2026-11-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "036"
down_revision: Union[str, None] = "035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "suggestion_dismissals",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("fingerprint", sa.String(length=255), nullable=False),
        sa.Column("dismissed_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
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
            ["dismissed_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "production_id",
            "fingerprint",
            name="uq_suggestion_dismissals_prod_fingerprint",
        ),
    )
    op.create_index(
        "ix_suggestion_dismissals_production_id",
        "suggestion_dismissals",
        ["production_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_suggestion_dismissals_production_id",
        table_name="suggestion_dismissals",
    )
    op.drop_table("suggestion_dismissals")
