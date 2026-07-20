"""Format detection and script-line extraction (adapters → shared classifier)."""

from __future__ import annotations

from dataclasses import dataclass

from app.services.importer.formats.md import extract_md_lines

SUPPORTED_EXTENSIONS = frozenset({".md", ".docx"})


@dataclass(frozen=True)
class ExtractedLine:
    """One adapter-emitted script line plus optional source location metadata."""

    text: str
    paragraph_number: int | None = None
    paragraph_style: str | None = None


@dataclass(frozen=True)
class ScriptExtraction:
    """Adapter output ready for shared preprocessing and classification."""

    source_format: str
    lines: list[ExtractedLine]


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


def extract_script(filename: str, content: bytes) -> ScriptExtraction:
    """Convert upload bytes into newline-oriented script lines with metadata."""
    if not content:
        raise ValueError("Script file is empty")

    fmt = detect_format(filename)
    if fmt == "md":
        lines = [
            ExtractedLine(text=text, paragraph_number=index)
            for index, text in enumerate(extract_md_lines(content), start=1)
        ]
    else:
        # Local import avoids a circular dependency with the DOCX adapter.
        from app.services.importer.formats.docx import extract_docx_extracted_lines

        lines = extract_docx_extracted_lines(content)

    if not any(line.text.strip() for line in lines):
        raise ValueError("Script file is empty")
    return ScriptExtraction(source_format=fmt, lines=lines)


def extract_script_lines(filename: str, content: bytes) -> list[str]:
    """
    Convert upload bytes into newline-oriented script lines.

    Adapters may normalize structure (headings, italics) for the shared
    classifier. They must not rewrite dialogue or lyric wording.
    """
    return [line.text for line in extract_script(filename, content).lines]
