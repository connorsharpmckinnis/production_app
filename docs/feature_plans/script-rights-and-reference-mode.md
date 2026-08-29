# Feature plan — Script rights & reference-only productions

**Status:** Far-future (v2+)  
**Created:** 2026-08-28  
**Scope:** Future licensing-aware operation; not part of the STP-first pilot

**Related:**

- [PROJECT.md](../PROJECT.md)
- [DATABASE.md](../DATABASE.md)
- [IMPORT_SPEC.md](../IMPORT_SPEC.md)
- [ROLES.md](../ROLES.md)
- [show-archives.md](show-archives.md)
- [script-revision-reimport.md](script-revision-reimport.md)
- [crew-roles.md](crew-roles.md)
- [STP_PRODUCT_OVERVIEW.md](../STP_PRODUCT_OVERVIEW.md)

---

## Goal

Preserve Theater Thing's full value for productions whose script text may be
stored and shared, while also supporting productions where the organization may
use the work but may not upload, reproduce, retain, or redistribute the script
through the app.

The future system should distinguish:

1. **Rights-cleared script productions** — the app may import and display the
   script according to the organization's permission.
2. **Reference-only productions** — the app stores production structure and
   preparation data, but not the script contents.

This is intentionally a far-future plan. The STP-first pilot continues using
the current import workflow, with the working assumption that STP's scripts may
be used in the app as needed. No licensing gate should be added to the pilot
unless that assumption changes.

---

## Problem

The current product treats the imported script as the canonical source of the
Timeline:

```text
script text → Acts → Scenes → Moments → production preparation
```

That is appropriate for STP-owned material, but it cannot be assumed for every
organization or every licensed title. A performance license may not include
permission to scan, copy, digitize, upload, store, display, export, or retain
the script.

The current data model also has no durable place to record:

- Where the script came from
- Who owns or licenses it
- Whether digital storage was authorized
- Which users may access it
- How long the script may be retained
- What happens at archive or license expiration

Existing production data already includes imported text in `moments`,
structured dialogue and lyrics, and derived reports. A future rights-aware
design must account for all of those reproduction surfaces, not only the
original upload.

---

## Product principles

- **STP stays simple now.** Do not add rights workflow, warnings, or approval
  screens to the STP-first path.
- **Rights metadata is operational, not legal advice.** The organization must
  confirm its own rights and contracts; the app should record the result and
  enforce the selected mode.
- **When uncertain, do not ingest the script.** An unclear license defaults to
  reference-only operation until the organization confirms otherwise.
- **Production data remains useful without script text.** Cues, blocking,
  entrances, exits, asset events, rehearsal plans, notes, and reports should
  not depend on storing dialogue or stage directions.
- **Do not create a second source of truth.** Manual timelines still use the
  existing Act → Scene → Moment hierarchy and the existing moment-attached
  preparation data.
- **Deletion must be intentional.** Removing script text must not silently
  remove unrelated production preparation.

---

## Proposed data model

### Script access mode on Production

Add an operational field to `productions`:

- `script_access_mode`
  - `full_script` — script text may be stored and shown under the recorded
    rights decision
  - `reference_only` — script text must not be stored or displayed by the app

Existing STP productions should be backfilled to `full_script`. The migration
must not invent a legal rights claim; it only preserves current STP behavior.

This field is the source of truth for application behavior. It should be used
by import, timeline, search, rehearse, reports, archive, export, and deletion
paths rather than relying on UI-only hiding.

### Rights record

Add a one-to-one `production_script_rights` record rather than putting every
rights field directly on `productions`. The current application has no separate
`Script` entity, and a dedicated record keeps production identity separate from
rights/provenance metadata.

Likely fields:

- `id`
- `production_id`
- `source_kind`
  - `organization_owned`
  - `written_permission`
  - `publisher_licensed`
  - `public_domain`
  - `unknown`
- `rights_status`
  - `not_reviewed`
  - `confirmed`
  - `restricted`
  - `expired`
- `rights_holder_name`
- `publisher_or_licensor_name` (nullable)
- `license_reference` (nullable; an internal reference, not the contract itself)
- `confirmed_by_user_id` (nullable)
- `confirmed_at` (nullable)
- `effective_until` (nullable)
- `retention_until` (nullable)
- `permitted_audience` (nullable; structured values preferred)
- `notes` (nullable; operational notes only)
- `created_at`
- `updated_at`

The exact enum values and whether dates are inclusive require a schema
decision before implementation. The database should enforce that
`production_id` is unique in this table.

### Script source metadata

If revisions, multiple source files, or deletion requests become real
requirements, add a separate `production_script_sources` table. It may record:

- Source format and original filename
- Import timestamp
- Content fingerprint
- Source status (active, superseded, deleted)
- Whether the source was uploaded, manually authored, or externally referenced

Do not add this table merely to support the first rights metadata migration.
The existing import/re-import plan should be reconciled with it first.

