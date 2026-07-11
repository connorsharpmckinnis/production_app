"""Derive on-stage character sets from entrance/exit sequence within a scene."""

from sqlalchemy.orm import Session, joinedload

from app.models import Character, Moment, MomentEntrance, MomentExit


def on_stage_character_ids_for_moment(db: Session, moment: Moment) -> list[int]:
    """Return character IDs on stage at this moment (after its entrances/exits)."""
    scene_moments = (
        db.query(Moment)
        .options(
            joinedload(Moment.moment_entrances),
            joinedload(Moment.moment_exits),
        )
        .filter(Moment.scene_id == moment.scene_id)
        .order_by(Moment.sequence_number)
        .all()
    )

    on_stage: set[int] = set()
    for scene_moment in scene_moments:
        for entrance in scene_moment.moment_entrances:
            on_stage.add(entrance.character_id)
        for exit_row in scene_moment.moment_exits:
            on_stage.discard(exit_row.character_id)
        if scene_moment.id == moment.id:
            break

    return sorted(on_stage)


def on_stage_characters_for_moment(db: Session, moment: Moment) -> list[Character]:
    """Return Character rows on stage at this moment, sorted by name."""
    character_ids = on_stage_character_ids_for_moment(db, moment)
    if not character_ids:
        return []

    characters = (
        db.query(Character)
        .filter(Character.id.in_(character_ids))
        .order_by(Character.name)
        .all()
    )
    return characters


def scene_has_entrances_or_exits(db: Session, scene_id: int) -> bool:
    """True when the scene has at least one entrance or exit attachment."""
    entrance = (
        db.query(MomentEntrance.id)
        .join(Moment, Moment.id == MomentEntrance.moment_id)
        .filter(Moment.scene_id == scene_id)
        .first()
    )
    if entrance is not None:
        return True
    exit_row = (
        db.query(MomentExit.id)
        .join(Moment, Moment.id == MomentExit.moment_id)
        .filter(Moment.scene_id == scene_id)
        .first()
    )
    return exit_row is not None
