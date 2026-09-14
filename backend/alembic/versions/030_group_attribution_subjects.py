"""Allow dialogue/lyric/song attribution subjects to be Character or Group.

Revision ID: 030
Revises: 029
Create Date: 2026-09-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BUILTIN_NAMES = ("ALL", "ENSEMBLE")

_SUBJECT_TABLES = (
    "dialogue",
    "lyric_lines",
    "song_attribution_characters",
)


def _add_group_subject(table: str) -> None:
    op.alter_column(
        table,
        "character_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.add_column(table, sa.Column("group_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        f"fk_{table}_group_id_groups",
        table,
        "groups",
        ["group_id"],
        ["id"],
    )
    op.create_index(f"ix_{table}_group_id", table, ["group_id"])
    op.create_check_constraint(
        f"ck_{table}_exactly_one_subject",
        table,
        "(character_id IS NOT NULL AND group_id IS NULL) OR "
        "(character_id IS NULL AND group_id IS NOT NULL)",
    )
    op.create_unique_constraint(
        f"uq_{table}_moment_id_group_id",
        table,
        ["moment_id", "group_id"],
    )


def _drop_group_subject(table: str) -> None:
    op.drop_constraint(f"uq_{table}_moment_id_group_id", table, type_="unique")
    op.drop_constraint(f"ck_{table}_exactly_one_subject", table, type_="check")
    op.drop_index(f"ix_{table}_group_id", table_name=table)
    op.drop_constraint(f"fk_{table}_group_id_groups", table, type_="foreignkey")
    op.drop_column(table, "group_id")
    op.execute(f"DELETE FROM {table} WHERE character_id IS NULL")
    op.alter_column(
        table,
        "character_id",
        existing_type=sa.Integer(),
        nullable=False,
    )


def _remap_builtin_characters_to_groups() -> None:
    """Move ALL/ENSEMBLE Character attributions onto Groups, then delete fakes."""
    conn = op.get_bind()
    for name in _BUILTIN_NAMES:
        rows = conn.execute(
            sa.text(
                "SELECT id, production_id FROM characters WHERE name = :name"
            ),
            {"name": name},
        ).fetchall()
        for character_id, production_id in rows:
            group_id = conn.execute(
                sa.text(
                    "SELECT id FROM groups "
                    "WHERE production_id = :production_id AND name = :name"
                ),
                {"production_id": production_id, "name": name},
            ).scalar()
            if group_id is None:
                group_id = conn.execute(
                    sa.text(
                        "INSERT INTO groups (production_id, name, description) "
                        "VALUES (:production_id, :name, NULL) RETURNING id"
                    ),
                    {"production_id": production_id, "name": name},
                ).scalar()

            for table in _SUBJECT_TABLES:
                conn.execute(
                    sa.text(
                        f"UPDATE {table} SET group_id = :group_id, "
                        f"character_id = NULL WHERE character_id = :character_id"
                    ),
                    {"group_id": group_id, "character_id": character_id},
                )

            # Drop membership / casting leftovers tied to the fake character.
            conn.execute(
                sa.text(
                    "DELETE FROM character_groups WHERE character_id = :character_id"
                ),
                {"character_id": character_id},
            )
            conn.execute(
                sa.text(
                    "DELETE FROM user_character_assignments "
                    "WHERE character_id = :character_id"
                ),
                {"character_id": character_id},
            )
            conn.execute(
                sa.text("DELETE FROM characters WHERE id = :character_id"),
                {"character_id": character_id},
            )


def upgrade() -> None:
    # song_attribution already has a unique on (moment_id, character_id).
    # dialogue / lyric_lines do not; add character uniques for symmetry with groups.
    op.create_unique_constraint(
        "uq_dialogue_moment_id_character_id",
        "dialogue",
        ["moment_id", "character_id"],
    )
    op.create_unique_constraint(
        "uq_lyric_lines_moment_id_character_id",
        "lyric_lines",
        ["moment_id", "character_id"],
    )

    for table in _SUBJECT_TABLES:
        _add_group_subject(table)

    _remap_builtin_characters_to_groups()


def downgrade() -> None:
    # Cannot cleanly restore Group attributions as Characters without inventing
    # names; delete group-attributed rows then restore NOT NULL character_id.
    for table in reversed(_SUBJECT_TABLES):
        _drop_group_subject(table)

    op.drop_constraint(
        "uq_lyric_lines_moment_id_character_id",
        "lyric_lines",
        type_="unique",
    )
    op.drop_constraint(
        "uq_dialogue_moment_id_character_id",
        "dialogue",
        type_="unique",
    )