### Moment provenance for both modes

Future manual or imported Moments should carry enough provenance to explain
what they represent without requiring script text:

- `content_origin`: imported or manual
- Optional source locator such as page, scene beat, cue number, or rehearsal
  reference

The locator must not contain a copied excerpt of the script. The final shape
should be designed after testing real publisher formats; a flexible JSON
locator may be appropriate if its keys remain documented and bounded.

---

## Reference-only production workflow

### Create a production

The production setup flow eventually offers:

1. Full-script production
2. Reference-only production

The second option should not ask the organization to upload a PDF, DOCX, scan,
or pasted script text. It creates an empty production workspace with the
standard production hierarchy.

### Build the Timeline manually

Authorized preparation users can:

1. Create Acts and Scenes with names and numbers.
2. Add, reorder, and delete Moments.
3. Give Moments short operational labels or source locators.
4. Attach cues, blocking, entrances, exits, notes, tasks, props, set pieces,
   costumes, and rehearsal data.
5. Generate the same preparation reports that do not require script text.

Reference-only Moments must not require `original_text`, dialogue text, lyric
text, or stage-direction text. A dedicated neutral/manual Moment type may be
needed so the UI does not imply that every Moment contains a script line.

The UI should warn users not to paste script excerpts into operational notes.
That warning is useful guidance, but the system should not pretend it can
guarantee that free-text notes contain no copyrighted material.

### Features that change in reference-only mode

- Timeline displays labels, locators, and production data instead of script
  text.
- Search covers operational metadata only.
- Rehearse can show scene order, cues, blocking, and notes, but line-based
  modes such as My Lines and Line Cues are unavailable unless authorized
  script text is later imported.
- Dialogue, lyrics, and stage-direction text fields are hidden or disabled.
- Reports redact script text and include only operational references.
- Export bundles contain production metadata and prep data, never a script
  excerpt or reconstructed text.

---

## Moving between modes

### Full script → reference-only

This is a rights-sensitive, potentially destructive operation:

1. Show exactly which stored text will be removed.
2. Require an authorized confirmation.
3. Preserve Acts, Scenes, Moment IDs, sequence, and production-prep records
   where possible.
4. Remove or redact `original_text`, parsed script text, dialogue text, lyric
   text, and stage-direction text.
5. Preserve non-script labels, source locators, cues, blocking, notes, and
   asset/rehearsal data subject to the organization's retention decision.
6. Record the change in an audit log.
7. Include backups, exports, caches, and archives in the deletion/retention
   design; deleting the active database row alone is insufficient.

The operation must not promise that removed script text can be recovered.

### Reference-only → full script

This should require a newly authorized source import. It must not restore
previously deleted text. Matching the new imported structure to existing
manual Moments is a separate re-import/reconciliation problem and should use
[script-revision-reimport.md](script-revision-reimport.md) as a starting point.

---

## Rights-aware lifecycle behavior

### Import and upload

- Full-script import requires a recorded rights basis once this feature is
  enabled.
- Reference-only productions reject script uploads, including DOCX, Markdown,
  PDF, image scans, and pasted full-script text.
- The import endpoint must enforce the mode in the backend.
- Error messages should explain the operational restriction without presenting
  the app as a legal authority.
- Upload size limits and content checks remain necessary even for
  rights-cleared productions.

### Access

- Existing production-scoped authorization remains mandatory.
- Rights metadata may impose a narrower audience than ordinary production
  membership.
- Actor, Director, crew, and Admin access should be evaluated separately from
  who is allowed to manage rights metadata.
- A user should not gain script access merely because they can access
  production preparation data.

### Archive and retention

The archive plan must distinguish STP-owned productions from licensed
productions:

- STP-owned full-script archives may retain script text according to the
  organization's policy.
- Licensed productions may require text deletion, access expiration, or
  destruction/return after the production.
- A reference-only archive may retain structure and preparation data without
  retaining script text.
- `retention_until` must be enforced by an explicit lifecycle process before
  it is treated as more than documentation.

Archive export, backups, and remount helpers must use the same rights rules.
Remounting should copy eligible preparation data, not silently clone
restricted script text.

### Audit and accountability

Before enabling external organizations, plan for audit records covering:

- Rights record creation and changes
- Mode changes
- Script imports and redactions
- Script exports or archive bundles
- Permission-sensitive access if required by the chosen threat model

Do not log script contents, full request bodies, or copied excerpts.

---

## Work packages

### WP0 — Rights policy and source research

- Confirm the organizations and publishers the product actually expects to
  support.
- Review representative license agreements and digital-script terms.
- Turn findings into a short operational intake checklist.
- Confirm with a qualified legal advisor when a real deployment depends on a
  contract interpretation.

**Done when:** an organization can answer “may we store and show this script in
this app, to these users, until when?” before selecting `full_script`.

