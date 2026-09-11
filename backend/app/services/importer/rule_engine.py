"""Profile-driven classification into an in-memory import preview."""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any

from app.services.importer.profiles import (
    ImportProfileDefinition,
    ImportRule,
    RuleAction,
    RulePredicates,
)
from app.services.importer.word_numbers import parse_number

# Same separators as grammar.parse_speaker_list (comma / & / lowercase and).
_SPEAKER_LIST_SPLIT = re.compile(r",\s+and\s+|,\s*|\s+&\s+|\s+and\s+")
_SPEAKER_AWAITS_CONTINUATION = re.compile(r"(?:\s+and|&)\s*$", re.IGNORECASE)


@dataclass
class PreviewMoment:
    type: str
    text: str
    original_text: str | None = None
    page: int | None = None
    line_number: int | None = None
    speakers: list[str] = field(default_factory=list)
    title: str | None = None
    # PDF layout peek (points from top-left). Absent for md/docx.
    x0: float | None = None
    y0: float | None = None
    x1: float | None = None


@dataclass
class PreviewScene:
    number: int
    title: str | None = None
    moments: list[PreviewMoment] = field(default_factory=list)


@dataclass
class PreviewAct:
    number: int
    title: str | None = None
    scenes: list[PreviewScene] = field(default_factory=list)


@dataclass
class PreviewWarning:
    line_number: int
    message: str
    page: int | None = None


@dataclass
class UnclassifiedLine:
    line_number: int
    text: str
    page: int | None = None
    x0: float | None = None
    y0: float | None = None
    x1: float | None = None


@dataclass
class ImportPreview:
    acts: list[PreviewAct] = field(default_factory=list)
    warnings: list[PreviewWarning] = field(default_factory=list)
    unclassified: list[UnclassifiedLine] = field(default_factory=list)

    @property
    def moments(self) -> list[PreviewMoment]:
        return [
            moment
            for act in self.acts
            for scene in act.scenes
            for moment in scene.moments
        ]


@dataclass(frozen=True)
class ColumnBand:
    """Left/right column split for two-column PDF comforts, derived from profile rules."""

    speaker_x0_max: float
    body_x0_min: float


# Single-letter ensemble marks like (A)/(B) — not words like (Spoken).
_ENSEMBLE_LETTER_RE = re.compile(r"^\([A-Z]\)$")
# "(B) Who else…" — letter mark glued to body on one line/span.
_ENSEMBLE_LETTER_PREFIX_RE = re.compile(r"^(\([A-Z]\))\s+(.*)$", re.DOTALL)
# Prefer buffering short/incomplete parentheticals; long music/blocking stays
# as its own stage_direction moment.
_INLINE_PAREN_MAX_CHARS = 80
# Fallback when a profile has no speaker/body column predicates (Scrooge-tuned).
_DEFAULT_SPEAKER_COLUMN_X0_MAX = 130.0
_DEFAULT_BODY_COLUMN_X0_MIN = 130.0


@dataclass
class _EngineState:
    preview: ImportPreview = field(default_factory=ImportPreview)
    current_act: PreviewAct | None = None
    current_scene: PreviewScene | None = None
    current_speakers: list[str] = field(default_factory=list)
    inside_song_block: bool = False
    inside_parenthetical_block: bool = False
    previous_classification: str | None = None
    last_speaker_line_number: int | None = None
    # Short parentheticals waiting to prepend onto the next lyric/dialogue,
    # or to append onto the lyric/dialogue that was active when they opened.
    pending_inline_prefixes: list[str] = field(default_factory=list)
    # Moment that owned the turn when a multi-line paren opened (Bob's lyric).
    pending_paren_anchor: PreviewMoment | None = None
    column_band: ColumnBand = field(
        default_factory=lambda: ColumnBand(
            speaker_x0_max=_DEFAULT_SPEAKER_COLUMN_X0_MAX,
            body_x0_min=_DEFAULT_BODY_COLUMN_X0_MIN,
        )
    )
    compiled_regexes: dict[str, re.Pattern[str]] = field(default_factory=dict)


