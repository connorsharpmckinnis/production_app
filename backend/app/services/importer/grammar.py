"""Shared grammar helpers for dialogue, songs, and lyrics."""

from __future__ import annotations

import re


_SPEAKER_NAME_ALLOWED = re.compile(
    r"^[A-Za-z0-9](?:[A-Za-z0-9 .'’‘-]*[A-Za-z0-9])?$",
)
_SPEAKER_SEPARATOR = re.compile(r",\s+and\s+|,\s*|\s+&\s+|\s+and\s+")
_LYRIC_ALLOWED = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789 \t"
    "'’‘\"“”"
    ".,…!?;"
    "-–—"
    "&()/"
    "[]^"  # Google Docs footnote markers such as [^9]
)
_SONG_TITLE_ALLOWED = _LYRIC_ALLOWED | frozenset("/:")


class SpeakerListError(ValueError):
    """Raised when a speaker or performer list does not follow the shared grammar."""


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


def parse_performer_line(
    line: str,
    known_character_names: set[str],
) -> list[str] | None:
    """Return names when every valid list member is a known song performer."""
    try:
        names = parse_speaker_list(line)
    except SpeakerListError:
        return None
    if all(name in known_character_names for name in names):
        return names
    return None


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