### WP1 — Rights metadata schema

- Add `productions.script_access_mode`.
- Add the one-to-one rights record and constraints.
- Decide whether/when source-version records are needed.
- Backfill existing STP data without interrupting the current workflow.
- Add API schemas, Admin/authorized-manager permissions, and migration tests.

**Done when:** every production can state its operational script mode and
rights record without changing existing STP behavior.

### WP2 — Rights-aware lifecycle enforcement

- Enforce mode at import, timeline, search, Rehearse, reports, exports, and
  archive boundaries.
- Add production-level authorization tests for both modes.
- Add clear Admin-facing status and expiration warnings.
- Define what happens when `retention_until` passes.

**Done when:** a restricted production cannot leak script text through a
secondary endpoint or derived report.

### WP3 — Reference-only Timeline

- Support manual Act/Scene/Moment creation from an empty production.
- Add neutral/manual Moment semantics and source locators.
- Reuse existing cue, blocking, E/E, asset-event, rehearsal, note, and report
  systems.
- Disable or adapt line-based actor workflows.

**Done when:** a director can prepare a scene with cues, blocking, movement,
assets, notes, and rehearsal information without uploading or entering the
script text.

### WP4 — Redaction, archive, export, and audit

- Design full-script to reference-only conversion.
- Define deletion behavior for database rows, backups, exports, and archives.
- Add redacted export bundles.
- Add audit logging for rights-sensitive changes.
- Reconcile this work with [show-archives.md](show-archives.md).

**Done when:** an organization can end script retention while keeping
permitted production knowledge.

### WP5 — External-organization validation

- Test against at least one organization-owned script and one restrictive
  licensed title.
- Validate the workflow with the actual license terms, not assumptions about
  PDFs, Word files, copy counts, or digital readers.
- Document limitations and user-facing guidance.

**Done when:** the product can clearly explain what it can and cannot do for
each tested rights environment.

---

## Dependencies

- Existing production-scoped access enforcement
- Current import and immutable `original_text` model
- Structural Timeline editing
- Existing moment-attached prep data and Phase 14 asset events
- Rehearsal management
- [script-revision-reimport.md](script-revision-reimport.md)
- [show-archives.md](show-archives.md)
- Future crew/domain-specific permissions
- A documented backup and deletion policy

---

## Explicitly out of scope

- Legal advice or automated legal conclusions
- Automatic interpretation of publisher contracts
- DRM circumvention
- OCR or scanning as a workaround for restricted scripts
- A universal publisher integration
- Storing publisher contracts as ordinary application text
- Replacing official publisher readers or per-user digital-script systems
- A big-bang event-sourcing rewrite
- Adding this workflow to the STP-first pilot

---

## Open questions

1. **Rights metadata location**  
   **Recommendation:** Keep the operational mode on `productions` and put
   provenance/permission fields in a one-to-one `production_script_rights`
   table. This keeps enforcement simple without turning `productions` into a
   contract record.

2. **Who may confirm rights?**  
   **Recommendation:** Start with Admin or a future production-rights manager;
   Directors should not be assumed to have authority merely because they edit
   prep data.

3. **How much preparation data may survive script deletion?**  
   **Recommendation:** Preserve non-script production data by default, with an
   explicit redaction preview and organization-controlled retention policy.

4. **What is a useful source locator?**  
   **Recommendation:** Start with neutral fields that can represent page,
   scene, cue, or beat references; do not build around one publisher's format.

5. **Should licensed script text ever be retained indefinitely?**  
   **Recommendation:** No default. Require an explicit retention decision and
   enforce `retention_until` when a real lifecycle job exists.

6. **Should reference-only actors get the same access as directors?**  
   **Recommendation:** Keep the current role model as the baseline, then add
   production/domain permissions only when an actual organization needs a
   narrower audience.

---

## Definition of done for the future release

- A production records its script mode and rights/provenance metadata.
- Existing STP full-script productions continue to work without extra setup.
- A reference-only production can be created without a script upload.
- Directors can manually create a useful Act → Scene → Moment Timeline.
- Cues, blocking, movement, assets, rehearsals, notes, and reports work without
  script text where they logically can.
- Line-based features are clearly disabled or adapted.
- Script text cannot escape through search, reports, exports, archives, or
  overlooked API routes.
- Script retention and redaction behavior is documented and testable.
- The workflow has been checked against actual external license terms.

---

## Decision log

| Date | Decision |
| ---- | -------- |
| 2026-08-28 | Capture rights/licensing and reference-only operation as a far-future v2+ plan. |
| 2026-08-28 | Keep the STP-first pilot on the current full-script workflow; assume STP has the rights needed for that pilot. |
| 2026-08-28 | Prefer a production-level operational mode plus a separate one-to-one rights metadata record. |
| 2026-08-28 | Reuse the existing Act → Scene → Moment and moment-attached preparation model for script-less productions. |