def column_band_from_profile(profile: ImportProfileDefinition) -> ColumnBand:
    """
    Derive the comfort column band from speaker / dialogue / lyric rule predicates.

    Profiles own the geometry; the engine only uses these bounds for universal
    two-column comforts (inline paren buffering, speaker|body row splits).
    """
    speaker_maxes: list[float] = []
    body_mins: list[float] = []
    for rule in profile.rules:
        if not rule.enabled:
            continue
        predicates = rule.match
        if rule.action.type == "speaker":
            if predicates.x0_lte is not None:
                speaker_maxes.append(float(predicates.x0_lte))
            if predicates.x0_between is not None:
                speaker_maxes.append(float(predicates.x0_between[1]))
        if rule.action.type in {"dialogue", "lyric"}:
            if predicates.x0_gte is not None:
                body_mins.append(float(predicates.x0_gte))
            if predicates.x0_between is not None:
                body_mins.append(float(predicates.x0_between[0]))
    return ColumnBand(
        speaker_x0_max=(
            max(speaker_maxes) if speaker_maxes else _DEFAULT_SPEAKER_COLUMN_X0_MAX
        ),
        body_x0_min=min(body_mins) if body_mins else _DEFAULT_BODY_COLUMN_X0_MIN,
    )


def _looks_like_inline_parenthetical(
    text: str,
    source: Any = None,
    *,
    speaker_x0_max: float = _DEFAULT_SPEAKER_COLUMN_X0_MAX,
) -> bool:
    """Short parentheticals near the speaker column wait for the next lyric/dialogue."""
    cleaned = text.strip()
    if not cleaned.startswith("("):
        return False
    if len(cleaned) > _INLINE_PAREN_MAX_CHARS:
        return False
    # Ensemble letters are speaker continuations, not "(Spoken)"-style cues.
    if _ENSEMBLE_LETTER_RE.fullmatch(cleaned):
        return False
    if _ENSEMBLE_LETTER_PREFIX_RE.match(cleaned):
        return False
    # Right-column directions (music cues, etc.) stay standalone even when short.
    x0 = _as_optional_float(_line_value(source, "x0")) if source is not None else None
    if x0 is not None and x0 > speaker_x0_max:
        return False
    return True


def _ensemble_continued_label(previous: str, incoming: str) -> str | None:
    """Turn '(B)' after 'Carolers (A)' / 'Carolers' into 'Carolers (B)'."""
    mark = incoming.strip()
    if not _ENSEMBLE_LETTER_RE.fullmatch(mark):
        return None
    base = re.sub(r"\s*\([^)]*\)\s*$", "", previous.strip()).strip()
    if not base:
        return None
    return f"{base} {mark}"


def _speaker_label_awaits_continuation(label: str) -> bool:
    """True when a left-column wrap ended mid-list: 'Undertaker and' / 'Liddy &'."""
    return bool(_SPEAKER_AWAITS_CONTINUATION.search(label.strip()))


def _split_speaker_labels(raw: str, profile: ImportProfileDefinition) -> list[str]:
    """
    Split ``A & B`` / ``A and B`` into distinct speakers for the current profile.

    Incomplete trailing separators stay as one label until the next left-column
    name arrives (PDF wrap). Does not require ALL CAPS unless the profile does.
    """
    cleaned = raw.strip()
    if not cleaned:
        raise ValueError("speaker labels must include at least one letter")
    if _speaker_label_awaits_continuation(cleaned):
        return [_validate_speaker_label(cleaned, profile)]
    if " AND " in cleaned:
        raise ValueError(
            f'Invalid speaker list "{cleaned}" — use lowercase " and " as the group separator'
        )
    parts = _SPEAKER_LIST_SPLIT.split(cleaned)
    if len(parts) <= 1:
        return [_validate_speaker_label(cleaned, profile)]
    if any(not part.strip() for part in parts):
        raise ValueError(
            f'Invalid speaker list "{cleaned}" — remove dangling or repeated separators'
        )
    return [_validate_speaker_label(part.strip(), profile) for part in parts]


def _rewrite_incomplete_speaker_moments(
    state: _EngineState,
    previous: list[str],
    completed: list[str],
) -> None:
    """Fix lyrics emitted on the wrap row before the second name arrived."""
    if state.current_scene is None or previous == completed:
        return
    for moment in reversed(state.current_scene.moments):
        if moment.type not in {"dialogue", "lyric", "song_attribution"}:
            continue
        if moment.speakers != previous:
            break
        moment.speakers = list(completed)


def _set_current_speakers(
    state: _EngineState,
    labels: list[str],
    line_number: int,
) -> None:
    previous = list(state.current_speakers)
    state.current_speakers = list(labels)
    state.last_speaker_line_number = line_number
    if (
        len(previous) == 1
        and _speaker_label_awaits_continuation(previous[0])
        and not (
            len(labels) == 1 and _speaker_label_awaits_continuation(labels[0])
        )
    ):
        _rewrite_incomplete_speaker_moments(state, previous, labels)


