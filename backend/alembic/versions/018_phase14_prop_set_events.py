"""Phase 14 WP2: prop and set piece on/off events

Revision ID: 018
Revises: 017
Create Date: 2026-07-27

Replaces the Phase 3/4 presence junctions (moment_props, moment_set_pieces)
with on/off event tables. Current in-play state, person, and notes are no
longer stored directly — they are derived by walking these events in show
order (see app/services/asset_state.py). No data migration: the owner
re-enters props/set pieces on the timeline.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "moment_prop_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("prop_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.ForeignKeyConstraint(["prop_id"], ["props.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "(character_id IS NULL OR user_id IS NULL)",
            name="ck_moment_prop_events_person",
        ),
        sa.CheckConstraint(
            "kind IN ('on', 'off')",
            name="ck_moment_prop_events_kind",
        ),
        sa.UniqueConstraint(
            "moment_id",
            "prop_id",
            name="uq_moment_prop_events_moment_id_prop_id",
        ),
    )
    op.create_index("ix_moment_prop_events_moment_id", "moment_prop_events", ["moment_id"])
    op.create_index("ix_moment_prop_events_prop_id", "moment_prop_events", ["prop_id"])
    op.create_index("ix_moment_prop_events_character_id", "moment_prop_events", ["character_id"])
    op.create_index("ix_moment_prop_events_user_id", "moment_prop_events", ["user_id"])

    op.create_table(
        "moment_set_piece_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("set_piece_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.ForeignKeyConstraint(["set_piece_id"], ["set_pieces.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "(character_id IS NULL OR user_id IS NULL)",
            name="ck_moment_set_piece_events_person",
        ),
        sa.CheckConstraint(
            "kind IN ('on', 'off')",
            name="ck_moment_set_piece_events_kind",
        ),
        sa.UniqueConstraint(
            "moment_id",
            "set_piece_id",
            name="uq_moment_set_piece_events_moment_id_set_piece_id",
        ),
    )
    op.create_index(
        "ix_moment_set_piece_events_moment_id", "moment_set_piece_events", ["moment_id"]
    )
    op.create_index(
        "ix_moment_set_piece_events_set_piece_id", "moment_set_piece_events", ["set_piece_id"]
    )
    op.create_index(
        "ix_moment_set_piece_events_character_id", "moment_set_piece_events", ["character_id"]
    )
    op.create_index(
        "ix_moment_set_piece_events_user_id", "moment_set_piece_events", ["user_id"]
    )

    op.drop_index("ix_moment_props_character_id", table_name="moment_props")
    op.drop_index("ix_moment_props_prop_id", table_name="moment_props")
    op.drop_index("ix_moment_props_moment_id", table_name="moment_props")
    op.drop_table("moment_props")

    op.drop_index("ix_moment_set_pieces_set_piece_id", table_name="moment_set_pieces")
    op.drop_index("ix_moment_set_pieces_moment_id", table_name="moment_set_pieces")
    op.drop_table("moment_set_pieces")


def downgrade() -> None:
    # Downgrade recreates empty presence tables only (event data not restored).
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

    op.drop_index("ix_moment_set_piece_events_user_id", table_name="moment_set_piece_events")
    op.drop_index(
        "ix_moment_set_piece_events_character_id", table_name="moment_set_piece_events"
    )
    op.drop_index(
        "ix_moment_set_piece_events_set_piece_id", table_name="moment_set_piece_events"
    )
    op.drop_index("ix_moment_set_piece_events_moment_id", table_name="moment_set_piece_events")
    op.drop_table("moment_set_piece_events")

    op.drop_index("ix_moment_prop_events_user_id", table_name="moment_prop_events")
    op.drop_index("ix_moment_prop_events_character_id", table_name="moment_prop_events")
    op.drop_index("ix_moment_prop_events_prop_id", table_name="moment_prop_events")
    op.drop_index("ix_moment_prop_events_moment_id", table_name="moment_prop_events")
    op.drop_table("moment_prop_events")
