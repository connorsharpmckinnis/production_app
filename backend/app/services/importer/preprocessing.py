"""Script file preprocessing: encoding, mojibake repair, and line normalization."""

# UTF-8 mojibake from Google Docs / Windows-1252 double-encoding.
# Sequences appear as three Unicode chars: U+00E2 U+20AC U+XXXX
MOJIBAKE_REPLACEMENTS: list[tuple[str, str]] = [
    ("\u00e2\u20ac\u2122", "'"),       # â€™ -> apostrophe / closing quote
    ("\u00e2\u20ac\u2018", "'"),       # â€˜ -> left single quote
    ("\u00e2\u20ac\u02dc", "'"),       # â€˜ -> left single quote (modifier tilde variant)
    ("\u00e2\u20ac\u201c", "\u2013"),  # â€" -> en dash
    ("\u00e2\u20ac\u201d", "\u2014"),  # â€" -> em dash
    ("\u00e2\u20ac\u00a6", "\u2026"),  # â€¦ -> ellipsis
]


def repair_mojibake(text: str) -> str:
    for bad, good in MOJIBAKE_REPLACEMENTS:
        text = text.replace(bad, good)
    return text


def preprocess_script(content: bytes | str) -> list[str]:
    """Decode, repair mojibake, split lines, strip trailing whitespace."""
    if isinstance(content, bytes):
        text = content.decode("utf-8")
    else:
        text = content

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.lstrip("\ufeff")
    text = repair_mojibake(text)
    return [line.rstrip() for line in text.split("\n")]