def _format_inline_prefix(prefixes: list[str], body: str) -> str:
    prefix = " ".join(part.strip() for part in prefixes if part.strip())
    body = body.strip()
    if not prefix:
        return body
    if not body:
        return prefix
    return f"{prefix} {body}"


def _pending_paren_text(state: _EngineState) -> str:
    return " ".join(part.strip() for part in state.pending_inline_prefixes if part.strip())


def _pending_paren_balanced(state: _EngineState) -> bool:
    text = _pending_paren_text(state)
    if not text:
        return True
    return text.count("(") <= text.count(")")


def _last_text_moment(state: _EngineState) -> PreviewMoment | None:
    if state.current_scene is None:
        return None
    for moment in reversed(state.current_scene.moments):
        if moment.type in {"dialogue", "lyric"}:
            return moment
    return None


def _clear_pending_paren(state: _EngineState) -> None:
    state.pending_inline_prefixes.clear()
    state.pending_paren_anchor = None
    state.inside_parenthetical_block = False


def _attach_or_hold_completed_paren(state: _EngineState) -> None:
    """Attach a balanced multi-line paren to its opening turn, or hold for next body."""
    if not state.pending_inline_prefixes or not _pending_paren_balanced(state):
        return
    prefix = _pending_paren_text(state)
    anchor = state.pending_paren_anchor
    if anchor is not None and anchor.type in {"dialogue", "lyric"}:
        original = anchor.original_text or anchor.text
        anchor.text = f"{anchor.text} {prefix}".strip()
        anchor.original_text = f"{original} {prefix}".strip()
        _clear_pending_paren(state)
        return
    # No prior body on this turn — keep pending so the next lyric/dialogue
    # prepends it (same-row cues like "(with Tiny Tim) Though we are poor").
    state.pending_paren_anchor = None
    state.inside_parenthetical_block = False


def _buffer_paren_fragment(state: _EngineState, fragment: str) -> None:
    """Accumulate multi-line parenthetical pieces; hold complete one-shot cues."""
    cleaned = fragment.strip()
    if not cleaned:
        return
    starting = not state.pending_inline_prefixes
    state.pending_inline_prefixes.append(cleaned)
    if _pending_paren_balanced(state):
        if starting:
            # Complete in one piece (Spoken) / (with Tiny Tim) — wait for the
            # following body on this turn. Do not append onto the previous
            # speaker's lyric (that caused Carolers … (Spoken) / Scrooge No!).
            state.pending_paren_anchor = None
            state.inside_parenthetical_block = False
        else:
            # Closing fragment of a wrap like "(lifting Tim to" / "his shoulders)".
            _attach_or_hold_completed_paren(state)
    else:
        if starting:
            state.pending_paren_anchor = _last_text_moment(state)
        state.inside_parenthetical_block = True


def _is_only_parenthetical(text: str) -> bool:
    cleaned = text.strip()
    return bool(cleaned) and cleaned.startswith("(") and cleaned.endswith(")")


def _append_to_text_moment(
    moment: PreviewMoment,
    addition: str,
    original_addition: str | None = None,
    *,
    separator: str = " ",
) -> None:
    addition = addition.strip()
    if not addition:
        return
    if separator == "\n":
        moment.text = f"{moment.text.rstrip()}\n{addition}"
        original = moment.original_text or moment.text
        extra = (original_addition or addition).strip()
        moment.original_text = f"{original.rstrip()}\n{extra}"
    else:
        moment.text = f"{moment.text} {addition}".strip()
        original = moment.original_text or moment.text
        extra = (original_addition or addition).strip()
        moment.original_text = f"{original} {extra}".strip()


def _last_scene_moment(state: _EngineState) -> PreviewMoment | None:
    if state.current_scene is None or not state.current_scene.moments:
        return None
    return state.current_scene.moments[-1]


def _flush_pending_as_stage_directions(
    state: _EngineState,
    line_number: int,
    page: int | None,
) -> None:
    """Emit buffered parentheticals as orphan stage directions (no speakers)."""
    if not state.pending_inline_prefixes or state.current_scene is None:
        _clear_pending_paren(state)
        return
    for prefix in state.pending_inline_prefixes:
        text = prefix.strip()
        if not text:
            continue
        state.current_scene.moments.append(
            PreviewMoment(
                type="stage_direction",
                text=text,
                original_text=text,
                speakers=[],
                page=page,
                line_number=line_number,
            )
        )
    _clear_pending_paren(state)


