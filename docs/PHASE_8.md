# Phase 8 — Prep Readiness Dashboard & Catalog CSV Import

**Status:** Implementation complete (2026-07-16) — full-show / multi-scene manual validation pending until the owner fixture is available

**Goal:** Make a full production feel *manageable* once a whole show is in-system: a richer production Overview that surfaces prep readiness (not just raw counts), configurable friendly / ministry-flavored status messages, and CSV import for production catalogs so directors can bulk-load assets instead of hand-entering them for every test or pilot.

Phase 7 hardened script import (MD + DOCX). Phase 8 supports the **full-show validation** effort running in parallel: owner cleans a complete script for import; this phase makes prep tooling scale with that show.

This phase is **not** the event engine, org-wide inventory, or explicit “reviewed / intentionally blank” progress table from [PROJECT.md](PROJECT.md#production-readiness-post-mvp). It is a practical v1 that answers: “How ready is this show?”, “What word or announcement should greet the cast today?”, and “How do I load STP’s existing digital catalogs?”

---



## Owner Decisions (confirmed 2026-07-16)


| Topic | Decision | Rationale |
| ----- | -------- | --------- |
| **Phase 8 theme** | Prep readiness Overview + configurable Overview messages + catalog CSV import + mic notes | Full-show validation + STP-shaped personality |
| **Readiness model** | **Heuristic coverage** derived from existing data — no new progress / review tables | Matches “derived over stored”; full milestone table stays post-MVP |
| **Costume readiness** | Per speaking character × scene: fraction that have a costume assigned **for that scene** | Combines “who’s in the scene” with “has a costume in this scene” |
| **Cue readiness** | Soft scene coverage (scenes with ≥1 cue) + catalog seeded credit for cue categories | No character×cue assignment today; keep honest and simple |
| **“Characters in this scene”** | **Speaking characters** in the scene (same definition as scene summary / existing UI) | Already implemented; do not invent a new cast list for Phase 8 |
| **Encouragement / messages** | **Editable** message pools + rotation frequency — production-level primary, global defaults secondary | Scripture, announcements, and encouragement for a Christian theater company |
| **CSV asset types** | Props, microphones, set pieces, costumes, **songs**, **cue categories** | Better to have and not need; testing + STP catalog bridge |
| **CSV duplicate policy** | **Skip** existing keys; report skipped count. Upsert / configurable modes later | Safe for re-import while testing |
| **Costume CSV `scene`** | Match **scene title string** as shown in the UI (case-insensitive trim) | Easiest to implement; document exact string in template help |
| **CSV UI placement** | Import control on each catalog page + shared parser helpers | Discoverable where people already manage assets |
| **Microphone catalog** | Add optional **`notes`** (Text) | Parity; moment attachment notes stay separate |
| **Actor Overview** | **Lightweight actor variant** — messages + actor-relevant summary + placeholder slots; not the full director readiness grid | Useful without bloating Phase 8 |
| **Event engine** | Explicitly **out of scope** | Do not treat attachments as continuous state |
| **Org-level shared inventory** | Out of scope — CSV is **v1 bridge** | In-app org catalog remains future ([SCRATCH_NOTES.md](SCRATCH_NOTES.md)) |


---



## Where We Are (post–Phase 7)



### Shipped and reliable


| Area | Status |
| ---- | ------ |
| Script import (`.md` / `.docx`) + Timeline | Done |
| Casting, groups, catalogs, moment attachments | Done |
| Entrances, exits, blocking + on-stage derivation | Done |
| Reports (props, cues, costumes, entrances/exits, blocking) | Done |
| Overview: counts + casting fraction + basic CTAs | Done (Phase 5 — intentionally minimal) |
| Global Settings (`show_original_text`, `show_parsed_text`) | Done — singleton; **no** production-level settings yet |
| Rehearse presets + timeline polish | Done (Phase 6) |



### Gaps this phase addresses


| Item | Notes |
| ---- | ----- |
| Overview is counts-only | No readiness %, gaps, or prep-category progress |
| Hard-coded / absent status personality | Need editable scripture, announcements, encouragement |
| No production-level settings surface | Global Settings only today |
| Manual catalog entry for every test production | Blocks full-show validation and STP catalog reuse |
| Microphones lack catalog `notes` | Catalog gap vs other assets |
| Actor landing page is director-shaped | Actors need a simpler, personal home |



### Explicitly not Phase 8


| Item | Target |
| ---- | ------ |
| Event engine / prop transfer / costume change events | Post-MVP |
| Explicit “import reviewed / intentionally blank” progress table | [PROJECT.md](PROJECT.md#production-readiness-post-mvp) |
| Org-wide shared inventory with storage location / condition | Future (CSV is the bridge) |
| CSV upsert / configurable duplicate modes | Future (skip-only in Phase 8) |
| Mic-change chart / per-character prep packs | Follow-on |
| Full actor personalization (call times, mic pack, etc.) | Placeholder slots only in Phase 8 |
| Deployment / security hardening | Separate phase |
| Re-import script / replace timeline | Post-MVP |
| Bookmarks redesign, live search, filter sheet | Wish list |
| Character burn-down / set-change / break-time charts | Wish list ([SCRATCH_NOTES.md](SCRATCH_NOTES.md)) |


---



## Read First


| Document | Why |
| -------- | --- |
| [PROJECT.md](PROJECT.md) — Progressive Enrichment, Preparation Workflow, Production Readiness | Product intent for “ready for rehearsal” |
| [DATABASE.md](DATABASE.md) — catalogs including songs, cue categories, costumes | Catalog fields and naming |
| [ROLES.md](ROLES.md) | Who can edit catalogs / settings / Overview |
| [PHASE_5.md](PHASE_5.md) — WP4 Overview | What the minimal dashboard deliberately deferred |
| [SCRATCH_NOTES.md](SCRATCH_NOTES.md) — standard theater assets / CSV | Inventory CSV product note |
| [UX_UI_IMPROVEMENTS.md](UX_UI_IMPROVEMENTS.md) | Richer production home / readiness dashboard wish |
| [PREP_READINESS.md](PREP_READINESS.md) | Implemented formulas, gap semantics, role visibility, and Overview message behavior |
| [CATALOG_CSV.md](CATALOG_CSV.md) | Implemented CSV formats, duplicate handling, and costume resolution |


---



## Phase Theme

**“How ready is this show — what should greet the company — and can I load the shop’s catalogs without typing?”**

Three vertical slices:

1. **Prep readiness Overview** — progress across prep dimensions and gap CTAs (director/admin).
2. **Configurable Overview messages** — encouragement bands, scripture, announcements; editable content + rotation frequency.
3. **Catalog CSV import** — bulk-create production assets (including songs and cue categories).

Plus: **microphone catalog notes**, and a **lightweight Actor Overview**.

---



## Readiness Scoring (confirmed)

Compute on the backend in `GET /api/productions/{id}/overview` (extend the existing response). Do **not** store scores.

### Dimensions

Each applicable dimension contributes equally to **overall readiness** (simple average of dimension scores, 0–100). Dimensions with no applicable denominator are **N/A** and excluded from the average.


| Dimension | Score (0–100) | Gap list (examples) |
| --------- | ------------- | ------------------- |
| **Casting** | `(cast characters / castable characters) * 100` | Uncast character names → Characters |
| **Costumes** | See [Costume coverage](#costume-coverage-confirmed) | Speaking characters in a scene missing a costume for that scene → Costumes |
| **Cues** | Soft: cue-category catalog seeded (partial) + `(scenes with ≥1 cue) / scene_count` (use portion) | Scenes with zero cues; empty cue categories → Cue categories / Timeline |
| **Props** | Soft catalog seeded + timeline-use (scenes with ≥1 prop attachment) | Empty catalog or unused catalog → Props / Prop report |
| **Microphones** | Soft catalog seeded + timeline-use | Empty mic list |
| **Set pieces** | Soft catalog seeded + timeline-use | Empty set list |
| **Entrances / exits** | `(scenes with ≥1 entrance AND ≥1 exit) / scene_count * 100` | Scenes missing entrances or exits |
| **Blocking** | `(scenes with ≥1 blocking note) / scene_count * 100` | Scenes with no blocking |


**Soft catalog dimensions (props / mics / set pieces / cue categories+cues):**

Reward both:

1. **Catalog seeded** — at least one catalog row (partial credit, e.g. ~40%).
2. **Timeline use** — share of scenes with ≥1 attachment / cue of that type.

Document the exact weights in `readiness.py` comments and Overview help text. Prefer honest and tunable over clever.

**Builtin characters:** Exclude `ALL` / `ENSEMBLE` (and any other builtins) from casting and costume denominators.

**Script presence:** If `act_count == 0`, overall readiness is 0; primary CTA remains Import Script. Do not show fake progress.

### Costume coverage (confirmed)

For each scene, take the set of **speaking characters** in that scene (same definition as the Timeline scene summary / “Characters in this scene”).

```text
numerator   = count of (character, scene) pairs where
              character speaks in scene
              AND a costume exists with that character_id + scene_id
denominator = count of (character, scene) pairs where
              character speaks in scene
              (builtins excluded)

costume_score = 0 if denominator == 0 else round(100 * numerator / denominator)
```

Gap examples: “CREAN in Act 1 / Scene 2 — no costume”.

This is **not** “characters with any costume somewhere” and **not** “scenes that have at least one costume row.”

### Gap → action links

Each dimension card (director/admin):

- Score or “—” if N/A
- One-line summary (“4 of 18 speaking roles missing a scene costume”)
- Primary link into the right place

Prefer existing routes; filtered deep-links only if cheap.

---



## Overview Messages (confirmed)

STP is a Christian theater company. The Overview should be able to surface **encouragement**, **scripture**, and **announcement-level** info — not only auto-generated progress vibes.

Today there is only global `app_settings` (display flags). Phase 8 adds **editable message content** and **rotation frequency**.

### Scope split


| Layer | What it stores | Who edits | Purpose |
| ----- | -------------- | --------- | ------- |
| **Global defaults** | Default encouragement snippets per readiness band + default rotation seconds | Admin on **Settings** (`/settings`) | Fallback when a production has no custom messages; seed for new shows |
| **Production messages** | Show-specific scripture, announcements, encouragement overrides | Admin / Director on a **Production settings** section (new; on Overview or a small Production Settings page) | The live content cast and staff see for *this* show |


Production messages **win** when present for a given slot; otherwise fall back to global defaults for encouragement bands. Announcements and scripture are production-scoped (no global announcement spam across shows).

### Message kinds


| Kind | Tied to readiness band? | Examples |
| ---- | ----------------------- | -------- |
| `encouragement` | **Yes** — each item belongs to a band (`0`, `1-24`, `25-49`, …, `100`) | “You got it — almost at the finish line!” |
| `scripture` | No — rotates among active scripture items | Short verse reference + text relevant to the show |
| `announcement` | No — rotates among active announcements | “Book table after Sunday’s performance.” |


Keep body text plain (no rich HTML in v1). Optional short `citation` / `title` field for scripture (e.g. `Philippians 4:13`).

### Rotation (feasible — include in Phase 8)

- Store **`rotation_seconds`** (integer, sensible min/max, e.g. 5–300; default ~20–30).
- Overview client cycles visible message(s) on that interval among the active pool for the current context.
- If only one item in a pool, no flicker — just show it.
- If rotation_seconds is `0` or null meaning “off”, show the first item only (no switching).
- Prefer a single rotating “spotlight” region that can show encouragement **or** scripture **or** announcement (weighted or sequential through a combined queue). Simpler v1: **one spotlight** that walks a merged ordered list (announcements first, then scripture, then band-matched encouragement), switching every `rotation_seconds`.

Deterministic initial index (e.g. from production id + day) is fine so every reload doesn’t feel random; then advance on the timer.

### Data shape (proposed)

Prefer a small table over stuffing giant JSON into `productions` if multiple rows are edited in UI:

```text
production_overview_messages
  id, production_id, kind, band (nullable), title (nullable),
  body, sort_order, active, created_at, updated_at

production_settings (or columns on productions)
  production_id, message_rotation_seconds, ...
```

Global defaults:

```text
app_settings (extend singleton) OR app_overview_message_defaults
  — default encouragement rows per band
  — default_rotation_seconds
```

Exact table vs JSON is an implementation choice; **editable in UI** and **migratable** matter more than clever storage. Prefer normalized rows if the Settings UI is a list editor.

### UI

- **Admin Settings:** edit global default encouragement bands + default rotation; short help text that productions can override.
- **Production:** “Overview messages” editor — list/add/edit/disable scripture, announcements, encouragement per band; set rotation seconds; preview on Overview.
- Overview **spotlight** region shows the active message; directors still see readiness below.

### Default seed copy

Ship sensible built-in encouragement defaults (the vibe table below) so empty installs still feel alive before anyone edits settings.


| Overall % | Band key | Example default vibes |
| --------- | -------- | --------------------- |
| 0 | `0` | “Blank stage — import a script and let’s get rolling.” |
| 1–24 | `1-24` | “Good start — the bones are there.” |
| 25–49 | `25-49` | “You’re building something real. Keep layering prep.” |
| 50–74 | `50-74` | “Solid progress — the show is taking shape.” |
| 75–89 | `75-89` | “You got it — almost at the finish line!” |
| 90–99 | `90-99` | “So close — knock out the last gaps.” |
| 100 | `100` | “Prep looks complete. Time to rehearse.” |


Rules for tone (defaults and guidance in the editor help):

- Friendly; theater- and ministry-appropriate.
- No shame language for low scores.
- Scripture entries should be attributed; keep bodies short enough for a spotlight card.

---



## Actor Overview (lightweight)

Actors get a **different** Overview composition — not a stripped director dashboard.

**Include in Phase 8:**

1. Production header (title, season).
2. **Message spotlight** (same production messages / rotation — scripture and announcements matter for cast).
3. **Your roles** — characters they are cast as (links to Timeline / Rehearse filters if easy).
4. **Rehearse** primary CTA.
5. **Placeholder widgets** (empty / “Coming soon” style, not fake data) for future actor-specific items, e.g. “Your mic”, “Notes for you”, “Call sheet” — one compact row so the layout anticipates growth without building those features yet.

**Omit for Actors in Phase 8:**

- Full readiness dimension grid and prep gap lists (director/admin only).
- Catalog import CTAs and production message *editing* (unless we later allow directors only).

Optional tiny personalization: if they have uncast… N/A; if cast, a one-liner like “You’re on as CREAN” near the spotlight. Keep implementation cheap.

---



## Catalog CSV Import (confirmed)



### Shared behavior

- **Roles:** Admin and Director (same as catalog create).
- **Format:** UTF-8 CSV; header row required; unknown columns ignored (warn in result).
- **Response:** `{ created: int, skipped: int, errors: [{ row: int, message: str }] }` — partial success; per-row errors.
- **Duplicates:** **Skip** if key exists (case-insensitive trim). No update/upsert in Phase 8; may become configurable later.
- **Max size:** Reasonable limit (e.g. 1 MB); reject clearly.
- **Templates:** “Download CSV template” on each catalog page.
- **No moment attachments** via CSV — catalogs only.

### Column maps


| Asset | Required columns | Optional columns | Duplicate key (skip if exists) |
| ----- | ---------------- | ---------------- | ------------------------------ |
| **Props** | `name` | `description`, `notes` | `name` |
| **Microphones** | `identifier` | `notes` | `identifier` |
| **Set pieces** | `name` | `mobile` (`true`/`false`/`1`/`0`), `description` | `name` |
| **Costumes** | `name`, `character`, `scene` | `description` | (`name`, `character`, `scene`) |
| **Songs** | `title` | `composer`, `lyricist`, `description` | `title` |
| **Cue categories** | `name` | `description` | `name` |

**Costume resolution:**

- `character` = character name in this production (trim, case-insensitive).
- `scene` = **scene title string as shown in the UI** (trim, case-insensitive). If titles collide across acts, document that directors should disambiguate titles or we accept first match and warn — prefer documenting uniqueness; if cheap, also accept `Act {n} / {scene title}` as an alternate key.
- Unresolved character or scene → row error.

### API shape (proposed)

```text
POST /api/productions/{production_id}/props/import
POST /api/productions/{production_id}/microphones/import
POST /api/productions/{production_id}/set-pieces/import
POST /api/productions/{production_id}/costumes/import
POST /api/productions/{production_id}/songs/import
POST /api/productions/{production_id}/cue-categories/import
```

`multipart/form-data` field `file`. Shared helpers in `backend/app/services/catalog_csv.py`.

### UI

Import + template on: Props, Microphones, Set Pieces, Costumes, Songs, Cue Categories pages.

---



## Microphone Notes



### Schema

- Add nullable `notes` (`Text`) to `microphones`.
- Alembic migration; model, schemas, API, Microphones UI.
- Update [DATABASE.md](DATABASE.md).

Moment-level `moment_microphones.notes` unchanged (assignment ≠ catalog).

---



## Work Packages



### WP0 — Microphone catalog `notes` (do first; small)

**Objective:** Microphones can store optional catalog notes.

**Tasks**

- [x] Alembic migration: `microphones.notes` nullable Text
- [x] Model + schemas + API create/update/response
- [x] Frontend Microphones page: show/edit notes
- [x] Update [DATABASE.md](DATABASE.md)
- [x] Backend test: create/update mic with notes

**Done when:** Director can save notes on a mic catalog row and see them after reload.

---



### WP1 — Overview readiness API

**Objective:** Extend production overview with readiness scores and gap summaries.

**Tasks**

- [x] Extend `ProductionOverviewResponse` with readiness payload:

  - `readiness_percent: int | null`
  - `dimensions: [{ key, label, score, summary, href_hint, gaps? }]`
  - Extended counts as needed

- [x] Implement `backend/app/services/readiness.py` including **costume speaking-character × scene** coverage
- [x] Unit tests: empty production; partial cast; costume gaps; builtins excluded; scenes missing entrances

**Done when:** Overview JSON can drive director dimension cards without N+1 client queries.

---



### WP2 — Overview messages (global defaults + production editor + rotation)

**Objective:** Admins/directors can edit what the Overview spotlight shows, including scripture and announcements, and control rotation frequency.

**Tasks**

- [x] Schema: production message rows + production `message_rotation_seconds`; global default encouragement + default rotation (extend `app_settings` and/or small defaults table)
- [x] Seed default encouragement band copy on migrate / first boot
- [x] API: CRUD (or replace-list) for production messages; PATCH rotation; Admin API for global defaults
- [x] Admin **Settings** UI: default encouragement bands + default rotation seconds
- [x] **Production** messages UI: manage scripture / announcements / encouragement-by-band; set rotation; short help (“great place for show-specific verses”)
- [x] Overview spotlight: fetch messages, filter encouragement by current readiness band, rotate on interval
- [x] Tests for defaults fallback and production override

**Done when:** Admin can change global encouragement text; director can add a scripture and an announcement for a show; Overview cycles them on the configured interval; cast sees the same spotlight.

---



### WP3 — Prep readiness Overview UI (director/admin) + Actor variant

**Objective:** Production home answers readiness for staff; actors get a personal, lighter home with room to grow.

**Tasks**

- [x] Director/Admin `ProductionOverviewPage`:

  1. Header
  2. Message spotlight (WP2)
  3. Overall readiness %
  4. Dimension rows/cards + gap CTAs
  5. Quick links + reports (de-clutter as needed)
  6. Bottom padding if still missing

- [x] Actor variant: spotlight + your roles + Rehearse CTA + placeholder widgets; **no** full readiness grid; **no** import/edit-message controls
- [x] Responsive; one clear composition — avoid vanity card explosion

**Done when:** Director sees readiness + editable-driven messages; Actor sees messages, their roles, Rehearse, and honest placeholders.

---



### WP4 — Catalog CSV import (props, mics, set pieces, songs, cue categories)

**Objective:** Bulk-create the simple catalogs (no FK resolution beyond production scope).

**Dependency:** WP0 so mic CSV includes `notes`.

**Tasks**

- [x] Shared CSV helpers + validators
- [x] Import endpoints + tests (happy path, skip duplicate, row error) for props, mics, set pieces, songs, cue categories
- [x] Templates + UI on each page
- [x] Docs / [CATALOG_CSV.md](CATALOG_CSV.md) if help text grows
- [x] Fixture CSVs under `fixtures/catalogs/`

**Done when:** Director can import a mic CSV, prop CSV, song CSV, and cue-category CSV without single-row forms.

---



### WP5 — Costume CSV import

**Objective:** Bulk costumes with character + **UI scene title** string resolution.

**Tasks**

- [x] Costume import endpoint + resolution rules in template help
- [x] Tests: resolve success; unknown character/scene; duplicate skip; ambiguous title behavior documented
- [x] Costumes page Import CSV + template
- [x] Example fixture for scene-1 / full-show when available

**Done when:** Costume CSV creates rows for known speaking characters and scene titles; bad rows report clearly.

---



### WP6 — Docs + full-show validation notes (light)

**Objective:** Phase 8 usable during full-show import without tribal knowledge.

**Tasks**

- [x] Update [PROJECT.md](PROJECT.md) Phase 8 tracker when shipping
- [x] Document readiness formulas (especially costumes) and message settings in [PREP_READINESS.md](PREP_READINESS.md)
- [x] Fixtures README: loading catalog CSVs for a pilot; see [CATALOG_CSV.md](CATALOG_CSV.md)
- [ ] Manual validation checklist below

**Done when:** Someone else can import catalogs, edit Overview messages, and interpret readiness from docs alone.

---



## Exit Criteria

1. Microphone catalog supports optional notes (API + UI + migration).
2. Overview (director/admin) shows overall readiness %, dimension breakdown including **costume speaking×scene coverage**, gap CTAs.
3. Overview messages are editable (global defaults + production scripture/announcements/encouragement) with configurable rotation frequency; Overview spotlight rotates when multiple items exist.
4. Actor Overview is a distinct lightweight layout (messages, roles, Rehearse, placeholders).
5. Props, microphones, set pieces, songs, and cue categories bulk-import from CSV (skip duplicates).
6. Costumes bulk-import from CSV with character + scene-title resolution.
7. Backend tests cover readiness (including costumes), messages fallback, and CSV paths.
8. Docs updated (DATABASE.md, PROJECT.md, CSV + messages help).
9. Manual pass on a multi-scene production (full show when owner fixture is ready).

---



## Manual Validation

Reference checklist only; these rows have not been marked as performed. The full-show / multi-scene pass waits for the owner fixture.

| Step | Expected |
| ---- | -------- |
| Create production, no import | Readiness 0; default encouragement; Import CTA |
| Edit global encouragement band copy | New text appears on productions without overrides |
| Add production scripture + announcement; set rotation to 5s | Spotlight cycles among them on Overview |
| Import multi-scene script; assign some scene costumes | Costume dimension moves; gaps list missing speaking×scene pairs |
| CSV import mics, props, songs, cue categories | Rows created; second import skips duplicates |
| Costume CSV with UI scene title | Rows resolve; bad scene title → row error |
| Open Overview as Actor | Spotlight + roles + Rehearse + placeholders; no director gap grid / no message editor |


---



## Technical Decisions


| Decision | Choice |
| -------- | ------ |
| Scoring storage | Derived only — no progress table |
| Costume denominator | Speaking characters per scene (existing definition) |
| Message copy | Stored in DB; editable in Settings / Production — not hard-coded frontend-only |
| Rotation | Client-side interval from `message_rotation_seconds` |
| CSV parse library | Python stdlib `csv` |
| CSV duplicates | Skip only |
| Attachment CSV | No |
| Event / holder semantics | Do not add |


---



## Risks


| Risk | Mitigation |
| ---- | ---------- |
| Heuristic scores feel “wrong” | Document formulas; tune after full-show trial |
| Scene titles collide across acts | Document; optional `Act N / title` alternate if cheap |
| Message editor scope creep (rich text, scheduling, roles) | Plain text + active flag + sort order only in Phase 8 |
| Overview clutter | One spotlight + compact dimension list for staff; lighter Actor layout |
| CSV becomes pseudo event importer | Refuse moment/attachment columns |


---



## Execution Order

1. **WP0** — Mic notes  
2. **WP1** — Readiness API (incl. costume formula)  
3. **WP2** — Overview messages + rotation  
4. **WP3** — Overview UI (director + actor)  
5. **WP4** — Simple catalog CSVs (props, mics, sets, songs, cue categories)  
6. **WP5** — Costume CSV  
7. **WP6** — Docs + validation with owner’s full script when ready  

WP4 can parallelize with WP2/WP3 after WP0; WP5 needs characters/scenes from an imported script.

---



## Parallel Owner Work (not agent blockers)

- Clean full-show script for import (owner)
- Optional: export STP digital catalogs to match Phase 8 CSV headers
- Optional: gather show-specific scripture / announcement copy for the first production messages
- After ship: note which readiness heuristics feel unfair — Phase 8.1 tuning

---



## Decisions Log

| Date | Decision |
| ---- | -------- |
| 2026-07-16 | Phase 8 scoped to readiness Overview + catalog CSV + mic notes; event engine deferred |
| 2026-07-16 | Readiness uses heuristics, not the post-MVP progress table |
| 2026-07-16 | CSV is v1 bridge to STP external catalogs; org inventory stays future |
| 2026-07-16 | **Confirmed:** costume score = speaking characters in scene with costume for that scene |
| 2026-07-16 | **Confirmed:** CSV skip-on-duplicate; upsert later |
| 2026-07-16 | **Confirmed:** costume CSV scene = UI scene title string match |
| 2026-07-16 | **Confirmed:** songs + cue categories included in CSV import |
| 2026-07-16 | **Confirmed:** lightweight Actor Overview with placeholders |
| 2026-07-16 | **Confirmed:** editable Overview messages (encouragement / scripture / announcement) + rotation frequency; production-level primary, global defaults secondary |
| 2026-07-16 | **Implemented:** WP0–WP5 and WP6 documentation complete; full-show / multi-scene manual validation remains pending until the owner fixture is available |


---



## Implementing-Agent Notes

- Follow [.agents/skills/DEVELOPMENT_GUIDE/SKILL.md](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md).
- Prefer extending `GET .../overview` for readiness; messages may be included there or via a small sibling endpoint — avoid chatty APIs.
- Keep business logic in backend services; frontend presents and rotates.
- Do not build “who holds this prop now” from `moment_props`.
- Message editor: list CRUD is enough — no rich text, no audience targeting, no calendar scheduling in Phase 8.
- Ask the owner before changing the costume speaking×scene definition or CSV duplicate policy if a sharp edge appears.
- Match existing shadcn/ui patterns — simple beats flashy; consistency beats novelty.
