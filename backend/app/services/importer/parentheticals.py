"""Compatibility helpers for character names in imported scripts."""

from app.services.importer.grammar import parse_performer_line, parse_speaker_list

def parse_speaker_names(raw: str) -> list[str]:
    """Validate and split a shared speaker-list expression."""
    return parse_speaker_list(raw)


def parse_singer_line(line: str, dialogue_characters: set[str]) -> list[str] | None:
    """
    If the line lists only known dialogue characters (or built-in ALL / ENSEMBLE),
    return their names.

    Returns None when the line is not a singer attribution (e.g. it is a lyric).
    """
    return parse_performer_line(line.strip(), dialogue_characters)
