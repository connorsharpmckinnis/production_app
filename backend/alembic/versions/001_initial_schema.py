"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-07-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "app_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "moment_types",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("first_name", sa.String(length=255), nullable=False),
        sa.Column("last_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
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
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_users_organization_id", "users", ["organization_id"])

    op.create_table(
        "user_app_roles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("app_role_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["app_role_id"], ["app_roles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("user_id", "app_role_id"),
    )
    op.create_index("ix_user_app_roles_user_id", "user_app_roles", ["user_id"])
    op.create_index("ix_user_app_roles_app_role_id", "user_app_roles", ["app_role_id"])

    op.create_table(
        "productions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("season", sa.String(length=100), nullable=True),
        sa.Column("author", sa.String(length=255), nullable=True),
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
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_productions_organization_id", "productions", ["organization_id"])

    op.create_table(
        "acts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_acts_production_id", "acts", ["production_id"])

    op.create_table(
        "characters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_characters_production_id", "characters", ["production_id"])

    op.create_table(
        "songs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("production_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("composer", sa.String(length=255), nullable=True),
        sa.Column("lyricist", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["production_id"], ["productions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_songs_production_id", "songs", ["production_id"])

    op.create_table(
        "scenes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("act_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["act_id"], ["acts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scenes_act_id", "scenes", ["act_id"])

    op.create_table(
        "moments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("moment_type_id", sa.Integer(), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("parsed_text", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["moment_type_id"], ["moment_types.id"]),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_moments_scene_id", "moments", ["scene_id"])
    op.create_index("ix_moments_moment_type_id", "moments", ["moment_type_id"])

    op.create_table(
        "dialogue",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("dialogue_text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"]),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dialogue_moment_id", "dialogue", ["moment_id"])
    op.create_index("ix_dialogue_character_id", "dialogue", ["character_id"])

    op.create_table(
        "stage_directions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("moment_id", sa.Integer(), nullable=False),
        sa.Column("direction_text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["moment_id"], ["moments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stage_directions_moment_id", "stage_directions", ["moment_id"])


def downgrade() -> None:
    op.drop_index("ix_stage_directions_moment_id", table_name="stage_directions")
    op.drop_table("stage_directions")
    op.drop_index("ix_dialogue_character_id", table_name="dialogue")
    op.drop_index("ix_dialogue_moment_id", table_name="dialogue")
    op.drop_table("dialogue")
    op.drop_index("ix_moments_moment_type_id", table_name="moments")
    op.drop_index("ix_moments_scene_id", table_name="moments")
    op.drop_table("moments")
    op.drop_index("ix_scenes_act_id", table_name="scenes")
    op.drop_table("scenes")
    op.drop_index("ix_songs_production_id", table_name="songs")
    op.drop_table("songs")
    op.drop_index("ix_characters_production_id", table_name="characters")
    op.drop_table("characters")
    op.drop_index("ix_acts_production_id", table_name="acts")
    op.drop_table("acts")
    op.drop_index("ix_productions_organization_id", table_name="productions")
    op.drop_table("productions")
    op.drop_index("ix_user_app_roles_app_role_id", table_name="user_app_roles")
    op.drop_index("ix_user_app_roles_user_id", table_name="user_app_roles")
    op.drop_table("user_app_roles")
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_table("users")
    op.drop_table("moment_types")
    op.drop_table("app_roles")
    op.drop_table("organizations")
