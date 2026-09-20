"""Rehearsal capture: note unification, attachment provenance, extra permissions.

Revision ID: 032
Revises: 031
Create Date: 2026-09-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "032"
down_revision: Union[str, None] = "031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ATTACHMENT_TABLES = (
    "moment_entrances",
    "moment_exits",
    "moment_blocking",
    "moment_prop_events",
    "moment_set_piece_events",
    "moment_costume_events",
    "cues",
)


def upgrade() -> None:
    op.drop_constraint(
        "ck_production_role_permissions_action",
        "production_role_permissions",
        type_="check",
    )
    op.create_check_constraint(
        "ck_production_role_permissions_action",
        "production_role_permissions",
        "action IN ('read', 'create', 'update', 'delete', 'suggest', 'approve', 'publish')",
    )

    op.add_column("notes", sa.Column("rehearsal_id", sa.Integer(), nullable=True))
    op.add_column(
        "notes",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.add_column("notes", sa.Column("updated_by_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_notes_rehearsal_id_rehearsals",
        "notes",
        "rehearsals",
        ["rehearsal_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_notes_updated_by_user_id_users",
        "notes",
        "users",
        ["updated_by_user_id"],
        ["id"],
    )
    op.create_index("ix_notes_rehearsal_id", "notes", ["rehearsal_id"])
    op.create_check_constraint(
        "ck_notes_has_target",
        "notes",
        "moment_id IS NOT NULL OR character_id IS NOT NULL OR rehearsal_id IS NOT NULL",
    )

    op.execute(
        """
        INSERT INTO notes (
            user_id, visibility, rehearsal_id, content, created_at, updated_at, updated_by_user_id
        )
        SELECT
            author_user_id, 'public', rehearsal_id, content, created_at, updated_at, author_user_id
        FROM rehearsal_notes
        """
    )
    op.drop_index("ix_rehearsal_notes_author_user_id", table_name="rehearsal_notes")
    op.drop_index("ix_rehearsal_notes_rehearsal_id", table_name="rehearsal_notes")
    op.drop_table("rehearsal_notes")

    for table in _ATTACHMENT_TABLES:
        op.add_column(
            table,
            sa.Column("status", sa.String(length=20), server_default="official", nullable=False),
        )
        op.add_column(table, sa.Column("created_by_user_id", sa.Integer(), nullable=True))
        op.add_column(table, sa.Column("updated_by_user_id", sa.Integer(), nullable=True))
        op.add_column(
            table,
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.add_column(
            table,
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.add_column(table, sa.Column("rehearsal_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_created_by_user_id_users",
            table,
            "users",
            ["created_by_user_id"],
            ["id"],
        )
        op.create_foreign_key(
            f"fk_{table}_updated_by_user_id_users",
            table,
            "users",
            ["updated_by_user_id"],
            ["id"],
        )
        op.create_foreign_key(
            f"fk_{table}_rehearsal_id_rehearsals",
            table,
            "rehearsals",
            ["rehearsal_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(f"ix_{table}_rehearsal_id", table, ["rehearsal_id"])


def downgrade() -> None:
    for table in reversed(_ATTACHMENT_TABLES):
        op.drop_index(f"ix_{table}_rehearsal_id", table_name=table)
        op.drop_constraint(f"fk_{table}_rehearsal_id_rehearsals", table, type_="foreignkey")
        op.drop_constraint(f"fk_{table}_updated_by_user_id_users", table, type_="foreignkey")
        op.drop_constraint(f"fk_{table}_created_by_user_id_users", table, type_="foreignkey")
        op.drop_column(table, "rehearsal_id")
        op.drop_column(table, "updated_at")
        op.drop_column(table, "created_at")
        op.drop_column(table, "updated_by_user_id")
        op.drop_column(table, "created_by_user_id")
        op.drop_column(table, "status")

    op.create_table(
        "rehearsal_notes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rehearsal_id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["rehearsal_id"], ["rehearsals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rehearsal_notes_rehearsal_id", "rehearsal_notes", ["rehearsal_id"])
    op.create_index("ix_rehearsal_notes_author_user_id", "rehearsal_notes", ["author_user_id"])
    op.execute(
        """
        INSERT INTO rehearsal_notes (rehearsal_id, author_user_id, content, created_at, updated_at)
        SELECT rehearsal_id, user_id, content, created_at, updated_at
        FROM notes
        WHERE rehearsal_id IS NOT NULL AND moment_id IS NULL AND character_id IS NULL
        """
    )
    op.drop_constraint("ck_notes_has_target", "notes", type_="check")
    op.drop_index("ix_notes_rehearsal_id", table_name="notes")
    op.drop_constraint("fk_notes_updated_by_user_id_users", "notes", type_="foreignkey")
    op.drop_constraint("fk_notes_rehearsal_id_rehearsals", "notes", type_="foreignkey")
    op.drop_column("notes", "updated_by_user_id")
    op.drop_column("notes", "updated_at")
    op.drop_column("notes", "rehearsal_id")

    op.drop_constraint(
        "ck_production_role_permissions_action",
        "production_role_permissions",
        type_="check",
    )
    op.create_check_constraint(
        "ck_production_role_permissions_action",
        "production_role_permissions",
        "action IN ('read', 'create', 'update', 'delete')",
    )
