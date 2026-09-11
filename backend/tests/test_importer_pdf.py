"""PDF adapter: reading order, layout metadata, page windows, and errors.

Fixtures are generated in memory with PyMuPDF so no licensed script PDF has to
live in the repo. They imitate the Scrooge layout: a left speaker column, an
indented dialogue column, italic stage directions, and a page number footer.
"""

from __future__ import annotations

import pymupdf
import pytest

from app.services.importer.extract import detect_format, extract_script
from app.services.importer.formats.pdf import extract_pdf_extracted_lines

PLAIN_FONT = "helv"
BOLD_FONT = "hebo"
ITALIC_FONT = "heit"

SPEAKER_COLUMN_X = 72
DIALOGUE_COLUMN_X = 220


def _two_column_script_pdf() -> bytes:
    """One letter-size page shaped like the Scrooge sample."""
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)

    page.insert_text((SPEAKER_COLUMN_X, 100), "ACT I", fontname=BOLD_FONT, fontsize=14)
    page.insert_text(
        (SPEAKER_COLUMN_X, 130),
        "SCENE 1: LONDON TOWN SQUARE",
        fontname=BOLD_FONT,
        fontsize=12,
    )
    page.insert_text(
        (SPEAKER_COLUMN_X, 160),
        "(As overture leads into the town square.)",
        fontname=ITALIC_FONT,
        fontsize=11,
    )
    # Speaker and dialogue share a baseline, as they do in the real script.
    page.insert_text((SPEAKER_COLUMN_X, 190), "Scrooge", fontname=PLAIN_FONT, fontsize=11)
    page.insert_text(
        (DIALOGUE_COLUMN_X, 190),
        "Bah! Humbug!",
        fontname=PLAIN_FONT,
        fontsize=11,
    )
    page.insert_text(
        (SPEAKER_COLUMN_X, 215),
        "Storyteller",
        fontname=PLAIN_FONT,
        fontsize=11,
    )
    page.insert_text(
        (DIALOGUE_COLUMN_X, 215),
        "The London fog rolls in.",
        fontname=PLAIN_FONT,
        fontsize=11,
    )
    page.insert_text(
        (SPEAKER_COLUMN_X, 245),
        'SONG: "A MERRY CHRISTMAS!"',
        fontname=BOLD_FONT,
        fontsize=11,
    )
    # Running page number in the footer, which profiles will later ignore.
    page.insert_text((300, 740), "5", fontname=PLAIN_FONT, fontsize=9)

    return document.tobytes()


def _multi_page_pdf() -> bytes:
    """Front matter on page 1, script body on pages 2 and 3."""
    document = pymupdf.open()
    for text in ("FRONT MATTER", "ACT I", "SCENE 1: LONDON TOWN SQUARE"):
        page = document.new_page(width=612, height=792)
        page.insert_text((72, 100), text, fontname=PLAIN_FONT, fontsize=12)
    return document.tobytes()


def _blank_page_pdf() -> bytes:
    """A page with no text at all, standing in for a scanned script."""
    document = pymupdf.open()
    document.new_page(width=612, height=792)
    return document.tobytes()


def test_detect_format_accepts_pdf():
    assert detect_format("Scrooge.PDF") == "pdf"


def test_reading_order_merges_columns_into_one_line():
    lines = extract_pdf_extracted_lines(_two_column_script_pdf())

    assert [line.text for line in lines] == [
        "ACT I",
        "SCENE 1: LONDON TOWN SQUARE",
        "(As overture leads into the town square.)",
        "Scrooge Bah! Humbug!",
        "Storyteller The London fog rolls in.",
        'SONG: "A MERRY CHRISTMAS!"',
        "5",
    ]
    assert [line.paragraph_number for line in lines] == [1, 2, 3, 4, 5, 6, 7]


