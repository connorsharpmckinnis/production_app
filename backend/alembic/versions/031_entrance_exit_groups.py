"""Allow entrance/exit rows to target a character or a group.

Revision ID: 031
Revises: 030
Create Date: 2026-09-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "031"
down_revision: Union[str, None] = "030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("moment_entrances", "moment_exits"):
        op.drop_constraint(
            f"uq_{table}_moment_id_character_id",
            table,
            type_="unique",
        )
        op.alter_column(
            table,
            "character_id",
            existing_type=sa.Integer(),
            nullable=True,
        )
        op.add_column(
            table,
            sa.Column("group_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            f"fk_{table}_group_id_groups",
            table,
            "groups",
            ["group_id"],
            ["id"],
        )
        op.create_index(f"ix_{table}_group_id", table, ["group_id"])
        op.create_check_constraint(
            f"ck_{table}_character_xor_group",
            table,
            "(character_id IS NOT NULL AND group_id IS NULL) OR "
            "(character_id IS NULL AND group_id IS NOT NULL)",
        )
        op.create_unique_constraint(
            f"uq_{table}_moment_id_character_id",
            table,
            ["moment_id", "character_id"],
        )
        op.create_unique_constraint(
            f"uq_{table}_moment_id_group_id",
            table,
            ["moment_id", "group_id"],
        )


def downgrade() -> None:
    for table in ("moment_exits", "moment_entrances"):
        op.drop_constraint(f"uq_{table}_moment_id_group_id", table, type_="unique")
        op.drop_constraint(f"uq_{table}_moment_id_character_id", table, type_="unique")
        op.drop_constraint(f"ck_{table}_character_xor_group", table, type_="check")
        op.drop_index(f"ix_{table}_group_id", table_name=table)
        op.drop_constraint(f"fk_{table}_group_id_groups", table, type_="foreignkey")
        op.drop_column(table, "group_id")
        op.execute(
            sa.text(f"DELETE FROM {table} WHERE character_id IS NULL"),
        )
        op.alter_column(
            table,
            "character_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        op.create_unique_constraint(
            f"uq_{table}_moment_id_character_id",
            table,
            ["moment_id", "character_id"],
        )
