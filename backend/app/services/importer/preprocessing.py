"""Script preprocessing: mojibake repair, Markdown unescape, and line normalization."""

from __future__ import annotations

import re

# UTF-8 mojibake from Google Docs / Windows-1252 double-encoding.
# Sequences appear as three Unicode chars: U+00E2 U+20AC U+XXXX
MOJIBAKE_REPLACEMENTS: list[tuple[str, str]] = [
    ("\u00e2\u20ac\u2122", "'"),  # â€™ -> apostrophe / closing single quote
    ("\u00e2\u20ac\u2018", "'"),  # â€˜ -> left single quote
    ("\u00e2\u20ac\u02dc", "'"),  # â€˜ -> left single quote (modifier tilde variant)
    ("\u00e2\u20ac\u201c", "\u2013"),  # â€" -> en dash
    ("\u00e2\u20ac\u201d", "\u2014"),  # â€" -> em dash
    ("\u00e2\u20ac\u00a6", "\u2026"),  # â€¦ -> ellipsis
    # Smart double quotes (UTF-8 bytes C3 A2 E2 82 AC C5 93 / C2 9D misread as Latin-1+)
    ("\u00e2\u20ac\u0153", "\u201c"),  # â€œ -> left double quote
    ("\u00e2\u20ac\u009d", "\u201d"),  # â€ -> right double quote
]

# Google Docs Markdown escapes that should not remain in sacred Timeline text.
# Only unescape punctuation that is a Markdown artifact, not a real backslash.
_MD_UNESCAPE = re.compile(r"\\([!\\\-.#*_`\[\]\(\)])")
_INLINE_FOOTNOTE = re.compile(r"\[\^\d+\]")
_FOOTNOTE_DEFINITION_LINE = re.compile(r"^\[\^\d+\]:")


class ScriptDecodeError(ValueError):
    """Raised when script bytes cannot be decoded as UTF-8."""


def repair_mojibake(text: str) -> str:
    for bad, good in MOJIBAKE_REPLACEMENTS:
        text = text.replace(bad, good)
    return text


def unescape_markdown_artifacts(text: str) -> str:
    """Remove common Markdown backslash-escapes from Google Docs export."""
    return _MD_UNESCAPE.sub(r"\1", text)


def strip_inline_footnotes(text: str) -> str:
    """Remove inline ``[^n]`` markers without damaging ``[^n]:`` definition lines."""

    def _replace(match: re.Match[str]) -> str:
        start = match.start()
        line_start = text.rfind("\n", 0, start) + 1
        # Keep the marker when this line is a footnote definition (`[^1]: …`).
        if line_start == start and _FOOTNOTE_DEFINITION_LINE.match(text[line_start:]):
            return match.group(0)
        return ""

    without_markers = _INLINE_FOOTNOTE.sub(_replace, text)
    return re.sub(r"[ \t]{2,}", " ", without_markers)


def decode_script_bytes(content: bytes) -> str:
    """Decode script bytes as UTF-8 (BOM allowed)."""
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ScriptDecodeError(
            "Script file must be UTF-8 encoded. "
            "Re-export from Google Docs or save the file as UTF-8 and try again.",
        ) from exc


def normalize_typography(text: str) -> str:
    """Normalize curly quotes/apostrophes so character names match consistently."""
    return (
        text.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def preprocess_lines(lines: list[str]) -> list[str]:
    """Repair encoding artifacts and normalize each extracted line."""
    repaired: list[str] = []
    for line in lines:
        text = repair_mojibake(line)
        text = unescape_markdown_artifacts(text)
        text = normalize_typography(text)
        text = strip_inline_footnotes(text)
        repaired.append(text.rstrip())
    return repaired


def preprocess_script(content: bytes | str) -> list[str]:
    """Decode (if needed), repair mojibake, unescape Markdown, split lines."""
    if isinstance(content, bytes):
        text = decode_script_bytes(content)
    else:
        text = content

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.lstrip("\ufeff")
    text = repair_mojibake(text)
    text = unescape_markdown_artifacts(text)
    text = normalize_typography(text)
    text = strip_inline_footnotes(text)
    return [line.rstrip() for line in text.split("\n")]
