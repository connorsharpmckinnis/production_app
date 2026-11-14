"""Load a read-only scene context for suggestion rules."""

from dataclasses import dataclass

from sqlalchemy.orm import Session, joinedload

from app.models import Character, CharacterGroup, Group, Moment, Scene
from app.services.importer.builtins import BUILTIN_CHARACTER_NAMES
from app.services.timeline_filters import (
    load_scene_moments,
    moment_speaking_character_ids,
    moment_speaking_group_ids,
)


@dataclass
class SceneSuggestionContext:
    production_id: int
    scene_id: int
    moments: list[Moment]
    character_names: dict[int, str]
    group_names: dict[int, str]
    group_member_ids: dict[int, set[int]]
    builtin_character_ids: set[int]
    # After each moment (inclusive of that moment's entrances/exits)
    on_stage_characters_after: dict[int, set[int]]
    on_stage_groups_after: dict[int, set[int]]
    # Before each moment (state entering the moment)
    on_stage_characters_before: dict[int, set[int]]
    on_stage_groups_before: dict[int, set[int]]


def _walk_on_stage_tracks(
    moments: list[Moment],
) -> tuple[
    dict[int, set[int]],
    dict[int, set[int]],
    dict[int, set[int]],
    dict[int, set[int]],
]:
    characters_after: dict[int, set[int]] = {}
    groups_after: dict[int, set[int]] = {}
    characters_before: dict[int, set[int]] = {}
    groups_before: dict[int, set[int]] = {}

    on_chars: set[int] = set()
    on_groups: set[int] = set()

    for moment in moments:
        characters_before[moment.id] = set(on_chars)
        groups_before[moment.id] = set(on_groups)

        for entrance in moment.moment_entrances:
            if entrance.character_id is not None:
                on_chars.add(entrance.character_id)
            if entrance.group_id is not None:
                on_groups.add(entrance.group_id)
        for exit_row in moment.moment_exits:
            if exit_row.character_id is not None:
                on_chars.discard(exit_row.character_id)
            if exit_row.group_id is not None:
                on_groups.discard(exit_row.group_id)

        characters_after[moment.id] = set(on_chars)
        groups_after[moment.id] = set(on_groups)

    return characters_after, groups_after, characters_before, groups_before


def load_scene_suggestion_context(
    db: Session,
    *,
    production_id: int,
    scene_id: int,
) -> SceneSuggestionContext:
    scene = (
        db.query(Scene)
        .options(joinedload(Scene.act))
        .filter(Scene.id == scene_id)
        .first()
    )
    if scene is None or scene.act.production_id != production_id:
        raise ValueError("Scene not found in production")

    moments = load_scene_moments(db, scene_id)

    characters = (
        db.query(Character)
        .filter(Character.production_id == production_id)
        .all()
    )
    character_names = {character.id: character.name for character in characters}
    builtin_character_ids = {
        character.id
        for character in characters
        if character.name in BUILTIN_CHARACTER_NAMES
    }

    groups = (
        db.query(Group)
        .options(joinedload(Group.characters))
        .filter(Group.production_id == production_id)
        .all()
    )
    group_names = {group.id: group.name for group in groups}
    group_member_ids = {
        group.id: {character.id for character in group.characters} for group in groups
    }

    # Ensure membership map includes groups that only appear via association query
    if not group_member_ids:
        rows = (
            db.query(CharacterGroup.group_id, CharacterGroup.character_id)
            .join(Group, Group.id == CharacterGroup.group_id)
            .filter(Group.production_id == production_id)
            .all()
        )
        for group_id, character_id in rows:
            group_member_ids.setdefault(group_id, set()).add(character_id)

    (
        on_stage_characters_after,
        on_stage_groups_after,
        on_stage_characters_before,
        on_stage_groups_before,
    ) = _walk_on_stage_tracks(moments)

    return SceneSuggestionContext(
        production_id=production_id,
        scene_id=scene_id,
        moments=moments,
        character_names=character_names,
        group_names=group_names,
        group_member_ids=group_member_ids,
        builtin_character_ids=builtin_character_ids,
        on_stage_characters_after=on_stage_characters_after,
        on_stage_groups_after=on_stage_groups_after,
        on_stage_characters_before=on_stage_characters_before,
        on_stage_groups_before=on_stage_groups_before,
    )


def speaking_subjects_for_moment(
    ctx: SceneSuggestionContext,
    moment: Moment,
) -> list[tuple[str, int]]:
    """Return (kind, id) speakers on a moment, excluding builtin characters."""
    subjects: list[tuple[str, int]] = []
    for character_id in moment_speaking_character_ids(moment):
        if character_id in ctx.builtin_character_ids:
            continue
        subjects.append(("character", character_id))
    for group_id in moment_speaking_group_ids(moment):
        subjects.append(("group", group_id))
    return subjects


def character_covered_before(
    ctx: SceneSuggestionContext,
    moment_id: int,
    character_id: int,
) -> bool:
    if character_id in ctx.on_stage_characters_before.get(moment_id, set()):
        return True
    on_groups = ctx.on_stage_groups_before.get(moment_id, set())
    for group_id in on_groups:
        if character_id in ctx.group_member_ids.get(group_id, set()):
            return True
    return False


def group_covered_before(
    ctx: SceneSuggestionContext,
    moment_id: int,
    group_id: int,
) -> bool:
    return group_id in ctx.on_stage_groups_before.get(moment_id, set())


def entrance_already_on_moment(
    moment: Moment,
    *,
    character_id: int | None = None,
    group_id: int | None = None,
) -> bool:
    for entrance in moment.moment_entrances:
        if character_id is not None and entrance.character_id == character_id:
            return True
        if group_id is not None and entrance.group_id == group_id:
            return True
    return False
