"""Import a Google Docs Markdown script into production timeline records."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models import (
    Act,
    Character,
    Dialogue,
    LyricLine,
    Moment,
    MomentType,
    Production,
    Scene,
    Song,
    SongAttributionCharacter,
    StageDirection,
)
from app.services.importer.builtins import BUILTIN_CHARACTER_NAMES, BUILTIN_SINGER_NAMES
from app.services.importer.errors import ImportIssue, ImportLineError
from app.services.importer.extract import ExtractedLine, extract_script
from app.services.importer.grammar import (
    SpeakerListError,
    is_all_caps_lyric,
    is_song_section_label,
    parse_dialogue_line,
    parse_performer_line,
    validate_song_title,
)
from app.services.importer.patterns import (
    RE_ACT,
    RE_ACT_PLAIN,
    RE_AUTHOR,
    RE_AUTHOR_NOTE,
    RE_AUTHOR_NOTE_H4,
    RE_AUTHOR_PLAIN,
    RE_END_OF_ACT,
    RE_END_OF_SCENE,
    RE_FOOTNOTE_DEF,
    RE_H4,
    RE_H4_ITALIC,
    RE_SCENE,
    RE_SCENE_PLAIN,
    RE_SONG_HEADER,
    RE_SONG_HEADER_PLAIN,
    RE_STAGE_DIRECTION,
    RE_TITLE,
    RE_TITLE_PLAIN,
)
from app.services.importer.preprocessing import (
    ScriptDecodeError,
    preprocess_lines,
    preprocess_script,
)
from app.services.importer.word_numbers import parse_number

SONG_MOMENT_TYPES = frozenset({"song_header", "song_attribution", "lyric"})


@dataclass
class ImportState:
    production_title: str | None = None
    production_author: str | None = None
    current_act: Act | None = None
    current_scene: Scene | None = None
    current_song: Song | None = None
    current_performers: list[str] = field(default_factory=list)
    sequence_number: int = 0
    title_page_complete: bool = False
    characters: dict[str, Character] = field(default_factory=dict)
    dialogue_character_names: set[str] = field(default_factory=set)
    moment_types: dict[str, MomentType] = field(default_factory=dict)
    source_format: str | None = None
    line_metadata: list[ExtractedLine] = field(default_factory=list)
    # After a structural or song-block failure, skip lines until a safe resume point.
    # "act_or_scene" resumes on Act/Scene; "song_boundary" also resumes on song headers.
    recovery_mode: str | None = None


def _clear_song_context(state: ImportState) -> None:
    state.current_song = None
    state.current_performers = []


@dataclass
class ImportResult:
    acts_created: int = 0
    scenes_created: int = 0
    moments_created: int = 0
    characters_created: int = 0
    songs_created: int = 0
    script_title: str | None = None


def _load_moment_types(db: Session) -> dict[str, MomentType]:
    types = db.query(MomentType).all()
    return {mt.name: mt for mt in types}


def _collect_dialogue_character_names(lines: list[str]) -> set[str]:
    """Pre-scan script for speaker names from dialogue lines, plus built-in singers."""
    names: set[str] = set(BUILTIN_SINGER_NAMES)
    for line in lines:
        try:
            dialogue = parse_dialogue_line(line)
        except SpeakerListError:
            continue
        if dialogue is not None:
            speakers, _ = dialogue
            names.update(speakers)
    return names


def _ensure_builtin_characters(
    db: Session,
    production: Production,
    state: ImportState,
) -> None:
    for name in BUILTIN_CHARACTER_NAMES:
        _get_or_create_character(db, production, state, name)


_CONTEXT_BEFORE = 3
_CONTEXT_LINE_MAX = 100


def _truncate_context_line(text: str) -> str:
    if len(text) <= _CONTEXT_LINE_MAX:
        return text
    return text[:_CONTEXT_LINE_MAX] + "..."


def _build_context_snippet(state: ImportState, line_number: int) -> str | None:
    """Return a short preview of lines leading up to and including the failure."""
    if not state.line_metadata or line_number < 1:
        return None
    error_index = line_number - 1
    if error_index >= len(state.line_metadata):
        return None

    preceding: list[str] = []
    for meta in reversed(state.line_metadata[:error_index]):
        text = meta.text.strip()
        if not text:
            continue
        preceding.append(_truncate_context_line(text))
        if len(preceding) >= _CONTEXT_BEFORE:
            break
    preceding.reverse()

    error_text = state.line_metadata[error_index].text.strip() or "(blank line)"
    preceding.append(_truncate_context_line(error_text))
    return "\n".join(preceding)


def _annotate_error(
    state: ImportState,
    line_number: int,
    line_content: str,
    message: str,
) -> ImportLineError:
    meta = None
    if 1 <= line_number <= len(state.line_metadata):
        meta = state.line_metadata[line_number - 1]
    issue = ImportIssue(
        line_number=line_number,
        line_content=line_content,
        message=message,
        source_format=state.source_format,
        paragraph_number=meta.paragraph_number if meta else None,
        paragraph_style=meta.paragraph_style if meta else None,
        context_snippet=_build_context_snippet(state, line_number),
    )
    return ImportLineError(issue)


def _is_act_or_scene_line(line: str) -> bool:
    return bool(
        RE_ACT.match(line)
        or RE_ACT_PLAIN.match(line)
        or RE_SCENE.match(line)
        or RE_SCENE_PLAIN.match(line)
    )


def _is_song_header_line(line: str) -> bool:
    return bool(RE_SONG_HEADER.match(line) or RE_SONG_HEADER_PLAIN.match(line))


def _is_song_boundary_line(line: str) -> bool:
    return _is_act_or_scene_line(line) or _is_song_header_line(line)


def _is_structural_context_error(message: str) -> bool:
    return message.startswith("No Scene defined yet") or message.startswith(
        "Scene heading before any Act"
    )


def _error_is_in_song_context(state: ImportState, line: str) -> bool:
    if state.current_song is not None:
        return True
    return _is_song_header_line(line)


def _to_song_issue(state: ImportState, issue: ImportIssue) -> ImportIssue:
    title = state.current_song.title if state.current_song is not None else None
    if title:
        message = (
            f'Something\'s wrong with the song "{title}". '
            "Skipping the rest of this song block. "
            f"First problem: {issue.message}"
        )
    else:
        message = (
            "Something's wrong with this song block. "
            "Skipping until the next Act, Scene, or song header. "
            f"First problem: {issue.message}"
        )
    return ImportIssue(
        line_number=issue.line_number,
        line_content=issue.line_content,
        message=message,
        source_format=issue.source_format,
        paragraph_number=issue.paragraph_number,
        paragraph_style=issue.paragraph_style,
        context_snippet=issue.context_snippet,
        kind="song",
        song_title=title,
    )


def _require_scene(
    state: ImportState,
    line_number: int,
    line_content: str,
) -> Scene:
    if state.current_scene is None:
        raise _annotate_error(
            state,
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
    line_number: int,
    parsed_text: str | None = None,
) -> Moment:
    scene = _require_scene(state, line_number, original_text)
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
    line_number: int,
) -> None:
    moment = _create_moment(db, state, "stage_direction", line, line_number)
    inner = line.strip("*").strip()
    db.add(StageDirection(moment_id=moment.id, direction_text=inner))


def _handle_dialogue(
    db: Session,
    production: Production,
    state: ImportState,
    line: str,
    speakers: list[str],
    dialogue_text: str,
    line_number: int,
) -> None:
    for speaker in speakers:
        _get_or_create_character(db, production, state, speaker)

    # MVP: keep all parentheticals inline (vocal cues and stage action alike).
    text = dialogue_text.strip()
    moment = _create_moment(
        db,
        state,
        "dialogue",
        line,
        line_number,
        parsed_text=text or None,
    )
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
    line_number: int,
) -> tuple[str, list[str] | None]:
    """Return (moment type, performer names for attribution or None for lyric)."""
    stripped = content.strip()
    performers = parse_performer_line(
        stripped,
        state.dialogue_character_names,
        allow_new_parenthetical_names=True,
    )
    if performers is not None:
        return "song_attribution", performers
    if is_all_caps_lyric(stripped):
        return "lyric", None
    raise _annotate_error(
        state,
        line_number,
        stripped,
        "Cannot classify line in song block",
    )


def _persist_song_attribution(
    db: Session,
    production: Production,
    state: ImportState,
    performers: list[str],
    original_text: str,
    line_number: int,
) -> Moment:
    for name in performers:
        _get_or_create_character(db, production, state, name)
    state.current_performers = list(performers)
    moment = _create_moment(db, state, "song_attribution", original_text, line_number)
    for name in performers:
        character = state.characters[name]
        db.add(
            SongAttributionCharacter(
                moment_id=moment.id,
                character_id=character.id,
            ),
        )
    return moment


def _persist_lyric(
    db: Session,
    state: ImportState,
    original_text: str,
    line_number: int,
) -> Moment:
    if not state.current_performers:
        raise _annotate_error(
            state,
            line_number,
            original_text,
            "Lyric line before any performer attribution — add a singer line "
            "(for example ALL or SHACKLETON) after the song title",
        )
    lyric_text = original_text.removeprefix("#### ").strip()
    moment = _create_moment(
        db,
        state,
        "lyric",
        original_text,
        line_number,
        parsed_text=lyric_text or None,
    )
    for name in state.current_performers:
        character = state.characters[name]
        db.add(
            LyricLine(
                moment_id=moment.id,
                character_id=character.id,
                lyric_text=lyric_text,
            ),
        )
    return moment


def _handle_song_block_moment(
    db: Session,
    production: Production,
    state: ImportState,
    content: str,
    line_number: int,
    *,
    line_prefix: str = "",
) -> None:
    stripped = content.strip()
    if is_song_section_label(stripped):
        # Structural markers (VERSE / CHORUS / …) — not Moments; keep performers.
        return
    moment_type, performers = _classify_song_block_line(state, stripped, line_number)
    original_text = f"{line_prefix}{stripped}"
    if moment_type == "song_attribution":
        assert performers is not None
        _persist_song_attribution(
            db,
            production,
            state,
            performers,
            original_text,
            line_number,
        )
        return
    _persist_lyric(db, state, original_text, line_number)


def _handle_h4_line(
    db: Session,
    production: Production,
    state: ImportState,
    content: str,
    line_number: int,
    line_prefix: str = "#### ",
) -> None:
    stripped = content.strip()
    if not stripped:
        return

    if (
        stripped[0].islower()
        and any(character.isupper() for character in stripped[1:])
        and not any(character.isspace() for character in stripped)
    ):
        raise _annotate_error(
            state,
            line_number,
            stripped,
            f'Ambiguous mixed-case song marker "{stripped}" — use an ALL-CAPS '
            "performer name or sentence-case song description",
        )

    if RE_H4_ITALIC.match(stripped) or any(c.islower() for c in stripped):
        if state.current_song is not None:
            existing = state.current_song.description or ""
            addition = stripped.strip("*").strip()
            state.current_song.description = (
                f"{existing}\n{addition}".strip() if existing else addition
            )
        return

    _handle_song_block_moment(
        db,
        production,
        state,
        stripped,
        line_number,
        line_prefix=line_prefix,
    )


def _handle_plain_caps_in_song(
    db: Session,
    production: Production,
    state: ImportState,
    line: str,
    line_number: int,
) -> None:
    _handle_song_block_moment(db, production, state, line, line_number)


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
        if match := RE_TITLE.match(line) or RE_TITLE_PLAIN.match(line):
            # Parsed for logging / future UX only — never overwrites production.title.
            state.production_title = match.group(1).strip()
            return
        if match := RE_AUTHOR.match(line) or RE_AUTHOR_PLAIN.match(line):
            state.production_author = match.group(1).strip()
            return

    if match := RE_ACT.match(line) or RE_ACT_PLAIN.match(line):
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
        _clear_song_context(state)
        state.sequence_number = 0
        state.title_page_complete = True
        return

    if match := RE_SCENE.match(line) or RE_SCENE_PLAIN.match(line):
        if state.current_act is None:
            raise _annotate_error(
                state,
                line_number,
                line,
                "Scene heading before any Act",
            )
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
        _clear_song_context(state)
        state.sequence_number = 0
        return

    # Author notes before H4 so "#### Note:" is not treated as song description.
    if match := RE_AUTHOR_NOTE.match(line) or RE_AUTHOR_NOTE_H4.match(line):
        _create_moment(db, state, "author_note", line, line_number)
        return

    if match := RE_SONG_HEADER.match(line) or RE_SONG_HEADER_PLAIN.match(line):
        title = match.group(1).strip()
        try:
            validate_song_title(title, state.dialogue_character_names)
        except ValueError as exc:
            raise _annotate_error(state, line_number, line, str(exc)) from exc
        song = Song(production_id=production.id, title=title)
        db.add(song)
        db.flush()
        state.current_song = song
        state.current_performers = []
        _create_moment(db, state, "song_header", line, line_number)
        return

    if match := RE_H4.match(line):
        if state.current_song is None:
            raise _annotate_error(
                state,
                line_number,
                line,
                "H4 line outside of song block context",
            )
        try:
            _handle_h4_line(db, production, state, match.group(1), line_number)
        except ImportLineError as exc:
            raise _annotate_error(state, line_number, line, exc.message) from exc
        return

    if state.current_song is not None and line.strip() in ("####", "#### "):
        return

    if match := RE_STAGE_DIRECTION.match(line):
        _handle_stage_direction(db, state, line, line_number)
        return

    try:
        dialogue = parse_dialogue_line(line)
    except SpeakerListError as exc:
        raise _annotate_error(state, line_number, line, str(exc)) from exc
    if dialogue is not None:
        speakers, dialogue_text = dialogue
        _handle_dialogue(
            db,
            production,
            state,
            line,
            speakers,
            dialogue_text,
            line_number,
        )
        return

    if state.current_song is not None and (
        is_song_section_label(line.strip())
        or parse_performer_line(
            line.strip(),
            state.dialogue_character_names,
            allow_new_parenthetical_names=True,
        )
        or is_all_caps_lyric(line.strip())
    ):
        try:
            _handle_plain_caps_in_song(db, production, state, line, line_number)
        except ImportLineError as exc:
            raise _annotate_error(state, line_number, line, exc.message) from exc
        return

    raise _annotate_error(
        state,
        line_number,
        line,
        'Unrecognized prose outside a Moment. Use "Note:" for an author note '
        "or italics for a stage direction.",
    )


def import_script(
    db: Session,
    production: Production,
    content: bytes | str,
    *,
    filename: str | None = None,
    dry_run: bool = False,
) -> ImportResult:
    """
    Import script content into an existing production.

    When ``filename`` is provided (API uploads), format adapters extract lines
    before shared preprocessing and classification. Inline string tests may omit
    ``filename`` and go straight through ``preprocess_script``.

    Rolls back the entire transaction when any issues are found. When
    ``dry_run`` is True, successful classification is also rolled back so
    nothing is committed. Classification continues after recoverable line
    errors so the response can list every issue in one pass.
    """
    existing_acts = db.query(Act).filter(Act.production_id == production.id).count()
    if existing_acts > 0:
        raise ValueError("Production already has imported content; re-import is not allowed")

    source_format: str | None = None
    line_metadata: list[ExtractedLine] = []

    try:
        if filename is not None:
            if isinstance(content, str):
                content = content.encode("utf-8")
            extraction = extract_script(filename, content)
            source_format = extraction.source_format
            line_metadata = extraction.lines
            lines = preprocess_lines([item.text for item in line_metadata])
            # Keep metadata aligned with preprocessed text values.
            line_metadata = [
                ExtractedLine(
                    text=text,
                    paragraph_number=meta.paragraph_number,
                    paragraph_style=meta.paragraph_style,
                )
                for text, meta in zip(lines, line_metadata, strict=True)
            ]
        else:
            lines = preprocess_script(content)
            line_metadata = [
                ExtractedLine(text=text, paragraph_number=index)
                for index, text in enumerate(lines, start=1)
            ]
            source_format = "md"
    except ScriptDecodeError as exc:
        raise ValueError(str(exc)) from exc
    except ValueError:
        raise

    state = ImportState(
        moment_types=_load_moment_types(db),
        dialogue_character_names=_collect_dialogue_character_names(lines),
        source_format=source_format,
        line_metadata=line_metadata,
    )
    result = ImportResult()
    issues: list[ImportIssue] = []

    try:
        _ensure_builtin_characters(db, production, state)

        for line_number, line in enumerate(lines, start=1):
            if state.recovery_mode == "act_or_scene":
                if not line.strip() or not _is_act_or_scene_line(line):
                    continue
                state.recovery_mode = None
            elif state.recovery_mode == "song_boundary":
                if not line.strip() or not _is_song_boundary_line(line):
                    continue
                state.recovery_mode = None

            try:
                _classify_and_process_line(db, production, state, line_number, line)
            except ImportLineError as exc:
                issue = exc.issues[0]
                if _error_is_in_song_context(state, line):
                    issues.append(_to_song_issue(state, issue))
                    _clear_song_context(state)
                    state.recovery_mode = "song_boundary"
                elif _is_structural_context_error(issue.message):
                    issues.append(issue)
                    state.recovery_mode = "act_or_scene"
                else:
                    issues.append(issue)

        if issues:
            raise ImportLineError(issues)

        # Admin create-time title wins — do not assign production.title here.
        result.script_title = state.production_title
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

        if dry_run:
            db.rollback()
        else:
            db.commit()
        return result
    except ImportLineError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