def _line_spans(line: Any) -> tuple[Any, ...]:
    layout = getattr(line, "layout", None)
    spans = getattr(layout, "spans", ()) if layout is not None else ()
    return tuple(spans) if spans else ()


def _line_has_column_split(line: Any, band: ColumnBand) -> bool:
    """True when a row has both a speaker-band span and a body-band span."""
    spans = _line_spans(line)
    if len(spans) < 2:
        return False
    has_left = False
    has_right = False
    for span in spans:
        x0 = _as_optional_float(_line_value(span, "x0"))
        if x0 is None:
            continue
        if x0 <= band.speaker_x0_max:
            has_left = True
        if x0 >= band.body_x0_min:
            has_right = True
    return has_left and has_right


def _should_defer_line_rule_to_spans(
    line: Any, rule: ImportRule, band: ColumnBand
) -> bool:
    """Avoid letting line-level paren rules swallow speaker|body column rows."""
    if rule.action.type not in {"stage_direction", "continue_previous"}:
        return False
    return _line_has_column_split(line, band)


def _try_apply_ensemble_speaker(
    state: _EngineState,
    profile: ImportProfileDefinition,
    mark: str,
    line_number: int,
) -> bool:
    """If mark is '(B)' after Carolers (A), set current speaker to Carolers (B)."""
    if not state.current_speakers:
        return False
    continued = _ensemble_continued_label(state.current_speakers[-1], mark)
    if continued is None:
        return False
    _set_current_speakers(
        state,
        [_validate_speaker_label(continued, profile)],
        line_number,
    )
    return True


def _roman_to_int(value: str) -> int:
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
    total = 0
    previous = 0
    for character in reversed(value.upper()):
        current = values.get(character)
        if current is None:
            raise ValueError(f'Invalid act number "{value}"')
        total += -current if current < previous else current
        previous = max(previous, current)
    if total < 1:
        raise ValueError(f'Invalid act number "{value}"')
    return total


def _parse_structure_number(value: str) -> int:
    cleaned = value.strip()
    if re.fullmatch(r"[IVXLC]+", cleaned, re.IGNORECASE):
        return _roman_to_int(cleaned)
    return parse_number(cleaned)


def _line_value(line: Any, name: str) -> Any:
    value = getattr(line, name, None)
    if value is not None:
        return value
    value = getattr(line, name.removeprefix("is_"), None)
    if value is not None:
        return value
    layout = getattr(line, "layout", None)
    if layout is not None:
        layout_name = name.removeprefix("is_")
        value = getattr(layout, layout_name, None)
        if value is not None:
            return value
    flags = getattr(line, "flags", None)
    if isinstance(flags, dict):
        return flags.get(name.removeprefix("is_"))
    return None


def _as_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _layout_coords(source: Any) -> tuple[float | None, float | None, float | None]:
    """Return (x0, y0, x1) in PDF points for layout peek; all None when unknown."""
    return (
        _as_optional_float(_line_value(source, "x0")),
        _as_optional_float(_line_value(source, "y0")),
        _as_optional_float(_line_value(source, "x1")),
    )


def _text_matches(actual: str, expected: str, case_sensitive: bool) -> bool:
    if case_sensitive:
        return actual == expected
    return actual.casefold() == expected.casefold()


