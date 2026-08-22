"""Rehearsal management: locations, rehearsals, blocks, notes, times_rehearsed.

Revision ID: 023
Revises: 022
Create Date: 2026-08-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scenes",
        sa.Column(
            "times_rehearsed",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "scenes",
        sa.Column("last_rehearsed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "name",
            name="uq_locations_organization_id_name",
        ),
    )
    op.create_index(
        "ix_locations_organization_id",
        "locations",
        ["organization_id"],
    )

    op.create_table(
        "rehearsals",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rehearsals_production_id", "rehearsals", ["production_id"])
    op.create_index("ix_rehearsals_location_id", "rehearsals", ["location_id"])

    op.create_table(
        "rehearsal_blocks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rehearsal_id", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["rehearsal_id"],
            ["rehearsals.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_rehearsal_blocks_rehearsal_id",
        "rehearsal_blocks",
        ["rehearsal_id"],
    )
    op.create_index(
        "ix_rehearsal_blocks_location_id",
        "rehearsal_blocks",
        ["location_id"],
    )

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

    op.create_table(
        "rehearsal_block_calls",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("block_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["block_id"],
            ["rehearsal_blocks.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "block_id",
            "user_id",
            name="uq_rehearsal_block_calls_block_user",
        ),
    )
    op.create_index(
        "ix_rehearsal_block_calls_block_id",
        "rehearsal_block_calls",
        ["block_id"],
    )
    op.create_index(
        "ix_rehearsal_block_calls_user_id",
        "rehearsal_block_calls",
        ["user_id"],
    )

    op.create_table(
        "rehearsal_notes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rehearsal_id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["rehearsal_id"],
            ["rehearsals.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_rehearsal_notes_rehearsal_id",
        "rehearsal_notes",
        ["rehearsal_id"],
    )
    op.create_index(
        "ix_rehearsal_notes_author_user_id",
        "rehearsal_notes",
        ["author_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_rehearsal_notes_author_user_id", table_name="rehearsal_notes")
    op.drop_index("ix_rehearsal_notes_rehearsal_id", table_name="rehearsal_notes")
    op.drop_table("rehearsal_notes")
    op.drop_index("ix_rehearsal_block_calls_user_id", table_name="rehearsal_block_calls")
    op.drop_index("ix_rehearsal_block_calls_block_id", table_name="rehearsal_block_calls")
    op.drop_table("rehearsal_block_calls")
    op.drop_table("rehearsal_block_scenes")
    op.drop_index("ix_rehearsal_blocks_location_id", table_name="rehearsal_blocks")
    op.drop_index("ix_rehearsal_blocks_rehearsal_id", table_name="rehearsal_blocks")
    op.drop_table("rehearsal_blocks")
    op.drop_index("ix_rehearsals_location_id", table_name="rehearsals")
    op.drop_index("ix_rehearsals_production_id", table_name="rehearsals")
    op.drop_table("rehearsals")
    op.drop_index("ix_locations_organization_id", table_name="locations")
    op.drop_table("locations")
    op.drop_column("scenes", "last_rehearsed_at")
    op.drop_column("scenes", "times_rehearsed")
