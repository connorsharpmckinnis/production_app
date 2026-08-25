"""Shared timeline filter helpers for scene moment lists."""

import re

from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import user_has_role
from app.models import (
    Cue,
    Dialogue,
    Group,
    LyricLine,
    Moment,
    MomentBlocking,
    MomentEntrance,
    MomentExit,
    MomentPropEvent,
    MomentSetPieceEvent,
    SongAttributionCharacter,
    User,
)

# Moment types shown in cue-only rehearsal mode (Phase 2).
CUE_ONLY_TYPES = frozenset({"stage_direction", "song_header", "song_attribution"})

# Hidden from actors — import-only author notes.
ACTOR_HIDDEN_TYPES = frozenset({"author_note"})


def parse_character_ids(raw: str | None) -> list[int] | None:
    """Parse a comma-separated list of character IDs from a query string.

    Raises ValueError when a token is not an integer (callers map this to HTTP 422).
    """
    if not raw:
        return None
    ids: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.append(int(part))
        except ValueError as exc:
            raise ValueError(f"Invalid character_ids value: {part!r}") from exc
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
    """Load all moments for a scene with types, dialogue, lyrics, props, and cues."""
    return (
        db.query(Moment)
        .options(
            joinedload(Moment.moment_type),
            joinedload(Moment.dialogue_lines).joinedload(Dialogue.character),
            joinedload(Moment.lyric_lines).joinedload(LyricLine.character),
            joinedload(Moment.song_attribution_characters).joinedload(
                SongAttributionCharacter.character,
            ),
            joinedload(Moment.stage_directions),
            joinedload(Moment.moment_prop_events),
            joinedload(Moment.moment_set_piece_events),
            joinedload(Moment.moment_costume_events),
            joinedload(Moment.moment_entrances),
            joinedload(Moment.moment_exits),
            joinedload(Moment.moment_blocking).joinedload(MomentBlocking.group).joinedload(
                Group.characters,
            ),
            joinedload(Moment.cues),
        )
        .filter(Moment.scene_id == scene_id)
        .order_by(Moment.sequence_number)
        .all()
    )


def moment_display_text(moment: Moment) -> str:
    """Return the best text to show in timeline list rows after director edits."""
    if moment.moment_type.name == "dialogue" and moment.dialogue_lines:
        lines = sorted(moment.dialogue_lines, key=lambda line: line.id)
        line_based = "\n".join(
            f"{line.character.name}: {line.dialogue_text}" for line in lines
        )
        # Importer stores dialogue body in parsed_text; prefer structured lines unless
        # a director has replaced parsed_text with an explicit correction.
        if moment.parsed_text and len(lines) == 1:
            if moment.parsed_text != lines[0].dialogue_text:
                return moment.parsed_text
        return line_based

    if moment.parsed_text:
        return moment.parsed_text

    if moment.moment_type.name == "stage_direction" and moment.stage_directions:
        return moment.stage_directions[0].direction_text

    return moment.original_text


def moment_ids_with_cues(db: Session, scene_id: int) -> set[int]:
    """Return moment IDs in this scene that have at least one technical cue."""
    rows = (
        db.query(Cue.moment_id)
        .join(Moment, Moment.id == Cue.moment_id)
        .filter(Moment.scene_id == scene_id)
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def moment_ids_with_prop(db: Session, scene_id: int, prop_id: int) -> set[int]:
    """Return moment IDs in this scene that have an on/off event for the given prop."""
    rows = (
        db.query(MomentPropEvent.moment_id)
        .join(Moment, Moment.id == MomentPropEvent.moment_id)
        .filter(Moment.scene_id == scene_id, MomentPropEvent.prop_id == prop_id)
        .all()
    )
    return {row[0] for row in rows}


def moment_ids_with_cue_category(
    db: Session,
    scene_id: int,
    cue_category_id: int,
) -> set[int]:
    """Return moment IDs in this scene that have a cue in the given category."""
    rows = (
        db.query(Cue.moment_id)
        .join(Moment, Moment.id == Cue.moment_id)
        .filter(Moment.scene_id == scene_id, Cue.cue_category_id == cue_category_id)
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def moment_ids_with_set_piece(db: Session, scene_id: int, set_piece_id: int) -> set[int]:
    """Return moment IDs in this scene that have an on/off event for the given set piece."""
    rows = (
        db.query(MomentSetPieceEvent.moment_id)
        .join(Moment, Moment.id == MomentSetPieceEvent.moment_id)
        .filter(Moment.scene_id == scene_id, MomentSetPieceEvent.set_piece_id == set_piece_id)
        .all()
    )
    return {row[0] for row in rows}


def moment_has_costume(moment: Moment) -> bool:
    """True when this moment has at least one costume on/off event."""
    return len(moment.moment_costume_events) > 0


def moment_speaking_character_ids(moment: Moment) -> list[int]:
    """Character IDs that speak or sing in this moment (for highlighting/filters)."""
    ids = {line.character_id for line in moment.dialogue_lines}
    ids.update(line.character_id for line in moment.lyric_lines)
    ids.update(row.character_id for row in moment.song_attribution_characters)
    return list(ids)


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


def moment_has_blocking_for_characters(moment: Moment, character_ids: set[int]) -> bool:
    """True when the moment has blocking for one of the given characters.

    Direct character blocking counts, and so does group blocking when the group
    includes one of the filtered characters.
    """
    if not character_ids:
        return False
    for row in moment.moment_blocking:
        if row.character_id is not None and row.character_id in character_ids:
            return True
        if row.group is not None:
            if any(character.id in character_ids for character in row.group.characters):
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
    song_id: int | None = None,
    prop_id: int | None = None,
    cue_category_id: int | None = None,
    set_piece_id: int | None = None,
    costume_only: bool = False,
    entrance_only: bool = False,
    exit_only: bool = False,
    blocking_only: bool = False,
    blocking_character_ids: set[int] | None = None,
    moment_ids_with_cues: set[int] | None = None,
    moment_ids_with_prop: set[int] | None = None,
    moment_ids_with_cue_category: set[int] | None = None,
    moment_ids_with_set_piece: set[int] | None = None,
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
        cued_ids = moment_ids_with_cues or set()
        filtered = [
            moment
            for moment in filtered
            if moment.moment_type.name in CUE_ONLY_TYPES or moment.id in cued_ids
        ]

    if song_id is not None:
        filtered = [moment for moment in filtered if moment.song_id == song_id]

    if prop_id is not None:
        prop_ids = moment_ids_with_prop or set()
        filtered = [moment for moment in filtered if moment.id in prop_ids]

    if cue_category_id is not None:
        category_ids = moment_ids_with_cue_category or set()
        filtered = [moment for moment in filtered if moment.id in category_ids]

    if set_piece_id is not None:
        piece_ids = moment_ids_with_set_piece or set()
        filtered = [moment for moment in filtered if moment.id in piece_ids]

    if costume_only:
        filtered = [moment for moment in filtered if moment_has_costume(moment)]

    if entrance_only:
        filtered = [moment for moment in filtered if len(moment.moment_entrances) > 0]

    if exit_only:
        filtered = [moment for moment in filtered if len(moment.moment_exits) > 0]

    if blocking_only:
        if blocking_character_ids:
            filtered = [
                moment
                for moment in filtered
                if moment_has_blocking_for_characters(moment, blocking_character_ids)
            ]
        else:
            filtered = [moment for moment in filtered if len(moment.moment_blocking) > 0]

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
