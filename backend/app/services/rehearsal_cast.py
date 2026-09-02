"""Derive who is needed for rehearsal call suggestions from timeline presence."""

from sqlalchemy.orm import Session

from app.models import (
    Act,
    Character,
    Dialogue,
    LyricLine,
    Moment,
    MomentEntrance,
    MomentExit,
    Scene,
    User,
    UserCharacterAssignment,
)
from app.services.production_memberships import list_active_production_users


def character_ids_in_scenes(
    db: Session,
    production_id: int,
    scene_ids: list[int],
) -> set[int]:
    """Characters with dialogue, lyrics, entrance, or exit in any of the scenes."""
    if not scene_ids:
        return set()

    dialogue_ids = {
        row[0]
        for row in (
            db.query(Dialogue.character_id)
            .join(Moment, Moment.id == Dialogue.moment_id)
            .join(Scene, Scene.id == Moment.scene_id)
            .join(Act, Act.id == Scene.act_id)
            .filter(
                Moment.scene_id.in_(scene_ids),
                Act.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    lyric_ids = {
        row[0]
        for row in (
            db.query(LyricLine.character_id)
            .join(Moment, Moment.id == LyricLine.moment_id)
            .join(Scene, Scene.id == Moment.scene_id)
            .join(Act, Act.id == Scene.act_id)
            .filter(
                Moment.scene_id.in_(scene_ids),
                Act.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    entrance_ids = {
        row[0]
        for row in (
            db.query(MomentEntrance.character_id)
            .join(Moment, Moment.id == MomentEntrance.moment_id)
            .join(Scene, Scene.id == Moment.scene_id)
            .join(Act, Act.id == Scene.act_id)
            .filter(
                Moment.scene_id.in_(scene_ids),
                Act.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    exit_ids = {
        row[0]
        for row in (
            db.query(MomentExit.character_id)
            .join(Moment, Moment.id == MomentExit.moment_id)
            .join(Scene, Scene.id == Moment.scene_id)
            .join(Act, Act.id == Scene.act_id)
            .filter(
                Moment.scene_id.in_(scene_ids),
                Act.production_id == production_id,
            )
            .distinct()
            .all()
        )
    }
    return dialogue_ids | lyric_ids | entrance_ids | exit_ids


def suggested_users_for_scenes(
    db: Session,
    production_id: int,
    scene_ids: list[int],
) -> list[tuple[User, list[str]]]:
    """Return cast users who play characters present in the scenes.

    Each item is (user, character_names in those scenes).
    """
    character_ids = character_ids_in_scenes(db, production_id, scene_ids)
    if not character_ids:
        return []

    actor_user_ids = {
        user.id
        for user in list_active_production_users(db, production_id, role_code="actor")
    }
    if not actor_user_ids:
        return []

    rows = (
        db.query(User, Character)
        .join(UserCharacterAssignment, UserCharacterAssignment.user_id == User.id)
        .join(Character, Character.id == UserCharacterAssignment.character_id)
        .filter(
            Character.production_id == production_id,
            Character.id.in_(character_ids),
            User.id.in_(actor_user_ids),
        )
        .order_by(User.last_name, User.first_name, Character.name)
        .all()
    )

    by_user: dict[int, tuple[User, list[str]]] = {}
    for user, character in rows:
        if user.id not in by_user:
            by_user[user.id] = (user, [])
        by_user[user.id][1].append(character.name)
    return list(by_user.values())


def scene_recommendations(
    db: Session,
    production_id: int,
) -> list[Scene]:
    """Scenes ordered by times_rehearsed ascending (never-run first)."""
    return (
        db.query(Scene)
        .join(Act, Act.id == Scene.act_id)
        .filter(Act.production_id == production_id)
        .order_by(Scene.times_rehearsed.asc(), Act.number.asc(), Scene.sort_order.asc())
        .all()
    )


def validate_scenes_in_production(
    db: Session,
    production_id: int,
    scene_ids: list[int],
) -> list[Scene]:
    if not scene_ids:
        return []
    scenes = (
        db.query(Scene)
        .join(Act, Act.id == Scene.act_id)
        .filter(Act.production_id == production_id, Scene.id.in_(scene_ids))
        .all()
    )
    found = {s.id for s in scenes}
    missing = set(scene_ids) - found
    if missing:
        raise ValueError(f"Scenes not in production: {sorted(missing)}")
    return scenes
