"""Lav chart row locks for assignment UX.

Revision ID: 022
Revises: 021
Create Date: 2026-08-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lav_row_locks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("row_key", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["production_id"],
            ["productions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "production_id",
            "row_key",
            name="uq_lav_row_locks_prod_row_key",
        ),
    )
    op.create_index("ix_lav_row_locks_production_id", "lav_row_locks", ["production_id"])


def downgrade() -> None:
    op.drop_index("ix_lav_row_locks_production_id", table_name="lav_row_locks")
    op.drop_table("lav_row_locks")
