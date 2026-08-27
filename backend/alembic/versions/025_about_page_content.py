"""About page markdown and content images

Revision ID: 025
Revises: 024
Create Date: 2026-08-26

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("app_settings", sa.Column("about_markdown", sa.Text(), nullable=True))
    op.add_column(
        "app_settings",
        sa.Column("about_markdown_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "app_content_images",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("content_type", sa.String(length=64), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("app_content_images")
    op.drop_column("app_settings", "about_markdown_updated_at")
    op.drop_column("app_settings", "about_markdown")
