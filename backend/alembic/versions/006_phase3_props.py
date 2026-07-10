"""Phase 3: props and moment prop attachments

Revision ID: 006
Revises: 005
Create Date: 2026-07-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "props",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_props_production_id", "props", ["production_id"])

    op.create_table(
        "moment_props",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("prop_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.ForeignKeyConstraint(["prop_id"], ["props.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("moment_id", "prop_id", name="uq_moment_props_moment_id_prop_id"),
    )
    op.create_index("ix_moment_props_moment_id", "moment_props", ["moment_id"])
    op.create_index("ix_moment_props_prop_id", "moment_props", ["prop_id"])
    op.create_index("ix_moment_props_character_id", "moment_props", ["character_id"])


def downgrade() -> None:
    op.drop_index("ix_moment_props_character_id", table_name="moment_props")
    op.drop_index("ix_moment_props_prop_id", table_name="moment_props")
    op.drop_index("ix_moment_props_moment_id", table_name="moment_props")
    op.drop_table("moment_props")
    op.drop_index("ix_props_production_id", table_name="props")
    op.drop_table("props")