def _match_rule(
    rule: ImportRule,
    line: Any,
    state: _EngineState,
) -> re.Match[str] | None | bool:
    predicates: RulePredicates = rule.match
    text = line.text.strip()
    comparable_text = text if predicates.case_sensitive else text.casefold()

    if predicates.text_equals is not None and not _text_matches(
        text,
        predicates.text_equals,
        predicates.case_sensitive,
    ):
        return False
    if predicates.text_starts_with is not None:
        expected = (
            predicates.text_starts_with
            if predicates.case_sensitive
            else predicates.text_starts_with.casefold()
        )
        if not comparable_text.startswith(expected):
            return False
    if predicates.text_contains is not None:
        expected = (
            predicates.text_contains
            if predicates.case_sensitive
            else predicates.text_contains.casefold()
        )
        if expected not in comparable_text:
            return False

    regex_result: re.Match[str] | None = None
    if predicates.regex_match is not None:
        compiled = state.compiled_regexes.get(rule.id)
        if compiled is None:
            flags = 0 if predicates.case_sensitive else re.IGNORECASE
            compiled = re.compile(predicates.regex_match, flags)
            state.compiled_regexes[rule.id] = compiled
        regex_result = compiled.fullmatch(text[:10_000])
        if regex_result is None:
            return False

    is_all_caps = any(character.isalpha() for character in text) and not any(
        character.isalpha() and character.islower() for character in text
    )
    if predicates.is_all_caps is not None and is_all_caps != predicates.is_all_caps:
        return False
    is_wrapped = text.startswith("(") and text.endswith(")")
    if (
        predicates.is_wrapped_in_parens is not None
        and is_wrapped != predicates.is_wrapped_in_parens
    ):
        return False
    if predicates.word_count_lte is not None and len(text.split()) > predicates.word_count_lte:
        return False
    if predicates.char_count_lte is not None and len(text) > predicates.char_count_lte:
        return False

    x0 = _line_value(line, "x0")
    if predicates.x0_lte is not None and (x0 is None or x0 > predicates.x0_lte):
        return False
    if predicates.x0_gte is not None and (x0 is None or x0 < predicates.x0_gte):
        return False
    if predicates.x0_between is not None and (
        x0 is None or not predicates.x0_between[0] <= x0 <= predicates.x0_between[1]
    ):
        return False
    if predicates.indent_gte is not None and (x0 is None or x0 < predicates.indent_gte):
        return False

    font_size = _line_value(line, "font_size")
    if predicates.font_size_gte is not None and (
        font_size is None or font_size < predicates.font_size_gte
    ):
        return False
    if predicates.font_size_lte is not None and (
        font_size is None or font_size > predicates.font_size_lte
    ):
        return False
    if predicates.is_bold is not None and bool(_line_value(line, "is_bold")) != predicates.is_bold:
        return False
    if (
        predicates.is_italic is not None
        and bool(_line_value(line, "is_italic")) != predicates.is_italic
    ):
        return False

    if predicates.previous_was is not None and state.previous_classification not in predicates.previous_was:
        return False
    if (
        predicates.inside_song_block is not None
        and state.inside_song_block != predicates.inside_song_block
    ):
        return False
    if (
        predicates.inside_parenthetical_block is not None
        and state.inside_parenthetical_block
        != predicates.inside_parenthetical_block
    ):
        return False

    page = _line_value(line, "page")
    if predicates.page_gte is not None and (page is None or page < predicates.page_gte):
        return False
    if predicates.page_lte is not None and (page is None or page > predicates.page_lte):
        return False

    return regex_result if regex_result is not None else True


def _capture(
    action: RuleAction,
    attribute: str,
    match: re.Match[str] | None,
    fallback: str,
) -> str:
    capture = getattr(action, attribute)
    if capture is None:
        return fallback
    if match is None:
        raise ValueError(f"{attribute} requires a regex_match predicate")
    try:
        return match.group(capture)
    except (IndexError, KeyError) as exc:
        raise ValueError(f'Unknown regex capture "{capture}" in {attribute}') from exc


def _validate_speaker_label(label: str, profile: ImportProfileDefinition) -> str:
    cleaned = label.strip()
    if not cleaned or not any(character.isalpha() for character in cleaned):
        raise ValueError("speaker labels must include at least one letter")
    if profile.speakers.require_all_caps and any(
        character.isalpha() and not character.isupper() for character in cleaned
    ):
        raise ValueError(f'Invalid speaker label "{cleaned}" — speaker names must be ALL CAPS')
    allowed = r"A-Za-z0-9 .'’‘&,\-"
    if profile.speakers.allow_parentheses:
        allowed += r"()"
    if not re.fullmatch(rf"[{allowed}]+", cleaned):
        raise ValueError(f'Invalid speaker label "{cleaned}" for this profile')
    return cleaned


def _require_scene(state: _EngineState, line_number: int, page: int | None) -> bool:
    if state.current_scene is not None:
        return True
    state.preview.warnings.append(
        PreviewWarning(
            line_number=line_number,
            page=page,
            message="Moment-like line appeared before a scene",
        )
    )
    return False


