"""Phase 12: wires, packs, and lav chart assignments

Revision ID: 016
Revises: 015
Create Date: 2026-07-26

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "wires",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("identifier", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_wires_production_id", "wires", ["production_id"])

    op.create_table(
        "packs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("identifier", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_packs_production_id", "packs", ["production_id"])

    op.create_table(
        "lav_wire_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("character_id", sa.Integer(), nullable=True),
        sa.Column("wire_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "(user_id IS NOT NULL AND character_id IS NULL) OR "
            "(user_id IS NULL AND character_id IS NOT NULL)",
            name="ck_lav_wire_assignments_wearer",
        ),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["wire_id"], ["wires.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "production_id",
            "scene_id",
            "user_id",
            name="uq_lav_wire_assignments_prod_scene_user",
        ),
        sa.UniqueConstraint(
            "production_id",
            "scene_id",
            "character_id",
            name="uq_lav_wire_assignments_prod_scene_character",
        ),
    )
    op.create_index(
        "ix_lav_wire_assignments_production_id",
        "lav_wire_assignments",
        ["production_id"],
    )
    op.create_index("ix_lav_wire_assignments_scene_id", "lav_wire_assignments", ["scene_id"])
    op.create_index("ix_lav_wire_assignments_user_id", "lav_wire_assignments", ["user_id"])
    op.create_index(
        "ix_lav_wire_assignments_character_id",
        "lav_wire_assignments",
        ["character_id"],
    )
    op.create_index("ix_lav_wire_assignments_wire_id", "lav_wire_assignments", ["wire_id"])

    op.create_table(
        "lav_pack_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("character_id", sa.Integer(), nullable=True),
        sa.Column("pack_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "(user_id IS NOT NULL AND character_id IS NULL) OR "
            "(user_id IS NULL AND character_id IS NOT NULL)",
            name="ck_lav_pack_assignments_wearer",
        ),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["pack_id"], ["packs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "production_id",
            "scene_id",
            "user_id",
            name="uq_lav_pack_assignments_prod_scene_user",
        ),
        sa.UniqueConstraint(
            "production_id",
            "scene_id",
            "character_id",
            name="uq_lav_pack_assignments_prod_scene_character",
        ),
    )
    op.create_index(
        "ix_lav_pack_assignments_production_id",
        "lav_pack_assignments",
        ["production_id"],
    )
    op.create_index("ix_lav_pack_assignments_scene_id", "lav_pack_assignments", ["scene_id"])
    op.create_index("ix_lav_pack_assignments_user_id", "lav_pack_assignments", ["user_id"])
    op.create_index(
        "ix_lav_pack_assignments_character_id",
        "lav_pack_assignments",
        ["character_id"],
    )
    op.create_index("ix_lav_pack_assignments_pack_id", "lav_pack_assignments", ["pack_id"])


def downgrade() -> None:
    op.drop_index("ix_lav_pack_assignments_pack_id", table_name="lav_pack_assignments")
    op.drop_index("ix_lav_pack_assignments_character_id", table_name="lav_pack_assignments")
    op.drop_index("ix_lav_pack_assignments_user_id", table_name="lav_pack_assignments")
    op.drop_index("ix_lav_pack_assignments_scene_id", table_name="lav_pack_assignments")
    op.drop_index("ix_lav_pack_assignments_production_id", table_name="lav_pack_assignments")
    op.drop_table("lav_pack_assignments")

    op.drop_index("ix_lav_wire_assignments_wire_id", table_name="lav_wire_assignments")
    op.drop_index("ix_lav_wire_assignments_character_id", table_name="lav_wire_assignments")
    op.drop_index("ix_lav_wire_assignments_user_id", table_name="lav_wire_assignments")
    op.drop_index("ix_lav_wire_assignments_scene_id", table_name="lav_wire_assignments")
    op.drop_index("ix_lav_wire_assignments_production_id", table_name="lav_wire_assignments")
    op.drop_table("lav_wire_assignments")

    op.drop_index("ix_packs_production_id", table_name="packs")
    op.drop_table("packs")
    op.drop_index("ix_wires_production_id", table_name="wires")
    op.drop_table("wires")
