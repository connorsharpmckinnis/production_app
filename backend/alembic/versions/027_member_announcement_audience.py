"""Allow production announcements to target Member memberships.

Revision ID: 027
Revises: 026
Create Date: 2026-08-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_announcement_audience_roles_role_name",
        "announcement_audience_roles",
        type_="check",
    )
    op.create_check_constraint(
        "ck_announcement_audience_roles_role_name",
        "announcement_audience_roles",
        "role_name IN ('Admin', 'Director', 'Actor', 'Member')",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM announcement_audience_roles "
            "WHERE role_name = 'Member'"
        )
    )
    op.drop_constraint(
        "ck_announcement_audience_roles_role_name",
        "announcement_audience_roles",
        type_="check",
    )
    op.create_check_constraint(
        "ck_announcement_audience_roles_role_name",
        "announcement_audience_roles",
        "role_name IN ('Admin', 'Director', 'Actor')",
    )
