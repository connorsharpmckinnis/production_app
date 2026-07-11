"""Phase 5: entrances, exits, and blocking on moments

Revision ID: 012
Revises: 011
Create Date: 2026-07-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "moment_entrances",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_moment_entrances_moment_id_character_id",
        ),
    )
    op.create_index("ix_moment_entrances_moment_id", "moment_entrances", ["moment_id"])
    op.create_index("ix_moment_entrances_character_id", "moment_entrances", ["character_id"])

    op.create_table(
        "moment_exits",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_moment_exits_moment_id_character_id",
        ),
    )
    op.create_index("ix_moment_exits_moment_id", "moment_exits", ["moment_id"])
    op.create_index("ix_moment_exits_character_id", "moment_exits", ["character_id"])

    op.create_table(
        "moment_blocking",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_moment_blocking_moment_id_character_id",
        ),
    )
    op.create_index("ix_moment_blocking_moment_id", "moment_blocking", ["moment_id"])
    op.create_index("ix_moment_blocking_character_id", "moment_blocking", ["character_id"])


def downgrade() -> None:
    op.drop_index("ix_moment_blocking_character_id", table_name="moment_blocking")
    op.drop_index("ix_moment_blocking_moment_id", table_name="moment_blocking")
    op.drop_table("moment_blocking")
    op.drop_index("ix_moment_exits_character_id", table_name="moment_exits")
    op.drop_index("ix_moment_exits_moment_id", table_name="moment_exits")
    op.drop_table("moment_exits")
    op.drop_index("ix_moment_entrances_character_id", table_name="moment_entrances")
    op.drop_index("ix_moment_entrances_moment_id", table_name="moment_entrances")
    op.drop_table("moment_entrances")
