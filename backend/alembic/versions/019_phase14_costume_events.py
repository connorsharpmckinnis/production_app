"""Phase 14 WP5: costume on/off events (thin slice)

Revision ID: 019
Revises: 018
Create Date: 2026-07-27

Adds moment_costume_events, mirroring the prop/set piece event pattern from
018 but scoped to a single wearer per Moment: (moment_id, character_id) is
unique, kind is on/off, and costume_id is required when kind='on' (who is
wearing what). Drops costumes.scene_id — costume timing now lives on the
Timeline via these events instead of a per-scene catalog assignment. No data
migration: the owner re-enters costume changes on the Timeline.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "moment_costume_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("costume_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["costume_id"], ["costumes.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "kind IN ('on', 'off')",
            name="ck_moment_costume_events_kind",
        ),
        sa.CheckConstraint(
            "(kind = 'off') OR (costume_id IS NOT NULL)",
            name="ck_moment_costume_events_on_requires_costume",
        ),
        sa.UniqueConstraint(
            "moment_id",
            "character_id",
            name="uq_moment_costume_events_moment_id_character_id",
        ),
    )
    op.create_index(
        "ix_moment_costume_events_moment_id", "moment_costume_events", ["moment_id"]
    )
    op.create_index(
        "ix_moment_costume_events_character_id", "moment_costume_events", ["character_id"]
    )
    op.create_index(
        "ix_moment_costume_events_costume_id", "moment_costume_events", ["costume_id"]
    )

    op.drop_index("ix_costumes_scene_id", table_name="costumes")
    op.drop_column("costumes", "scene_id")


def downgrade() -> None:
    # Recreated nullable — old scene assignment data is not restored.
    op.add_column("costumes", sa.Column("scene_id", sa.Integer(), nullable=True))
    op.create_index("ix_costumes_scene_id", "costumes", ["scene_id"])

    op.drop_index("ix_moment_costume_events_costume_id", table_name="moment_costume_events")
    op.drop_index("ix_moment_costume_events_character_id", table_name="moment_costume_events")
    op.drop_index("ix_moment_costume_events_moment_id", table_name="moment_costume_events")
    op.drop_table("moment_costume_events")
