"""Import a Google Docs Markdown script into production timeline records."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models import (
    Act,
    Character,
    Dialogue,
    Moment,
    MomentType,
    Production,
    Scene,
    Song,
    StageDirection,
)
from app.services.importer.builtins import BUILTIN_CHARACTER_NAMES, BUILTIN_SINGER_NAMES
from app.services.importer.errors import ImportLineError
from app.services.importer.parentheticals import parse_speaker_names, parse_singer_line
from app.services.importer.patterns import (
    RE_ACT,
    RE_ALL_CAPS_LINE,
    RE_AUTHOR,
    RE_AUTHOR_NOTE,
    RE_AUTHOR_NOTE_H4,
    RE_DIALOGUE,
    RE_END_OF_ACT,
    RE_END_OF_SCENE,
    RE_FOOTNOTE_DEF,
    RE_H4,
    RE_H4_ITALIC,
    RE_SCENE,
    RE_SONG_HEADER,
    RE_STAGE_DIRECTION,
    RE_TITLE,
)
from app.services.importer.preprocessing import preprocess_script
from app.services.importer.word_numbers import parse_number

SONG_MOMENT_TYPES = frozenset({"song_header", "song_attribution", "lyric"})


@dataclass
class ImportState:
    production_title: str | None = None
    production_author: str | None = None
    current_act: Act | None = None
    current_scene: Scene | None = None
    current_song: Song | None = None
    sequence_number: int = 0
    title_page_complete: bool = False
    characters: dict[str, Character] = field(default_factory=dict)
    dialogue_character_names: set[str] = field(default_factory=set)
    moment_types: dict[str, MomentType] = field(default_factory=dict)


@dataclass
class ImportResult:
    acts_created: int = 0
    scenes_created: int = 0
    moments_created: int = 0
    characters_created: int = 0
    songs_created: int = 0


def _load_moment_types(db: Session) -> dict[str, MomentType]:
    types = db.query(MomentType).all()
    return {mt.name: mt for mt in types}


def _collect_dialogue_character_names(lines: list[str]) -> set[str]:
    """Pre-scan script for speaker names from dialogue lines, plus built-in singers."""
    names: set[str] = set(BUILTIN_SINGER_NAMES)
    for line in lines:
        if match := RE_DIALOGUE.match(line):
            for name in parse_speaker_names(match.group(1).strip()):
                names.add(name)
    return names


def _ensure_builtin_characters(
    db: Session,
    production: Production,
    state: ImportState,
) -> None:
    for name in BUILTIN_CHARACTER_NAMES:
        _get_or_create_character(db, production, state, name)


def _require_scene(state: ImportState, line_number: int, line_content: str) -> Scene:
    if state.current_scene is None:
        raise ImportLineError(
            line_number,
            line_content,
            "No Scene defined yet — moment line before first Scene heading",
        )
    return state.current_scene


def _next_sequence(state: ImportState) -> int:
    state.sequence_number += 1
    return state.sequence_number


def _get_or_create_character(
    db: Session,
    production: Production,
    state: ImportState,
    name: str,
) -> Character:
    if name in state.characters:
        return state.characters[name]

    character = Character(production_id=production.id, name=name)
    db.add(character)
    db.flush()
    state.characters[name] = character
    state.dialogue_character_names.add(name)
    return character


def _song_id_for_moment(state: ImportState, moment_type_name: str) -> int | None:
    if moment_type_name in SONG_MOMENT_TYPES and state.current_song is not None:
        return state.current_song.id
    return None


def _create_moment(
    db: Session,
    state: ImportState,
    moment_type_name: str,
    original_text: str,
    parsed_text: str | None = None,
) -> Moment:
    scene = _require_scene(state, 0, original_text)
    moment_type = state.moment_types[moment_type_name]
    moment = Moment(
        scene_id=scene.id,
        moment_type_id=moment_type.id,
        song_id=_song_id_for_moment(state, moment_type_name),
        sequence_number=_next_sequence(state),
        original_text=original_text,
        parsed_text=parsed_text,
    )
    db.add(moment)
    db.flush()
    return moment


def _handle_stage_direction(
    db: Session,
    state: ImportState,
    line: str,
) -> None:
    moment = _create_moment(db, state, "stage_direction", line)
    inner = line.strip("*").strip()
    db.add(StageDirection(moment_id=moment.id, direction_text=inner))


def _handle_dialogue(
    db: Session,
    production: Production,
    state: ImportState,
    line: str,
    speaker_raw: str,
    dialogue_text: str,
) -> None:
    speakers = parse_speaker_names(speaker_raw)
    for speaker in speakers:
        _get_or_create_character(db, production, state, speaker)

    # MVP: keep all parentheticals inline (vocal cues and stage action alike).
    text = dialogue_text.strip()
    moment = _create_moment(db, state, "dialogue", line, parsed_text=text or None)
    for speaker in speakers:
        character = state.characters[speaker]
        db.add(
            Dialogue(
                moment_id=moment.id,
                character_id=character.id,
                dialogue_text=text,
            ),
        )


def _classify_song_block_line(
    state: ImportState,
    content: str,
) -> str:
    """Return moment type name: song_attribution or lyric."""
    stripped = content.strip()
    if parse_singer_line(stripped, state.dialogue_character_names):
        return "song_attribution"
    if len(stripped) >= 4 and RE_ALL_CAPS_LINE.match(stripped):
        return "lyric"
    raise ImportLineError(0, stripped, "Cannot classify line in song block")


def _handle_h4_line(
    db: Session,
    state: ImportState,
    content: str,
    line_prefix: str = "#### ",
) -> None:
    stripped = content.strip()
    if not stripped:
        return

    if RE_H4_ITALIC.match(stripped) or any(c.islower() for c in stripped):
        if state.current_song is not None:
            existing = state.current_song.description or ""
            addition = stripped.strip("*").strip()
            state.current_song.description = (
                f"{existing}\n{addition}".strip() if existing else addition
            )
        return

    moment_type = _classify_song_block_line(state, stripped)
    _create_moment(db, state, moment_type, f"{line_prefix}{stripped}")


def _handle_plain_caps_in_song(
    db: Session,
    state: ImportState,
    line: str,
) -> None:
    stripped = line.strip()
    moment_type = _classify_song_block_line(state, stripped)
    _create_moment(db, state, moment_type, stripped)


def _is_ignored_line(line: str) -> bool:
    return bool(
        RE_END_OF_SCENE.match(line)
        or RE_END_OF_ACT.match(line)
        or RE_FOOTNOTE_DEF.match(line)
    )


def _classify_and_process_line(
    db: Session,
    production: Production,
    state: ImportState,
    line_number: int,
    line: str,
) -> None:
    if not line.strip():
        return

    if _is_ignored_line(line):
        return

    if not state.title_page_complete:
        if match := RE_TITLE.match(line):
            state.production_title = match.group(1).strip()
            return
        if match := RE_AUTHOR.match(line):
            state.production_author = match.group(1).strip()
            return

    if match := RE_ACT.match(line):
        number = parse_number(match.group(1))
        act = Act(
            production_id=production.id,
            number=number,
            title=f"Act {number}",
            sort_order=number,
        )
        db.add(act)
        db.flush()
        state.current_act = act
        state.current_scene = None
        state.current_song = None
        state.sequence_number = 0
        state.title_page_complete = True
        return

    if match := RE_SCENE.match(line):
        if state.current_act is None:
            raise ImportLineError(line_number, line, "Scene heading before any Act")
        number = parse_number(match.group(1))
        title = match.group(2).strip()
        scene = Scene(
            act_id=state.current_act.id,
            number=number,
            title=title,
            sort_order=number,
        )
        db.add(scene)
        db.flush()
        state.current_scene = scene
        state.current_song = None
        state.sequence_number = 0
        return

    if match := RE_SONG_HEADER.match(line):
        title = match.group(1).strip()
        song = Song(production_id=production.id, title=title)
        db.add(song)
        db.flush()
        state.current_song = song
        _create_moment(db, state, "song_header", line)
        return

    if match := RE_H4.match(line):
        if state.current_song is None:
            raise ImportLineError(
                line_number,
                line,
                "H4 line outside of song block context",
            )
        try:
            _handle_h4_line(db, state, match.group(1))
        except ImportLineError as exc:
            raise ImportLineError(line_number, line, exc.message) from exc
        return

    if state.current_song is not None and line.strip() in ("####", "#### "):
        return

    if state.current_song is not None and RE_ALL_CAPS_LINE.match(line.strip()):
        try:
            _handle_plain_caps_in_song(db, state, line)
        except ImportLineError as exc:
            raise ImportLineError(line_number, line, exc.message) from exc
        return

    if match := RE_STAGE_DIRECTION.match(line):
        _handle_stage_direction(db, state, line)
        return

    if match := RE_DIALOGUE.match(line):
        _handle_dialogue(
            db,
            production,
            state,
            line,
            match.group(1).strip(),
            match.group(2),
        )
        return

    if match := RE_AUTHOR_NOTE.match(line) or RE_AUTHOR_NOTE_H4.match(line):
        _create_moment(db, state, "author_note", line)
        return

    raise ImportLineError(line_number, line, f'Unrecognized format — "{line}"')


def import_script(
    db: Session,
    production: Production,
    content: bytes | str,
) -> ImportResult:
    """
    Import script content into an existing production.

    Rolls back the entire transaction on any line error.
    """
    existing_acts = db.query(Act).filter(Act.production_id == production.id).count()
    if existing_acts > 0:
        raise ValueError("Production already has imported content; re-import is not allowed")

    lines = preprocess_script(content)
    state = ImportState(
        moment_types=_load_moment_types(db),
        dialogue_character_names=_collect_dialogue_character_names(lines),
    )
    result = ImportResult()

    try:
        _ensure_builtin_characters(db, production, state)

        for line_number, line in enumerate(lines, start=1):
            _classify_and_process_line(db, production, state, line_number, line)

        if state.production_title:
            production.title = state.production_title
        if state.production_author:
            production.author = state.production_author

        db.flush()

        result.acts_created = db.query(Act).filter(Act.production_id == production.id).count()
        result.scenes_created = (
            db.query(Scene)
            .join(Act)
            .filter(Act.production_id == production.id)
            .count()
        )
        result.moments_created = (
            db.query(Moment)
            .join(Scene)
            .join(Act)
            .filter(Act.production_id == production.id)
            .count()
        )
        result.characters_created = (
            db.query(Character).filter(Character.production_id == production.id).count()
        )
        result.songs_created = (
            db.query(Song).filter(Song.production_id == production.id).count()
        )

        db.commit()
        return result
    except ImportLineError:
        db.rollback()
        raise
