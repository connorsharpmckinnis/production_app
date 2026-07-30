"""Unique act/scene/moment numbers for human Timeline deep links.

Revision ID: 021
Revises: 020
Create Date: 2026-07-29
"""

from typing import Sequence, Union

from alembic import op

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_acts_production_id_number",
        "acts",
        ["production_id", "number"],
    )
    op.create_unique_constraint(
        "uq_scenes_act_id_number",
        "scenes",
        ["act_id", "number"],
    )
    op.create_unique_constraint(
        "uq_moments_scene_id_sequence_number",
        "moments",
        ["scene_id", "sequence_number"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_moments_scene_id_sequence_number",
        "moments",
        type_="unique",
    )
    op.drop_constraint(
        "uq_scenes_act_id_number",
        "scenes",
        type_="unique",
    )
    op.drop_constraint(
        "uq_acts_production_id_number",
        "acts",
        type_="unique",
    )
