"""Shared timeline filter helpers for scene moment lists."""

import re

from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import user_has_role
from app.models import Dialogue, Moment, User

# Moment types shown in cue-only rehearsal mode (Phase 2).
CUE_ONLY_TYPES = frozenset({"stage_direction", "song_header", "song_attribution"})

# Hidden from actors — import-only author notes.
ACTOR_HIDDEN_TYPES = frozenset({"author_note"})


def parse_character_ids(raw: str | None) -> list[int] | None:
    """Parse a comma-separated list of character IDs from a query string."""
    if not raw:
        return None
    ids: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        ids.append(int(part))
    return ids or None


def get_actor_character_ids(db: Session, user: User, production_id: int) -> list[int]:
    """Return character IDs this actor is cast to in the given production."""
    from app.models import Character, UserCharacterAssignment

    rows = (
        db.query(Character.id)
        .join(UserCharacterAssignment, UserCharacterAssignment.character_id == Character.id)
        .filter(
            Character.production_id == production_id,
            UserCharacterAssignment.user_id == user.id,
        )
        .all()
    )
    return [row[0] for row in rows]


def load_scene_moments(db: Session, scene_id: int) -> list[Moment]:
    """Load all moments for a scene with types and dialogue characters."""
    return (
        db.query(Moment)
        .options(
            joinedload(Moment.moment_type),
            joinedload(Moment.dialogue_lines).joinedload(Dialogue.character),
        )
        .filter(Moment.scene_id == scene_id)
        .order_by(Moment.sequence_number)
        .all()
    )


def moment_speaking_character_ids(moment: Moment) -> list[int]:
    """Character IDs that speak in this moment (for highlighting)."""
    return list({line.character_id for line in moment.dialogue_lines})


def _character_name_patterns(names: list[str]) -> list[re.Pattern[str]]:
    return [re.compile(rf"\b{re.escape(name)}\b") for name in names]


def stage_direction_references_characters(text: str, character_names: list[str]) -> bool:
    """True when stage direction text mentions one of the character names."""
    if not character_names:
        return False
    return any(pattern.search(text) for pattern in _character_name_patterns(character_names))


def moment_matches_character_filter(
    moment: Moment,
    character_ids: list[int],
    character_names: list[str] | None = None,
) -> bool:
    """True when the moment belongs to one of the selected characters."""
    if not character_ids:
        return True

    speaking = moment_speaking_character_ids(moment)
    if any(character_id in character_ids for character_id in speaking):
        return True

    if (
        moment.moment_type.name == "stage_direction"
        and character_names
        and stage_direction_references_characters(moment.original_text, character_names)
    ):
        return True

    return False


def apply_timeline_filters(
    moments: list[Moment],
    *,
    user: User,
    character_ids: list[int] | None = None,
    character_names: list[str] | None = None,
    search: str | None = None,
    cue_only: bool = False,
) -> list[Moment]:
    """Filter moments for timeline display while preserving sequence order."""
    filtered = moments

    if user_has_role(user, "Actor"):
        filtered = [
            moment
            for moment in filtered
            if moment.moment_type.name not in ACTOR_HIDDEN_TYPES
        ]

    if cue_only:
        filtered = [
            moment
            for moment in filtered
            if moment.moment_type.name in CUE_ONLY_TYPES
        ]

    if character_ids:
        filtered = [
            moment
            for moment in filtered
            if moment_matches_character_filter(moment, character_ids, character_names)
        ]

    if search:
        needle = search.casefold()
        filtered = [
            moment
            for moment in filtered
            if needle in moment.original_text.casefold()
        ]

    return filtered
