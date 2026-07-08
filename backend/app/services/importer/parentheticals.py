"""Parse character names from dialogue speaker labels."""

import re


def parse_speaker_names(raw: str) -> list[str]:
    """Split 'SHACKLETON, WORSLEY' or 'VERA & MOM' into individual names."""
    names: list[str] = []
    for part in re.split(r"\s+and\s+", raw, flags=re.IGNORECASE):
        for segment in part.split(","):
            segment = segment.strip()
            if " & " in segment:
                for sub in segment.split(" & "):
                    cleaned = sub.strip()
                    if cleaned:
                        names.append(cleaned)
            elif segment:
                names.append(segment)
    return names


def parse_singer_line(line: str, dialogue_characters: set[str]) -> list[str] | None:
    """
    If the line lists only known dialogue characters (or built-in ALL / ENSEMBLE),
    return their names.

    Returns None when the line is not a singer attribution (e.g. it is a lyric).
    """
    stripped = line.strip()
    if not stripped:
        return None

    names = parse_speaker_names(stripped)
    if not names:
        return None

    if all(name in dialogue_characters for name in names):
        return names

    return None