def _apply_action(
    rule: ImportRule,
    line: Any,
    line_number: int,
    match: re.Match[str] | None,
    profile: ImportProfileDefinition,
    state: _EngineState,
) -> None:
    action = rule.action
    text = line.text.strip()
    page = _line_value(line, "page")
    if action.end_song_block:
        state.inside_song_block = False

    if action.type == "ignore":
        return
    if action.type == "set_act":
        _flush_pending_as_stage_directions(state, line_number, page)
        number_text = (
            str(action.literal_number)
            if action.literal_number is not None
            else _capture(action, "number_capture", match, text)
        )
        title = action.literal_title
        if action.title_capture is not None:
            title = _capture(action, "title_capture", match, "")
        act = PreviewAct(number=_parse_structure_number(number_text), title=title or None)
        state.preview.acts.append(act)
        state.current_act = act
        state.current_scene = None
        state.inside_song_block = False
        state.current_speakers = []
        return
    if action.type == "set_scene":
        _flush_pending_as_stage_directions(state, line_number, page)
        if state.current_act is None:
            state.preview.warnings.append(
                PreviewWarning(line_number, "Scene appeared before an act", page)
            )
            return
        number_text = (
            str(action.literal_number)
            if action.literal_number is not None
            else _capture(action, "number_capture", match, text)
        )
        title = action.literal_title
        if action.title_capture is not None:
            title = _capture(action, "title_capture", match, "")
        scene = PreviewScene(number=_parse_structure_number(number_text), title=title or None)
        state.current_act.scenes.append(scene)
        state.current_scene = scene
        state.inside_song_block = False
        state.current_speakers = []
        return

    action_text = _capture(action, "text_capture", match, text)
    raw_action_text = action_text
    if action.strip_outer_parens and action_text.startswith("(") and action_text.endswith(")"):
        action_text = action_text[1:-1].strip()

    if action.type == "speaker":
        # Left-column "(lifting Tim to" must not become a speaker label.
        if raw_action_text.strip().startswith("("):
            if _try_apply_ensemble_speaker(
                state, profile, raw_action_text.strip(), line_number
            ):
                return
            if _looks_like_inline_parenthetical(
                raw_action_text,
                line,
                speaker_x0_max=state.column_band.speaker_x0_max,
            ) or (
                raw_action_text.strip().startswith("(")
                and (_as_optional_float(_line_value(line, "x0")) or 0)
                <= state.column_band.speaker_x0_max
            ):
                _buffer_paren_fragment(state, raw_action_text.strip())
                return
        if (
            state.inside_parenthetical_block
            and state.pending_inline_prefixes
            and (_as_optional_float(_line_value(line, "x0")) or 0)
            <= state.column_band.speaker_x0_max
        ):
            _buffer_paren_fragment(state, raw_action_text.strip())
            return
        if state.last_speaker_line_number == line_number and state.current_speakers:
            # Same PDF row: glue multi-span name fragments before splitting.
            action_text = f"{' '.join(state.current_speakers)} {action_text}".strip()
        elif (
            len(state.current_speakers) == 1
            and _speaker_label_awaits_continuation(state.current_speakers[0])
        ):
            # Wrapped "Undertaker and" + next-row "Gravediggers".
            action_text = f"{state.current_speakers[0]} {action_text}".strip()
        elif state.current_speakers:
            continued = _ensemble_continued_label(
                state.current_speakers[-1], action_text
            )
            if continued is not None:
                action_text = continued
        _set_current_speakers(
            state,
            _split_speaker_labels(action_text, profile),
            line_number,
        )
        return
    if action.type == "inline_dialogue":
        if ":" not in action_text:
            raise ValueError("inline_dialogue requires a colon")
        speaker, action_text = action_text.split(":", 1)
        _set_current_speakers(
            state,
            _split_speaker_labels(speaker, profile),
            line_number,
        )
        action_text = action_text.strip()
        action_type = "dialogue"
    else:
        action_type = action.type

    # "(B)" or "(B) Who else…" classified as stage_direction → ensemble speaker.
    raw_stripped = raw_action_text.strip()
    if action_type == "stage_direction" and state.current_speakers:
        if _ENSEMBLE_LETTER_RE.fullmatch(raw_stripped):
            if _try_apply_ensemble_speaker(state, profile, raw_stripped, line_number):
                return
        ensemble_prefix = _ENSEMBLE_LETTER_PREFIX_RE.match(raw_stripped)
        if ensemble_prefix is not None:
            mark, remainder = ensemble_prefix.group(1), ensemble_prefix.group(2)
            if _try_apply_ensemble_speaker(state, profile, mark, line_number):
                action_type = "lyric" if state.inside_song_block else "dialogue"
                action_text = remainder.strip()
                raw_action_text = remainder.strip()

    if action_type == "song_header":
        _flush_pending_as_stage_directions(state, line_number, page)
        if not _require_scene(state, line_number, page):
            return
        state.inside_song_block = True
        state.current_speakers = []
        x0, y0, x1 = _layout_coords(line)
        state.current_scene.moments.append(
            PreviewMoment(
                type="song_header",
                title=action_text,
                text=text,
                original_text=text,
                page=page,
                line_number=line_number,
                x0=x0,
                y0=y0,
                x1=x1,
            )
        )
        return
    if action_type == "song_attribution":
        if not _require_scene(state, line_number, page):
            return
        speakers = _split_speaker_labels(action_text, profile)
        _set_current_speakers(state, speakers, line_number)
        x0, y0, x1 = _layout_coords(line)
        state.current_scene.moments.append(
            PreviewMoment(
                type="song_attribution",
                text=text,
                original_text=text,
                speakers=speakers,
                page=page,
                line_number=line_number,
                x0=x0,
                y0=y0,
                x1=x1,
            )
        )
        return
    if action_type == "continue_previous":
        # Multi-line inline paren fragments accumulate in pending, not onto the
        # previous moment (which may already be a lyric body on another column).
        if state.pending_inline_prefixes:
            _buffer_paren_fragment(state, action_text or text)
            return
        if state.current_scene is None or not state.current_scene.moments:
            state.preview.warnings.append(
                PreviewWarning(line_number, "Nothing to continue", page)
            )
            return
        previous = state.current_scene.moments[-1]
        previous_original = previous.original_text or previous.text
        previous.text = f"{previous.text}\n{action_text}"
        previous.original_text = f"{previous_original}\n{text}"
        if state.inside_parenthetical_block:
            state.inside_parenthetical_block = (
                previous.text.count("(") > previous.text.count(")")
            )
        return

    if not _require_scene(state, line_number, page):
        return

    # Short parentheticals sit between a speaker and lyric/dialogue — hold them
    # and attach to the turn they belong to instead of creating a fake beat.
    if action_type == "stage_direction" and _looks_like_inline_parenthetical(
        raw_action_text,
        line,
    ):
        buffered = raw_action_text.strip()
        if action.strip_outer_parens and not buffered.startswith("("):
            buffered = f"({buffered})"
        _buffer_paren_fragment(state, buffered)
        return

    if action_type in {"dialogue", "lyric"} and state.pending_inline_prefixes:
        if _pending_paren_balanced(state):
            action_text = _format_inline_prefix(state.pending_inline_prefixes, action_text)
            _clear_pending_paren(state)
        # Unbalanced multi-line wrap: emit body now; paren attaches to its
        # anchor when the closing fragment arrives.

    if action_type == "stage_direction":
        _flush_pending_as_stage_directions(state, line_number, page)
        speakers: list[str] = []
    else:
        speakers = list(state.current_speakers)

    if action_type in {"dialogue", "lyric"} and not speakers:
        state.preview.warnings.append(
            PreviewWarning(
                line_number,
                f"{action_type.capitalize()} has no current speaker",
                page,
            )
        )

    # Trailing / mid-line parentheticals in the body column often arrive as their
    # own span ("(Exits)", "(Spoken)"). Fold them into the previous text moment
    # instead of creating a one-word lyric/dialogue beat.
    if action_type in {"dialogue", "lyric"}:
        previous = _last_text_moment(state)
        if previous is not None:
            if _is_only_parenthetical(action_text):
                _append_to_text_moment(previous, action_text, original_addition=text)
                return
            if (
                previous.type == action_type
                and previous.speakers == speakers
                and previous.line_number == line_number
            ):
                _append_to_text_moment(previous, action_text, original_addition=text)
                return

    # Consecutive same-speaker dialogue with nothing in between → one Moment
    # (multiline text). Lyrics stay one Moment per line for now.
    if action_type == "dialogue" and speakers:
        previous = _last_scene_moment(state)
        if (
            previous is not None
            and previous.type == "dialogue"
            and previous.speakers == speakers
        ):
            _append_to_text_moment(
                previous,
                action_text,
                original_addition=text,
                separator="\n",
            )
            return

    x0, y0, x1 = _layout_coords(line)
    state.current_scene.moments.append(
        PreviewMoment(
            type=action_type,
            text=action_text,
            original_text=text,
            speakers=speakers,
            page=page,
            line_number=line_number,
            x0=x0,
            y0=y0,
            x1=x1,
        )
    )
    if action_type == "stage_direction":
        state.inside_parenthetical_block = raw_action_text.count(
            "("
        ) > raw_action_text.count(")")


