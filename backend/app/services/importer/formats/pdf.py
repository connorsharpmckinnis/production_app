"""
PDF script adapter — selectable text to classifier-shaped lines with layout.

This module is the only place in the backend that touches PyMuPDF. Everything
it returns is a plain ``ExtractedLine``, so swapping the PDF library later means
rewriting this file and nothing else. See docs/PYMUPDF_AGPL.md for why that
seam matters.

Scanned (image-only) PDFs are not supported. OCR is a separate future project.
"""

from __future__ import annotations

import pymupdf

from app.services.importer.extract import ExtractedLine, LineLayout, TextSpan

# PyMuPDF reports font styling as a bit field on each span.
_ITALIC_FLAG = 1 << 1
_BOLD_FLAG = 1 << 4

# Spans whose vertical centers sit within this many points belong to the same
# visual row. Roughly a quarter of a normal 11-12pt script line, which is loose
# enough for wobbly baselines and tight enough to keep separate rows apart.
DEFAULT_Y_TOLERANCE = 3.0

# Gap between two spans, as a share of font size, that reads as a real space.
_SPACE_GAP_RATIO = 0.25


def extract_pdf_lines(
    content: bytes,
    start_page: int | None = None,
    end_page: int | None = None,
) -> list[str]:
    """Return only the text of each logical PDF line, in reading order."""
    lines = extract_pdf_extracted_lines(content, start_page, end_page)
    return [line.text for line in lines]


def extract_pdf_extracted_lines(
    content: bytes,
    start_page: int | None = None,
    end_page: int | None = None,
    y_tolerance: float = DEFAULT_Y_TOLERANCE,
) -> list[ExtractedLine]:
    """
    Map a text PDF to script lines carrying page, position, and font metadata.

    Reading order is page by page, top to bottom, then left to right. Spans that
    share a visual row are merged into one line — in a two-column script that
    puts the speaker label and the dialogue beside it on the same line, with the
    original spans preserved in ``layout.spans`` so rules can split by column.

    ``start_page`` and ``end_page`` are 1-based and inclusive, and let callers
    skip front matter without re-uploading the file.
    """
    document = _open_document(content)
    try:
        pages = _page_numbers(document.page_count, start_page, end_page)

        lines: list[ExtractedLine] = []
        for page_number in pages:
            page_spans = _page_spans(document[page_number - 1], page_number)
            for row in _group_spans_into_rows(page_spans, y_tolerance):
                line = _line_from_spans(row, paragraph_number=len(lines) + 1)
                if line is not None:
                    lines.append(line)
    finally:
        document.close()

    if not lines:
        raise ValueError(_no_text_message(start_page, end_page))
    return lines


def _open_document(content: bytes) -> pymupdf.Document:
    """Open upload bytes as a PDF, or raise a message staff can act on."""
    try:
        document = pymupdf.open(stream=content, filetype="pdf")
    except Exception as exc:
        raise ValueError(
            "Could not read PDF file — the file may be corrupt or may not be a "
            "real PDF. Try re-exporting it, or import a .md or .docx script.",
        ) from exc

    if document.needs_pass:
        document.close()
        raise ValueError(
            "PDF is password protected. Remove the password and upload again.",
        )
    if document.page_count == 0:
        document.close()
        raise ValueError("PDF has no pages")
    return document


def _page_numbers(
    page_count: int,
    start_page: int | None,
    end_page: int | None,
) -> range:
    """Validate the requested 1-based page window and return the pages to read."""
    first = 1 if start_page is None else start_page
    last = page_count if end_page is None else end_page

    if first < 1:
        raise ValueError("start_page must be 1 or greater")
    if first > page_count:
        raise ValueError(
            f"PDF has {page_count} page(s); start_page {first} is out of range",
        )
    if last < first:
        raise ValueError("end_page must not be before start_page")
    return range(first, min(last, page_count) + 1)


def _page_spans(page: pymupdf.Page, page_number: int) -> list[TextSpan]:
    """Collect every non-blank text span on one page."""
    spans: list[TextSpan] = []
    text_page = page.get_text("dict")
    for block in text_page.get("blocks", []):
        # Type 0 is text; type 1 is an image, which we cannot read without OCR.
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "")
                if not text.strip():
                    continue
                spans.append(_to_text_span(span, text, page_number))
    return spans


