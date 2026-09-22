"""Derive on-stage character, group, and user sets from entrance/exit sequence within a scene."""

from sqlalchemy.orm import Session, joinedload

from app.models import Character, Group, Moment, MomentEntrance, MomentExit, User


def _walk_scene_moments(db: Session, moment: Moment) -> list[Moment]:
    return (
        db.query(Moment)
        .options(
            joinedload(Moment.moment_entrances),
            joinedload(Moment.moment_exits),
        )
        .filter(Moment.scene_id == moment.scene_id)
        .order_by(Moment.sequence_number)
        .all()
    )


def on_stage_character_ids_for_moment(db: Session, moment: Moment) -> list[int]:
    """Return character IDs on stage at this moment (after its entrances/exits)."""
    on_stage: set[int] = set()
    for scene_moment in _walk_scene_moments(db, moment):
        for entrance in scene_moment.moment_entrances:
            if entrance.character_id is not None:
                on_stage.add(entrance.character_id)
        for exit_row in scene_moment.moment_exits:
            if exit_row.character_id is not None:
                on_stage.discard(exit_row.character_id)
        if scene_moment.id == moment.id:
            break

    return sorted(on_stage)


def on_stage_group_ids_for_moment(db: Session, moment: Moment) -> list[int]:
    """Return group IDs on stage at this moment (after its entrances/exits)."""
    on_stage: set[int] = set()
    for scene_moment in _walk_scene_moments(db, moment):
        for entrance in scene_moment.moment_entrances:
            if entrance.group_id is not None:
                on_stage.add(entrance.group_id)
        for exit_row in scene_moment.moment_exits:
            if exit_row.group_id is not None:
                on_stage.discard(exit_row.group_id)
        if scene_moment.id == moment.id:
            break

    return sorted(on_stage)


def on_stage_user_ids_for_moment(db: Session, moment: Moment) -> list[int]:
    """Return user IDs on stage at this moment (after its entrances/exits)."""
    on_stage: set[int] = set()
    for scene_moment in _walk_scene_moments(db, moment):
        for entrance in scene_moment.moment_entrances:
            if entrance.user_id is not None:
                on_stage.add(entrance.user_id)
        for exit_row in scene_moment.moment_exits:
            if exit_row.user_id is not None:
                on_stage.discard(exit_row.user_id)
        if scene_moment.id == moment.id:
            break

    return sorted(on_stage)


def on_stage_characters_for_moment(db: Session, moment: Moment) -> list[Character]:
    """Return Character rows on stage at this moment, sorted by name."""
    character_ids = on_stage_character_ids_for_moment(db, moment)
    if not character_ids:
        return []

    return (
        db.query(Character)
        .filter(Character.id.in_(character_ids))
        .order_by(Character.name)
        .all()
    )


def on_stage_groups_for_moment(db: Session, moment: Moment) -> list[Group]:
    """Return Group rows on stage at this moment, sorted by name."""
    group_ids = on_stage_group_ids_for_moment(db, moment)
    if not group_ids:
        return []

    return (
        db.query(Group)
        .filter(Group.id.in_(group_ids))
        .order_by(Group.name)
        .all()
    )


def on_stage_users_for_moment(db: Session, moment: Moment) -> list[User]:
    """Return User rows on stage at this moment, sorted by name."""
    user_ids = on_stage_user_ids_for_moment(db, moment)
    if not user_ids:
        return []

    return (
        db.query(User)
        .filter(User.id.in_(user_ids))
        .order_by(User.first_name, User.last_name, User.username)
        .all()
    )


def compute_on_stage_ids_by_moment(moments: list[Moment]) -> dict[int, list[int]]:
    """Compute on-stage character IDs after each moment in sequence order."""
    on_stage: set[int] = set()
    result: dict[int, list[int]] = {}

    for moment in moments:
        for entrance in moment.moment_entrances:
            if entrance.character_id is not None:
                on_stage.add(entrance.character_id)
        for exit_row in moment.moment_exits:
            if exit_row.character_id is not None:
                on_stage.discard(exit_row.character_id)
        result[moment.id] = sorted(on_stage)

    return result


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
