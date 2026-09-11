"""Format detection and script-line extraction (adapters → shared classifier)."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.services.importer.formats.md import extract_md_lines

SUPPORTED_EXTENSIONS = frozenset({".md", ".docx", ".pdf"})


@dataclass(frozen=True)
class TextSpan:
    """
    One PDF text span: a run of characters sharing a font on a single page.

    Spans are kept alongside the merged line so layout rules can tell columns
    apart (for example a speaker name at the left margin and dialogue indented
    to its right on the same visual row).
    """

    text: str
    page: int
    x0: float
    x1: float
    y0: float
    y1: float
    font_size: float
    font_name: str
    bold: bool
    italic: bool


@dataclass(frozen=True)
class LineLayout:
    """
    Where a line sits on the page, for layout-aware import rules.

    Only PDF extraction fills this in. Markdown and DOCX lines leave it unset,
    so the shared classifier must treat missing layout as "unknown", not "false".
    Coordinates are PDF points with the origin at the top-left of the page, so
    ``y0`` grows downward.
    """

    page: int
    x0: float
    x1: float
    y0: float
    y1: float
    font_size: float
    font_name: str
    bold: bool
    italic: bool
    spans: tuple[TextSpan, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ExtractedLine:
    """One adapter-emitted script line plus optional source location metadata."""

    text: str
    paragraph_number: int | None = None
    paragraph_style: str | None = None
    layout: LineLayout | None = None


@dataclass(frozen=True)
class ScriptExtraction:
    """Adapter output ready for shared preprocessing and classification."""

    source_format: str
    lines: list[ExtractedLine]


def detect_format(filename: str) -> str:
    """Return format key ('md', 'docx', or 'pdf') from filename extension."""
    lower = filename.lower().strip()
    if lower.endswith(".md"):
        return "md"
    if lower.endswith(".docx"):
        return "docx"
    if lower.endswith(".pdf"):
        return "pdf"
    raise ValueError(
        "Unsupported script format. Only .md, .docx, and .pdf files are accepted.",
    )


def extract_script(
    filename: str,
    content: bytes,
    start_page: int | None = None,
    end_page: int | None = None,
) -> ScriptExtraction:
    """
    Convert upload bytes into newline-oriented script lines with metadata.

    ``start_page`` and ``end_page`` are 1-based and inclusive. They only apply
    to PDFs, where scripts often start after several pages of front matter.
    """
    if not content:
        raise ValueError("Script file is empty")

    fmt = detect_format(filename)
    if fmt != "pdf" and (start_page is not None or end_page is not None):
        raise ValueError("Page ranges only apply to PDF scripts")

    if fmt == "md":
        lines = [
            ExtractedLine(text=text, paragraph_number=index)
            for index, text in enumerate(extract_md_lines(content), start=1)
        ]
    elif fmt == "docx":
        # Local import avoids a circular dependency with the DOCX adapter.
        from app.services.importer.formats.docx import extract_docx_extracted_lines

        lines = extract_docx_extracted_lines(content)
    else:
        # Imported on demand so md/docx imports never pay the PyMuPDF load cost.
        from app.services.importer.formats.pdf import extract_pdf_extracted_lines

        lines = extract_pdf_extracted_lines(
            content,
            start_page=start_page,
            end_page=end_page,
        )

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
