"""Phase 13: drop Timeline microphones tables

Revision ID: 017
Revises: 016
Create Date: 2026-07-26

Lav planning lives on wires/packs + lav chart. Existing mic rows are discarded.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_moment_microphones_character_id", table_name="moment_microphones")
    op.drop_index("ix_moment_microphones_microphone_id", table_name="moment_microphones")
    op.drop_index("ix_moment_microphones_moment_id", table_name="moment_microphones")
    op.drop_table("moment_microphones")

    op.drop_index("ix_microphones_production_id", table_name="microphones")
    # notes column may exist from 013; drop table regardless
    op.drop_table("microphones")


def downgrade() -> None:
    # Downgrade recreates empty catalog tables only (data not restored).
    import sqlalchemy as sa

    op.create_table(
        "microphones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("identifier", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_microphones_production_id", "microphones", ["production_id"])

    op.create_table(
        "moment_microphones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("microphone_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["microphone_id"], ["microphones.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "moment_id",
            "microphone_id",
            name="uq_moment_microphones_moment_id_microphone_id",
        ),
    )
    op.create_index("ix_moment_microphones_moment_id", "moment_microphones", ["moment_id"])
    op.create_index(
        "ix_moment_microphones_microphone_id",
        "moment_microphones",
        ["microphone_id"],
    )
    op.create_index(
        "ix_moment_microphones_character_id",
        "moment_microphones",
        ["character_id"],
    )
