"""Add song_id to moments

Revision ID: 002
Revises: 001
Create Date: 2026-07-08

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("moments", sa.Column("song_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_moments_song_id",
        "moments",
        "songs",
        ["song_id"],
        ["id"],
    )
    op.create_index("ix_moments_song_id", "moments", ["song_id"])


def downgrade() -> None:
    op.drop_index("ix_moments_song_id", table_name="moments")
    op.drop_constraint("fk_moments_song_id", "moments", type_="foreignkey")
    op.drop_column("moments", "song_id")
