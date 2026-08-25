"""Allow blocking notes for character, user, or group.

Revision ID: 024
Revises: 023
Create Date: 2026-08-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_moment_blocking_moment_id_character_id",
        "moment_blocking",
        type_="unique",
    )
    op.alter_column(
        "moment_blocking",
        "character_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.add_column(
        "moment_blocking",
        sa.Column("user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "moment_blocking",
        sa.Column("group_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_moment_blocking_user_id_users",
        "moment_blocking",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_moment_blocking_group_id_groups",
        "moment_blocking",
        "groups",
        ["group_id"],
        ["id"],
    )
    op.create_index("ix_moment_blocking_user_id", "moment_blocking", ["user_id"])
    op.create_index("ix_moment_blocking_group_id", "moment_blocking", ["group_id"])
    op.create_check_constraint(
        "ck_moment_blocking_exactly_one_subject",
        "moment_blocking",
        "(character_id IS NOT NULL AND user_id IS NULL AND group_id IS NULL) OR "
        "(character_id IS NULL AND user_id IS NOT NULL AND group_id IS NULL) OR "
        "(character_id IS NULL AND user_id IS NULL AND group_id IS NOT NULL)",
    )
    op.create_unique_constraint(
        "uq_moment_blocking_moment_id_character_id",
        "moment_blocking",
        ["moment_id", "character_id"],
    )
    op.create_unique_constraint(
        "uq_moment_blocking_moment_id_user_id",
        "moment_blocking",
        ["moment_id", "user_id"],
    )
    op.create_unique_constraint(
        "uq_moment_blocking_moment_id_group_id",
        "moment_blocking",
        ["moment_id", "group_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_moment_blocking_moment_id_group_id",
        "moment_blocking",
        type_="unique",
    )
    op.drop_constraint(
        "uq_moment_blocking_moment_id_user_id",
        "moment_blocking",
        type_="unique",
    )
    op.drop_constraint(
        "uq_moment_blocking_moment_id_character_id",
        "moment_blocking",
        type_="unique",
    )
    op.drop_constraint(
        "ck_moment_blocking_exactly_one_subject",
        "moment_blocking",
        type_="check",
    )
    op.drop_index("ix_moment_blocking_group_id", table_name="moment_blocking")
    op.drop_index("ix_moment_blocking_user_id", table_name="moment_blocking")
    op.drop_constraint(
        "fk_moment_blocking_group_id_groups",
        "moment_blocking",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_moment_blocking_user_id_users",
        "moment_blocking",
        type_="foreignkey",
    )
    op.drop_column("moment_blocking", "group_id")
    op.drop_column("moment_blocking", "user_id")
    # Existing group/user rows would block NOT NULL; delete them before restoring.
    op.execute("DELETE FROM moment_blocking WHERE character_id IS NULL")
    op.alter_column(
        "moment_blocking",
        "character_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_unique_constraint(
        "uq_moment_blocking_moment_id_character_id",
        "moment_blocking",
        ["moment_id", "character_id"],
    )