def test_merged_line_keeps_both_columns_as_spans():
    lines = extract_pdf_extracted_lines(_two_column_script_pdf())
    dialogue = lines[3]

    speaker_span, dialogue_span = dialogue.layout.spans
    assert speaker_span.text.strip() == "Scrooge"
    assert dialogue_span.text.strip() == "Bah! Humbug!"
    assert speaker_span.x0 == pytest.approx(SPEAKER_COLUMN_X, abs=2)
    assert dialogue_span.x0 == pytest.approx(DIALOGUE_COLUMN_X, abs=2)
    # The merged line spans both columns.
    assert dialogue.layout.x0 == pytest.approx(SPEAKER_COLUMN_X, abs=2)
    assert dialogue.layout.x1 > DIALOGUE_COLUMN_X


def test_layout_metadata_reports_page_font_and_style():
    lines = extract_pdf_extracted_lines(_two_column_script_pdf())
    act, _scene, direction = lines[0], lines[1], lines[2]

    assert act.layout.page == 1
    assert act.layout.font_size == pytest.approx(14.0, abs=0.1)
    assert "Helvetica" in act.layout.font_name
    assert act.layout.bold is True
    assert act.layout.italic is False

    assert direction.layout.italic is True
    assert direction.layout.bold is False
    assert direction.layout.y0 < direction.layout.y1


def test_page_window_limits_pages_read():
    content = _multi_page_pdf()

    from_page_two = extract_pdf_extracted_lines(content, start_page=2)
    assert [line.text for line in from_page_two] == [
        "ACT I",
        "SCENE 1: LONDON TOWN SQUARE",
    ]
    assert [line.layout.page for line in from_page_two] == [2, 3]

    single_page = extract_pdf_extracted_lines(content, start_page=2, end_page=2)
    assert [line.text for line in single_page] == ["ACT I"]


def test_page_window_beyond_document_is_rejected():
    with pytest.raises(ValueError, match="out of range"):
        extract_pdf_extracted_lines(_multi_page_pdf(), start_page=9)

    with pytest.raises(ValueError, match="start_page must be 1 or greater"):
        extract_pdf_extracted_lines(_multi_page_pdf(), start_page=0)

    with pytest.raises(ValueError, match="end_page must not be before start_page"):
        extract_pdf_extracted_lines(_multi_page_pdf(), start_page=3, end_page=2)


def test_page_window_with_no_text_explains_the_window():
    with pytest.raises(ValueError, match="requested PDF pages"):
        extract_pdf_extracted_lines(_blank_page_pdf(), start_page=1)


def test_pdf_without_selectable_text_suggests_a_text_export():
    with pytest.raises(ValueError, match="no selectable text"):
        extract_pdf_extracted_lines(_blank_page_pdf())


def test_unreadable_bytes_are_rejected():
    with pytest.raises(ValueError, match="Could not read PDF file"):
        extract_pdf_extracted_lines(b"this is definitely not a PDF")


def test_extract_script_dispatches_to_the_pdf_adapter():
    extraction = extract_script("Scrooge.pdf", _two_column_script_pdf())

    assert extraction.source_format == "pdf"
    assert extraction.lines[0].text == "ACT I"
    assert extraction.lines[0].layout is not None


def test_extract_script_passes_the_page_window_through():
    extraction = extract_script(
        "Scrooge.pdf",
        _multi_page_pdf(),
        start_page=2,
        end_page=2,
    )

    assert [line.text for line in extraction.lines] == ["ACT I"]


def test_empty_pdf_upload_is_rejected():
    with pytest.raises(ValueError, match="Script file is empty"):
        extract_script("Scrooge.pdf", b"")


def test_markdown_extraction_keeps_working_without_layout():
    extraction = extract_script("script.md", b"# Act One\nSCROOGE: Bah! Humbug!\n")

    assert extraction.source_format == "md"
    assert extraction.lines[0].text == "# Act One"
    assert all(line.layout is None for line in extraction.lines)


def test_page_window_is_rejected_for_non_pdf_scripts():
    with pytest.raises(ValueError, match="Page ranges only apply to PDF scripts"):
        extract_script("script.md", b"# Act One\n", start_page=2)
