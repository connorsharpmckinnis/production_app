"""Phase 3: cue categories and cues

Revision ID: 007
Revises: 006
Create Date: 2026-07-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cue_categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cue_categories_production_id", "cue_categories", ["production_id"])

    op.create_table(
        "cues",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("cue_category_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["cue_category_id"], ["cue_categories.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cues_moment_id", "cues", ["moment_id"])
    op.create_index("ix_cues_cue_category_id", "cues", ["cue_category_id"])


def downgrade() -> None:
    op.drop_index("ix_cues_cue_category_id", table_name="cues")
    op.drop_index("ix_cues_moment_id", table_name="cues")
    op.drop_table("cues")
    op.drop_index("ix_cue_categories_production_id", table_name="cue_categories")
    op.drop_table("cue_categories")
