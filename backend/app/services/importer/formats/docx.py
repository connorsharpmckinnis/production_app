"""DOCX script adapter — Word paragraphs to classifier-shaped lines."""

from __future__ import annotations

from io import BytesIO

from docx import Document
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph


def extract_docx_lines(content: bytes) -> list[str]:
    """
    Map DOCX paragraphs to the Markdown dialect the classifier understands.

    Recommended Google Docs / Word styles:
    - Title → production title page (parsed, does not rename the production)
    - Heading / Heading 1 → Act
    - Heading 2 → Scene or End of Scene
    - Heading 3 → song title (ALL CAPS; hyperlink optional)
    - Heading 4 → song description (sentence case) or singer/lyrics (ALL CAPS)
    - Body italic → stage direction
    - Body ALL CAPS → singer label / lyric (gold-standard scripts also center these)
    - Body ``NAME:`` → dialogue
    """
    try:
        document = Document(BytesIO(content))
    except Exception as exc:
        raise ValueError(
            "Could not read DOCX file — export a valid Word (.docx) document "
            "from Google Docs (File → Download → Microsoft Word).",
        ) from exc

    return [_paragraph_to_line(paragraph) for paragraph in document.paragraphs]


def _style_name(paragraph: Paragraph) -> str:
    if paragraph.style is None or paragraph.style.name is None:
        return ""
    return paragraph.style.name


def _paragraph_text(paragraph: Paragraph) -> str:
    return "".join(run.text for run in paragraph.runs) if paragraph.runs else paragraph.text


def _is_effectively_italic(paragraph: Paragraph) -> bool:
    """True when every non-empty run is italic (stage directions)."""
    runs_with_text = [run for run in paragraph.runs if run.text and run.text.strip()]
    if not runs_with_text:
        return False
    return all(_run_is_italic(run) for run in runs_with_text)


def _run_is_italic(run) -> bool:
    if run.italic is True:
        return True
    if run.italic is False:
        return False
    # Inherit from character style / paragraph style when run.italic is None.
    element = run._element
    rpr = element.find(qn("w:rPr"))
    if rpr is not None and rpr.find(qn("w:i")) is not None:
        return True
    return False


def _is_all_caps(text: str) -> bool:
    letters = [ch for ch in text if ch.isalpha()]
    return bool(letters) and all(ch.isupper() for ch in letters)


def _paragraph_to_line(paragraph: Paragraph) -> str:
    raw = _paragraph_text(paragraph)
    text = raw.strip()
    style = _style_name(paragraph)

    if not text:
        return ""

    if style == "Title":
        return f"# Title: {text}"

    # Taglines / draft labels — not part of the import grammar.
    if style == "Subtitle":
        return ""

    if style in ("Heading", "Heading 1"):
        return f"# {text}"

    if style == "Heading 2":
        return f"## {text}"

    # Song titles: Heading 3, typically ALL CAPS and centered. No hyperlink required.
    if style == "Heading 3":
        return f"### {text}"

    if style == "Heading 4":
        # Sentence-case / mixed → song description via ####.
        # ALL CAPS → singer or lyric (plain; classifier already handles this).
        if _is_all_caps(text):
            return text
        return f"#### {text}"

    # Front-matter credits that are not Author.
    if text.lower().startswith("music:"):
        return ""

    if _is_effectively_italic(paragraph):
        return f"*{text}*"

    # Singer labels / lyrics: ALL CAPS body text (centered in the gold-standard
    # script; ALL CAPS alone is enough for Phase 7).
    if _is_all_caps(text) and ":" not in text:
        return text

    return raw.rstrip()
