"""Phase 4: costumes (scene-level)

Revision ID: 009
Revises: 008
Create Date: 2026-07-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "costumes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_costumes_production_id", "costumes", ["production_id"])
    op.create_index("ix_costumes_character_id", "costumes", ["character_id"])
    op.create_index("ix_costumes_scene_id", "costumes", ["scene_id"])


def downgrade() -> None:
    op.drop_index("ix_costumes_scene_id", table_name="costumes")
    op.drop_index("ix_costumes_character_id", table_name="costumes")
    op.drop_index("ix_costumes_production_id", table_name="costumes")
    op.drop_table("costumes")
