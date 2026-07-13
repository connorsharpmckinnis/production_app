"""Format detection and script-line extraction (adapters → shared classifier)."""

from __future__ import annotations

from app.services.importer.formats.docx import extract_docx_lines
from app.services.importer.formats.md import extract_md_lines

SUPPORTED_EXTENSIONS = frozenset({".md", ".docx"})


def detect_format(filename: str) -> str:
    """Return format key ('md' or 'docx') from filename extension."""
    lower = filename.lower().strip()
    if lower.endswith(".md"):
        return "md"
    if lower.endswith(".docx"):
        return "docx"
    raise ValueError(
        "Unsupported script format. Only .md and .docx files are accepted.",
    )


def extract_script_lines(filename: str, content: bytes) -> list[str]:
    """
    Convert upload bytes into newline-oriented script lines.

    Adapters may normalize structure (headings, italics) for the shared
    classifier. They must not rewrite dialogue or lyric wording.
    """
    if not content:
        raise ValueError("Script file is empty")

    fmt = detect_format(filename)
    if fmt == "md":
        lines = extract_md_lines(content)
    else:
        lines = extract_docx_lines(content)

    if not any(line.strip() for line in lines):
        raise ValueError("Script file is empty")
    return lines
