# Catalog CSV Fixtures

Sample CSV catalogs for Phase 8 bulk import. Headers match [docs/CATALOG_CSV.md](../../docs/CATALOG_CSV.md).

| File | Asset | Notes |
|---|---|---|
| `props.csv` | Props | `name`, optional `description` / `notes` |
| `set_pieces.csv` | Set pieces | `mobile` is `true`/`false`/`1`/`0` |
| `songs.csv` | Songs | Extra songs beyond those created by script import |
| `cue_categories.csv` | Cue categories | Common tech categories |
| `costumes.csv` | Costumes | Requires an imported production with matching character + scene titles |

Lav wires/packs are added on the **Lav chart** (not CSV in this phase). Timeline microphones CSV was retired in Phase 13.

## Loading for a pilot

1. Create a production and import a script (so characters and scenes exist).
2. As Director or Admin, open each catalog page (or call the import API).
3. Upload the matching CSV, or start from **Download CSV template** and fill rows.
4. Re-importing the same file skips duplicate keys and reports `skipped`.

Costume rows must use character names and scene titles from the production. For Endurance Scene 1, a valid scene title is `Welcome to the Age of Adventure` (or `Act 1 / Welcome to the Age of Adventure`).

API paths:

```text
POST /api/productions/{id}/props/import
POST /api/productions/{id}/set-pieces/import
POST /api/productions/{id}/costumes/import
POST /api/productions/{id}/songs/import
POST /api/productions/{id}/cue-categories/import
```

Multipart field name: `file`.
