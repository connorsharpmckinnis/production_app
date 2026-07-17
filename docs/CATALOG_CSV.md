# Catalog CSV Import

Bulk-create production catalog rows from UTF-8 CSV files (Phase 8). Moment attachments are **not** created via CSV.

Roles: **Director** or **Admin**.

## Endpoints

| Asset | Import | Template |
| ----- | ------ | -------- |
| Props | `POST /api/productions/{production_id}/props/import` | `GET .../props/import/template` |
| Microphones | `POST .../microphones/import` | `GET .../microphones/import/template` |
| Set pieces | `POST .../set-pieces/import` | `GET .../set-pieces/import/template` |
| Costumes | `POST .../costumes/import` | `GET .../costumes/import/template` |
| Songs | `POST .../songs/import` | `GET .../songs/import/template` |
| Cue categories | `POST .../cue-categories/import` | `GET .../cue-categories/import/template` |

- Multipart form field: `file`
- Max size: **1 MiB**
- Encoding: **UTF-8**, optional BOM (`utf-8-sig`)

## Shared behavior

1. Header row is required. Header names are matched **case-insensitively** after trim.
2. Unknown columns are **ignored** and listed in `warnings`.
3. Missing required headers reject the whole upload (`400`) with a clear message.
4. Blank or malformed data rows become **per-row errors** (row numbers are 1-based; header is row 1).
5. Valid rows are committed **once** after the file is processed (**partial success**). Invalid rows do not block valid ones.
6. Duplicate keys are skipped (not updated). Matching uses Unicode-safe `strip()` + `casefold()` against:
   - rows already in the production database, and
   - earlier **valid** rows in the same file.
7. Response shape:

```json
{
  "created": 2,
  "skipped": 1,
  "errors": [{"row": 4, "message": "..."}],
  "warnings": ["Ignored unknown column(s): extra"]
}
```

## Column maps


| Asset | Required | Optional | Duplicate key (skip) |
| ----- | -------- | -------- | -------------------- |
| Props | `name` | `description`, `notes` | `name` |
| Microphones | `identifier` | `notes` | `identifier` |
| Set pieces | `name` | `mobile`, `description` | `name` |
| Costumes | `name`, `character`, `scene` | `description` | `name` + resolved character + resolved scene |
| Songs | `title` | `composer`, `lyricist`, `description` | `title` |
| Cue categories | `name` | `description` | `name` |

### Set piece `mobile`

Accepts only (case-insensitive): `true`, `false`, `1`, `0`. Blank → `false`. Any other value is a row error.

### Costume `character`

Matched to a character name in the production (trim, case-insensitive). Unknown or ambiguous names are row errors.

### Costume `scene`

Matched against the **stored UI scene title** (`scenes.title`; empty string when untitled), trim + case-insensitive.

- If that title matches **more than one** scene in the production → row error (ambiguous).
- If no scene matches → row error (unknown).

To disambiguate titles that collide across acts, use the qualified form:

```text
Act N / Scene Title
```

Rules for the qualified form:

- `Act` is case-insensitive.
- Whitespace is trimmed around the act number, the `/`, and the title piece.
- `N` is the act number.
- The title piece matches `scenes.title` the same way as the unqualified form (within that act only).

Examples for Endurance Scene 1:

- `Welcome to the Age of Adventure`
- `Act 1 / Welcome to the Age of Adventure`

## Templates

Each `GET .../import/template` returns a UTF-8 CSV with the canonical header row only (no sample data), `Content-Type: text/csv`.

## Sample fixtures

See [fixtures/catalogs/](../fixtures/catalogs/README.md).

## Implementation

Shared parsing and import logic lives in `backend/app/services/catalog_csv.py` (Python stdlib `csv`).