def classify_with_profile(
    lines: list[Any],
    profile: ImportProfileDefinition,
) -> ImportPreview:
    """Classify extracted lines without writing database records."""
    state = _EngineState(column_band=column_band_from_profile(profile))
    ordered_rules = sorted(
        (rule for rule in profile.rules if rule.enabled),
        key=lambda rule: rule.priority,
        reverse=True,
    )
    line_rules = [rule for rule in ordered_rules if rule.scope == "line"]
    span_rules = [rule for rule in ordered_rules if rule.scope == "span"]

    for rule in ordered_rules:
        if rule.match.regex_match is None:
            continue
        flags = 0 if rule.match.case_sensitive else re.IGNORECASE
        state.compiled_regexes[rule.id] = re.compile(rule.match.regex_match, flags)

    for line_number, line in enumerate(lines, start=1):
        if not line.text.strip():
            continue
        matched = False
        processed_spans = False
        for rule in line_rules:
            match_result = _match_rule(rule, line, state)
            if match_result is False:
                continue
            # Two-column rows: let span rules split left paren from right body
            # instead of treating the whole merged line as one stage direction.
            if _should_defer_line_rule_to_spans(line, rule, state.column_band):
                continue
            regex_match = match_result if isinstance(match_result, re.Match) else None
            try:
                _apply_action(rule, line, line_number, regex_match, profile, state)
            except ValueError as exc:
                state.preview.warnings.append(
                    PreviewWarning(
                        line_number=line_number,
                        page=_line_value(line, "page"),
                        message=str(exc),
                    )
                )
            state.previous_classification = rule.action.type
            matched = True
            break
        if not matched and span_rules:
            spans = _line_spans(line)
            processed_spans = bool(spans)
            speaker_x0_max = state.column_band.speaker_x0_max
            for span in spans:
                span_text = span.text.strip()
                if not span_text:
                    continue
                span_x0 = _as_optional_float(_line_value(span, "x0"))

                # Comfort: lone "(B)" before span rules (and before speaker false
                # positives on paren fragments).
                if (
                    _ENSEMBLE_LETTER_RE.fullmatch(span_text)
                    and _try_apply_ensemble_speaker(
                        state, profile, span_text, line_number
                    )
                ):
                    state.previous_classification = "speaker"
                    matched = True
                    continue

                # Comfort: unfinished / left-column paren pieces while wrapping.
                if (
                    state.inside_parenthetical_block
                    and state.pending_inline_prefixes
                    and span_x0 is not None
                    and span_x0 <= speaker_x0_max
                ):
                    _buffer_paren_fragment(state, span_text)
                    state.previous_classification = "stage_direction"
                    matched = True
                    continue

                if (
                    span_text.startswith("(")
                    and not _ENSEMBLE_LETTER_RE.fullmatch(span_text)
                    and span_x0 is not None
                    and span_x0 <= speaker_x0_max
                    and (
                        _looks_like_inline_parenthetical(
                            span_text,
                            span,
                            speaker_x0_max=speaker_x0_max,
                        )
                        or not span_text.endswith(")")
                    )
                ):
                    _buffer_paren_fragment(state, span_text)
                    state.previous_classification = "stage_direction"
                    matched = True
                    continue

                span_matched = False
                for rule in span_rules:
                    match_result = _match_rule(rule, span, state)
                    if match_result is False:
                        continue
                    regex_match = (
                        match_result if isinstance(match_result, re.Match) else None
                    )
                    try:
                        _apply_action(
                            rule,
                            span,
                            line_number,
                            regex_match,
                            profile,
                            state,
                        )
                    except ValueError as exc:
                        state.preview.warnings.append(
                            PreviewWarning(
                                line_number=line_number,
                                page=_line_value(span, "page"),
                                message=str(exc),
                            )
                        )
                    state.previous_classification = rule.action.type
                    span_matched = True
                    matched = True
                    break
                if not span_matched and span_text:
                    x0, y0, x1 = _layout_coords(span)
                    state.preview.unclassified.append(
                        UnclassifiedLine(
                            line_number=line_number,
                            text=span_text,
                            page=_line_value(span, "page"),
                            x0=x0,
                            y0=y0,
                            x1=x1,
                        )
                    )
        if not matched and not processed_spans:
            x0, y0, x1 = _layout_coords(line)
            state.preview.unclassified.append(
                UnclassifiedLine(
                    line_number=line_number,
                    text=line.text,
                    page=_line_value(line, "page"),
                    x0=x0,
                    y0=y0,
                    x1=x1,
                )
            )
            state.previous_classification = "unclassified"

    last_page = None
    if state.pending_inline_prefixes:
        # Best-effort page from the last classified moment.
        moments = state.preview.moments
        if moments:
            last_page = moments[-1].page
        _flush_pending_as_stage_directions(
            state,
            line_number=moments[-1].line_number or 0 if moments else 0,
            page=last_page,
        )

    return state.preview

