"""Phase 4: application settings singleton

Revision ID: 008
Revises: 007
Create Date: 2026-07-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("show_original_text", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("show_parsed_text", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            "INSERT INTO app_settings (id, show_original_text, show_parsed_text) "
            "VALUES (1, true, true)"
        )
    )


def downgrade() -> None:
    op.drop_table("app_settings")
