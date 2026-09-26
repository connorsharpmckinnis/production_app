"""Typed rehearsal block targets: scene dialog + song music/choreo.

Revision ID: 034
Revises: 033
Create Date: 2026-09-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "034"
down_revision: Union[str, None] = "033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "songs",
        sa.Column("times_music_rehearsed", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "songs",
        sa.Column("last_music_rehearsed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "songs",
        sa.Column("times_choreo_rehearsed", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "songs",
        sa.Column("last_choreo_rehearsed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "rehearsal_block_targets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("block_id", sa.Integer(), nullable=False),
        sa.Column("focus", sa.String(length=16), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=True),
        sa.Column("song_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "focus IN ('dialog', 'music', 'choreo')",
            name="ck_rehearsal_block_targets_focus",
        ),
        sa.CheckConstraint(
            "(focus = 'dialog' AND scene_id IS NOT NULL AND song_id IS NULL) OR "
            "(focus IN ('music', 'choreo') AND song_id IS NOT NULL AND scene_id IS NULL)",
            name="ck_rehearsal_block_targets_focus_refs",
        ),
        sa.ForeignKeyConstraint(
            ["block_id"],
            ["rehearsal_blocks.id"],
            name="fk_rehearsal_block_targets_block_id_rehearsal_blocks",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["scene_id"],
            ["scenes.id"],
            name="fk_rehearsal_block_targets_scene_id_scenes",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["song_id"],
            ["songs.id"],
            name="fk_rehearsal_block_targets_song_id_songs",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_rehearsal_block_targets_block_id",
        "rehearsal_block_targets",
        ["block_id"],
    )
    op.create_index(
        "ix_rehearsal_block_targets_scene_id",
        "rehearsal_block_targets",
        ["scene_id"],
    )
    op.create_index(
        "ix_rehearsal_block_targets_song_id",
        "rehearsal_block_targets",
        ["song_id"],
    )
    op.create_index(
        "uq_rehearsal_block_targets_dialog_scene",
        "rehearsal_block_targets",
        ["block_id", "scene_id"],
        unique=True,
        postgresql_where=sa.text("focus = 'dialog' AND scene_id IS NOT NULL"),
    )
    op.create_index(
        "uq_rehearsal_block_targets_song_focus",
        "rehearsal_block_targets",
        ["block_id", "focus", "song_id"],
        unique=True,
        postgresql_where=sa.text(
            "focus IN ('music', 'choreo') AND song_id IS NOT NULL"
        ),
    )

    op.execute(
        """
        INSERT INTO rehearsal_block_targets (block_id, focus, scene_id, song_id)
        SELECT block_id, 'dialog', scene_id, NULL
        FROM rehearsal_block_scenes
        """
    )

    op.drop_table("rehearsal_block_scenes")


def downgrade() -> None:
    op.create_table(
        "rehearsal_block_scenes",
        sa.Column("block_id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["block_id"],
            ["rehearsal_blocks.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["scene_id"],
            ["scenes.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("block_id", "scene_id"),
        sa.UniqueConstraint(
            "block_id",
            "scene_id",
            name="uq_rehearsal_block_scenes_block_scene",
        ),
    )
    op.execute(
        """
        INSERT INTO rehearsal_block_scenes (block_id, scene_id)
        SELECT DISTINCT block_id, scene_id
        FROM rehearsal_block_targets
        WHERE focus = 'dialog' AND scene_id IS NOT NULL
        """
    )

    op.drop_index(
        "uq_rehearsal_block_targets_song_focus",
        table_name="rehearsal_block_targets",
    )
    op.drop_index(
        "uq_rehearsal_block_targets_dialog_scene",
        table_name="rehearsal_block_targets",
    )
    op.drop_index("ix_rehearsal_block_targets_song_id", table_name="rehearsal_block_targets")
    op.drop_index("ix_rehearsal_block_targets_scene_id", table_name="rehearsal_block_targets")
    op.drop_index("ix_rehearsal_block_targets_block_id", table_name="rehearsal_block_targets")
    op.drop_table("rehearsal_block_targets")

    op.drop_column("songs", "last_choreo_rehearsed_at")
    op.drop_column("songs", "times_choreo_rehearsed")
    op.drop_column("songs", "last_music_rehearsed_at")
    op.drop_column("songs", "times_music_rehearsed")
