# Script Fixtures

Test scripts for import development and validation.

| File | Role | Description |
|---|---|---|
| `endurance-scene1.md` | Gold / clean | Act One, Scene One Markdown regression fixture. |
| `Endurance Scene 1.docx` | Gold / clean | DOCX twin of scene one (legacy field-code hyperlinks, Heading styles). |
| `endurance-full.md` | Dirty | Full *Endurance* Markdown export. Intentionally fails import without cleanup. |
| `App-Formatted Copy of Script 2026 Draft 2-4.docx` | Dirty | Full-script DOCX with modern `w:hyperlink` song titles and known source-style issues. |
| `endurance-full-cleaned.md` | Cleaned twin | Owner-normalized Markdown for full-show import/parity. |
| `endurance-full-cleaned.docx` | Cleaned twin | Owner-normalized DOCX for full-show import/parity. |

## Dirty vs cleaned

- **Dirty originals** preserve confirmed parser and source-format failures for regression.
- **Cleaned twins** apply the Phase 9 source cleanup (`MCNISH`, `CHORUS`, spaced colons, Heading 3 performers, scripture `Note:` wrappers, and related fixes).
- Scene-one gold fixtures remain the primary exact semantic-parity pair.
- Full cleaned twins assert matching acts/scenes/songs/characters. Moment counts may differ slightly because Markdown and DOCX pack scripture notes and lyric paragraphs differently.

Known full-script issues and cleanup decisions are tracked in [IMPORT_SPEC.md](../../docs/IMPORT_SPEC.md) and [PHASE_9.md](../../docs/PHASE_9.md).

Source: Google Docs *Endurance* draft exports.
