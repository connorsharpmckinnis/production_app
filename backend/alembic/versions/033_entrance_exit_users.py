"""Allow entrance/exit rows to target a character, user, or group.

Revision ID: 033
Revises: 032
Create Date: 2026-09-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "033"
down_revision: Union[str, None] = "032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SUBJECT_CHECK = (
    "(character_id IS NOT NULL AND user_id IS NULL AND group_id IS NULL) OR "
    "(character_id IS NULL AND user_id IS NOT NULL AND group_id IS NULL) OR "
    "(character_id IS NULL AND user_id IS NULL AND group_id IS NOT NULL)"
)


def upgrade() -> None:
    for table in ("moment_entrances", "moment_exits"):
        op.drop_constraint(f"ck_{table}_character_xor_group", table, type_="check")
        op.add_column(table, sa.Column("user_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_user_id_users",
            table,
            "users",
            ["user_id"],
            ["id"],
        )
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])
        op.create_check_constraint(
            f"ck_{table}_exactly_one_subject",
            table,
            _SUBJECT_CHECK,
        )
        op.create_unique_constraint(
            f"uq_{table}_moment_id_user_id",
            table,
            ["moment_id", "user_id"],
        )


def downgrade() -> None:
    for table in ("moment_exits", "moment_entrances"):
        op.drop_constraint(f"uq_{table}_moment_id_user_id", table, type_="unique")
        op.drop_constraint(f"ck_{table}_exactly_one_subject", table, type_="check")
        op.drop_index(f"ix_{table}_user_id", table_name=table)
        op.drop_constraint(f"fk_{table}_user_id_users", table, type_="foreignkey")
        op.execute(sa.text(f"DELETE FROM {table} WHERE user_id IS NOT NULL"))
        op.drop_column(table, "user_id")
        op.create_check_constraint(
            f"ck_{table}_character_xor_group",
            table,
            "(character_id IS NOT NULL AND group_id IS NULL) OR "
            "(character_id IS NULL AND group_id IS NOT NULL)",
        )
