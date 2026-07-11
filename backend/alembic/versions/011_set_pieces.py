"""Phase 4: set pieces and moment attachments

Revision ID: 011
Revises: 010
Create Date: 2026-07-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "set_pieces",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("mobile", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_set_pieces_production_id", "set_pieces", ["production_id"])

    op.create_table(
        "moment_set_pieces",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("set_piece_id", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.ForeignKeyConstraint(["set_piece_id"], ["set_pieces.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "moment_id",
            "set_piece_id",
            name="uq_moment_set_pieces_moment_id_set_piece_id",
        ),
    )
    op.create_index("ix_moment_set_pieces_moment_id", "moment_set_pieces", ["moment_id"])
    op.create_index("ix_moment_set_pieces_set_piece_id", "moment_set_pieces", ["set_piece_id"])


def downgrade() -> None:
    op.drop_index("ix_moment_set_pieces_set_piece_id", table_name="moment_set_pieces")
    op.drop_index("ix_moment_set_pieces_moment_id", table_name="moment_set_pieces")
    op.drop_table("moment_set_pieces")
    op.drop_index("ix_set_pieces_production_id", table_name="set_pieces")
    op.drop_table("set_pieces")