def _to_text_span(span: dict, text: str, page_number: int) -> TextSpan:
    x0, y0, x1, y1 = span.get("bbox", (0.0, 0.0, 0.0, 0.0))
    font_name = span.get("font", "")
    flags = int(span.get("flags", 0))
    return TextSpan(
        text=text,
        page=page_number,
        x0=float(x0),
        x1=float(x1),
        y0=float(y0),
        y1=float(y1),
        font_size=float(span.get("size", 0.0)),
        font_name=font_name,
        bold=_is_bold(flags, font_name),
        italic=_is_italic(flags, font_name),
    )


def _is_bold(flags: int, font_name: str) -> bool:
    # Some producers (Pages/Quartz among them) leave the flag off and only say
    # "Bold" in the font name, so check both.
    return bool(flags & _BOLD_FLAG) or "bold" in font_name.lower()


def _is_italic(flags: int, font_name: str) -> bool:
    lowered = font_name.lower()
    return bool(flags & _ITALIC_FLAG) or "italic" in lowered or "oblique" in lowered


def _group_spans_into_rows(
    spans: list[TextSpan],
    y_tolerance: float,
) -> list[list[TextSpan]]:
    """Group spans that share a visual row, top to bottom then left to right."""
    ordered = sorted(spans, key=lambda span: (_vertical_center(span), span.x0))

    rows: list[list[TextSpan]] = []
    row_center: float | None = None
    for span in ordered:
        center = _vertical_center(span)
        if row_center is None or abs(center - row_center) > y_tolerance:
            rows.append([span])
            row_center = center
        else:
            rows[-1].append(span)

    for row in rows:
        row.sort(key=lambda span: span.x0)
    return rows


def _vertical_center(span: TextSpan) -> float:
    return (span.y0 + span.y1) / 2


def _line_from_spans(
    spans: list[TextSpan],
    paragraph_number: int,
) -> ExtractedLine | None:
    """Merge one row of spans into a single script line, or None if blank."""
    text = _join_span_text(spans)
    if not text:
        return None

    # A row can mix fonts (a bold speaker beside plain dialogue). Report the
    # largest size, which is what heading-style rules care about, and treat the
    # row as bold or italic only when every span agrees.
    layout = LineLayout(
        page=spans[0].page,
        x0=min(span.x0 for span in spans),
        x1=max(span.x1 for span in spans),
        y0=min(span.y0 for span in spans),
        y1=max(span.y1 for span in spans),
        font_size=max(span.font_size for span in spans),
        font_name=spans[0].font_name,
        bold=all(span.bold for span in spans),
        italic=all(span.italic for span in spans),
        spans=tuple(spans),
    )
    return ExtractedLine(text=text, paragraph_number=paragraph_number, layout=layout)


def _join_span_text(spans: list[TextSpan]) -> str:
    """
    Join spans into one line, adding a space only where the page shows a gap.

    Author wording is never edited here; the only change is whitespace between
    spans and at the ends of the line.
    """
    parts: list[str] = []
    previous: TextSpan | None = None
    for span in spans:
        if previous is not None and _needs_space(previous, span, parts[-1]):
            parts.append(" ")
        parts.append(span.text)
        previous = span
    return "".join(parts).strip()


def _needs_space(previous: TextSpan, current: TextSpan, previous_text: str) -> bool:
    if previous_text.endswith(" ") or current.text.startswith(" "):
        return False
    gap = current.x0 - previous.x1
    return gap > _SPACE_GAP_RATIO * max(previous.font_size, current.font_size)


def _no_text_message(start_page: int | None, end_page: int | None) -> str:
    if start_page is not None or end_page is not None:
        return (
            "No selectable text found in the requested PDF pages. Check the "
            "start and end page, or upload a PDF with selectable text."
        )
    return (
        "PDF has no selectable text. Scanned or image-only PDFs are not "
        "supported yet — export a text PDF from the original document, or "
        "import a .md or .docx script instead."
    )
