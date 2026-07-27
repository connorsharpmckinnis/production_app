"""Phase 11: lyric_lines and song_attribution_characters

Revision ID: 015
Revises: 014
Create Date: 2026-07-25

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lyric_lines",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("lyric_text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lyric_lines_moment_id", "lyric_lines", ["moment_id"])
    op.create_index("ix_lyric_lines_character_id", "lyric_lines", ["character_id"])

    op.create_table(
        "song_attribution_characters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_song_attribution_characters_moment_character",
        ),
    )
    op.create_index(
        "ix_song_attribution_characters_moment_id",
        "song_attribution_characters",
        ["moment_id"],
    )
    op.create_index(
        "ix_song_attribution_characters_character_id",
        "song_attribution_characters",
        ["character_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_song_attribution_characters_character_id",
        table_name="song_attribution_characters",
    )
    op.drop_index(
        "ix_song_attribution_characters_moment_id",
        table_name="song_attribution_characters",
    )
    op.drop_table("song_attribution_characters")
    op.drop_index("ix_lyric_lines_character_id", table_name="lyric_lines")
    op.drop_index("ix_lyric_lines_moment_id", table_name="lyric_lines")
    op.drop_table("lyric_lines")
