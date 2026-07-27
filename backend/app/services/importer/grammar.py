"""Shared grammar helpers for dialogue, songs, and lyrics."""

from __future__ import annotations

import re


_SPEAKER_NAME_ALLOWED = re.compile(
    r"^[A-Za-z0-9](?:[A-Za-z0-9 .'’‘-]*[A-Za-z0-9])?$",
)
_SPEAKER_SEPARATOR = re.compile(r",\s+and\s+|,\s*|\s+&\s+|\s+and\s+")
_PARENTHETICAL_SEGMENT = re.compile(r"\(([^()]*)\)")
_LYRIC_ALLOWED = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789 \t"
    "'’‘\"“”"
    ".,…!?;"
    "-–—"
    "&()/"
)
_SONG_TITLE_ALLOWED = _LYRIC_ALLOWED | frozenset("/:")
_SONG_SECTION_LABEL = re.compile(
    r"^(VERSE|CHORUS|BRIDGE|REFRAIN|INTRO|OUTRO|TAG|PRE-?CHORUS)(\s+\d+)?$",
    re.IGNORECASE,
)


class SpeakerListError(ValueError):
    """Raised when a speaker or performer list does not follow the shared grammar."""


def is_song_section_label(text: str) -> bool:
    """Return whether text is a structural song marker such as VERSE or CHORUS."""
    return bool(_SONG_SECTION_LABEL.fullmatch(text.strip()))


def validate_speaker_name(name: str) -> None:
    """Validate one ALL-CAPS character name without rewriting it."""
    if not name or name != name.strip():
        raise SpeakerListError("speaker names may not begin or end with whitespace")
    if not any(character.isalpha() for character in name):
        raise SpeakerListError(f'Invalid speaker label "{name}" — include at least one letter')
    if any(character.isalpha() and not character.isupper() for character in name):
        raise SpeakerListError(
            f'Invalid speaker label "{name}" — speaker names must be ALL CAPS',
        )
    if not _SPEAKER_NAME_ALLOWED.fullmatch(name):
        raise SpeakerListError(
            f'Invalid speaker label "{name}" — use letters, digits, spaces, '
            "apostrophes, periods, or hyphens",
        )


def parse_speaker_list(raw: str) -> list[str]:
    """Validate and split a comma, `` & ``, or `` and `` separated speaker list."""
    if not raw or raw != raw.strip():
        raise SpeakerListError("speaker list may not begin or end with whitespace")
    if " AND " in raw:
        raise SpeakerListError(
            f'Invalid speaker list "{raw}" — use lowercase " and " as the group separator',
        )

    names = _SPEAKER_SEPARATOR.split(raw)
    if not names or any(not name.strip() for name in names):
        raise SpeakerListError(
            f'Invalid speaker list "{raw}" — remove dangling or repeated separators',
        )

    cleaned_names = [name.strip() for name in names]
    for name in cleaned_names:
        validate_speaker_name(name)
    return cleaned_names


def parse_dialogue_line(line: str) -> tuple[list[str], str] | None:
    """Return speakers and dialogue text when a line contains a dialogue colon."""
    if ":" not in line:
        return None
    speaker_text, dialogue_text = line.split(":", 1)
    if speaker_text != speaker_text.rstrip():
        raise SpeakerListError(
            'Dialogue speaker labels must use "NAME: text" with no spaces '
            "before the colon",
        )
    speakers = parse_speaker_list(speaker_text)
    return speakers, dialogue_text.lstrip()


def _unique_preserve_order(names: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for name in names:
        if name not in seen:
            seen.add(name)
            ordered.append(name)
    return ordered


def _parse_performer_segments(line: str) -> list[str] | None:
    """Split a performer line into primary + parenthetical speaker-list segments.

    Returns None when the line is not a parenthetical attribution shape.
    """
    if "(" not in line or ")" not in line:
        return None
    if not _has_balanced_parentheses(line):
        return None

    segments = [match.group(1).strip() for match in _PARENTHETICAL_SEGMENT.finditer(line)]
    if not segments or any(not segment for segment in segments):
        return None

    primary = _PARENTHETICAL_SEGMENT.sub(" ", line)
    primary = re.sub(r"\s+", " ", primary).strip()
    if not primary:
        return None

    return [primary, *segments]


def parse_performer_line(
    line: str,
    known_character_names: set[str],
    *,
    allow_new_parenthetical_names: bool = False,
) -> list[str] | None:
    """Return names when every valid list member is a known song performer.

    Supports simple lists (``VERA & MOM``) and parenthetical alternates
    (``SHACKLETON (WILD)``). Parenthetical MVP collects all resolved names;
    it does not assign segment ownership inside following lyrics.

    When ``allow_new_parenthetical_names`` is True, primary names must still be
    known, but parenthetical names only need valid speaker grammar (import may
    create those Characters).
    """
    try:
        names = parse_speaker_list(line)
    except SpeakerListError:
        names = None
    else:
        if all(name in known_character_names for name in names):
            return names

    segments = _parse_performer_segments(line)
    if segments is None:
        return None

    primary, *parentheticals = segments
    try:
        primary_names = parse_speaker_list(primary)
        parenthetical_names: list[str] = []
        for segment in parentheticals:
            parenthetical_names.extend(parse_speaker_list(segment))
    except SpeakerListError:
        return None

    if not primary_names:
        return None
    if not all(name in known_character_names for name in primary_names):
        return None
    if not allow_new_parenthetical_names:
        if not all(name in known_character_names for name in parenthetical_names):
            return None
    return _unique_preserve_order([*primary_names, *parenthetical_names])


def is_all_caps_lyric(text: str) -> bool:
    """Return whether text is an ALL-CAPS lyric using approved punctuation."""
    if len(text.strip()) < 4 or text != text.strip():
        return False
    if not any(character.isalpha() for character in text):
        return False
    if any(character.isalpha() and not character.isupper() for character in text):
        return False
    if any(character not in _LYRIC_ALLOWED for character in text):
        return False

    return _has_balanced_parentheses(text)


def _has_balanced_parentheses(text: str) -> bool:
    parenthesis_depth = 0
    for character in text:
        if character == "(":
            parenthesis_depth += 1
        elif character == ")":
            parenthesis_depth -= 1
            if parenthesis_depth < 0:
                return False
    return parenthesis_depth == 0


def validate_song_title(
    title: str,
    known_character_names: set[str],
) -> None:
    """Require a non-empty, ALL-CAPS title that is not a performer list."""
    if not title.strip():
        raise ValueError("Song header is empty — add an ALL-CAPS song title")
    if any(character.isalpha() and not character.isupper() for character in title):
        raise ValueError(f'Song header "{title}" must use ALL CAPS')
    if not any(character.isalpha() for character in title):
        raise ValueError(f'Song header "{title}" must contain at least one letter')
    if any(character not in _SONG_TITLE_ALLOWED for character in title):
        raise ValueError(
            f'Song header "{title}" contains unsupported punctuation',
        )
    if not _has_balanced_parentheses(title):
        raise ValueError(f'Song header "{title}" has unbalanced parentheses')

    if parse_performer_line(title, known_character_names):
        raise ValueError(
            f'Song header "{title}" looks like a performer attribution. '
            "Use Heading 3 for the song title and Body/Heading 4 ALL CAPS "
            "for performers.",
        )
