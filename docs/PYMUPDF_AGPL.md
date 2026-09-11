# PyMuPDF (AGPL) — What We Depend On and How to Replace It

**Status:** informational inventory, written when PDF script import (Importer 2.0, Workstream A) landed.
**Owner decision needed only if** the project is ever distributed to another org, sold as a product, or needs to stay closed-source.

## The concern in one paragraph

PDF text extraction uses [PyMuPDF](https://pymupdf.readthedocs.io/) (the `pymupdf` package, formerly imported as `fitz`), which wraps the MuPDF C library from Artifex. Both are released under the **GNU AGPL v3**, not a permissive license. AGPL is copyleft that also covers *network* use: if users interact with a modified or combined work over a network, the AGPL asks that they be offered the corresponding source of the whole combined work. Theater Thing is served over the network (see [DEPLOY.md](DEPLOY.md), Cloud Run), so the backend that imports `pymupdf` is the part that carries this obligation. Artifex sells a commercial license that removes it.

The owner approved PyMuPDF for this sprint. That is a product/dependency decision,
not a legal conclusion. Revisit the license obligations before broader hosting,
distribution, white-labeling, or resale, and obtain legal advice if needed.

## What we actually depend on

| Item | Value |
|---|---|
| Package | `pymupdf` (pinned in `backend/pyproject.toml`, locked in `backend/uv.lock`) |
| Version at adoption | 1.28.2 |
| License | AGPL-3.0-or-later (PyMuPDF and the bundled MuPDF), commercial license available from Artifex |
| Backend modules importing it | **only** `backend/app/services/importer/formats/pdf.py` |
| Test-only use | `backend/tests/test_importer_pdf.py` builds synthetic PDFs for fixtures |
| Frontend | no dependency; PDFs are parsed server-side only |

Nothing else in `app/` imports `pymupdf`. That is deliberate and worth keeping true — a grep for `pymupdf` should stay this short.

## Features that would stop working without it

- **PDF script import** — `.pdf` accepted by `detect_format` / `extract_script` in `backend/app/services/importer/extract.py`.
- **PDF import preview** — `POST /api/productions/{id}/import/preview` extracts a
  page window before applying the live profile draft.
- **PDF import commit** — `POST /api/productions/{id}/import` extracts the full
  configured page range before writing Timeline data.

Markdown and DOCX import do not touch PyMuPDF. The import is lazy (inside `extract_script`), so `.md` and `.docx` uploads never even load the library.

## The replacement seam

Everything PDF-specific sits behind one function:

```
backend/app/services/importer/formats/pdf.py

extract_pdf_extracted_lines(
    content: bytes,
    start_page: int | None = None,
    end_page: int | None = None,
    y_tolerance: float = DEFAULT_Y_TOLERANCE,
) -> list[ExtractedLine]
```

It returns plain `ExtractedLine` objects (with the optional `LineLayout` / `TextSpan` metadata defined in `extract.py`). Those dataclasses hold nothing PyMuPDF-shaped: text, page, `x0/x1/y0/y1`, font size, font name, and bold/italic booleans. Any library that can report per-span text with coordinates and font info can fill them in.

**To swap libraries:** rewrite `formats/pdf.py`, keep the function signature and the returned dataclasses, and run `backend/tests/test_importer_pdf.py`. The tests assert behavior (reading order, merged two-column lines, metadata, error messages), not PyMuPDF internals — except for the fixture builders at the top of the file, which would also need porting to whatever library can *write* a test PDF (or the fixtures could be checked in as small synthetic files instead).

### Permissive alternatives, if the license ever bites

| Option | License | Trade-off |
|---|---|---|
| `pdfplumber` (on `pdfminer.six`) | MIT | Closest drop-in: gives chars/words with `x0/x1/top/bottom`, `fontname`, `size`. Noticeably slower on long scripts; pure Python. |
| `pypdfium2` (PDFium) | Apache-2.0 / BSD-3 | Fast, permissive, but text-with-position extraction is lower level and font style info is thinner. |
| `poppler` / `pdftotext -layout` | GPL | Also copyleft, and shells out to a binary. Not an improvement for this concern. |

Recommendation if a swap is forced: **pdfplumber**, because its span model maps almost one-to-one onto `TextSpan` and the layout rules built on top would not need to change.

## Rules of thumb going forward

- Keep `pymupdf` imported in exactly one module.
- Do not let PyMuPDF objects (`Document`, `Page`, span dicts) escape `formats/pdf.py`.
- If PDF handling grows (OCR, thumbnails, page images), add it behind the same adapter rather than importing `pymupdf` somewhere new.
- Revisit this doc before any distribution, white-label, or resale of the app.
