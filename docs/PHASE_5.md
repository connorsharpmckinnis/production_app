# Phase 5 — MVP Completion & Demo Readiness

**Status:** Complete (2026-07-10)

**Goal:** Finish the remaining core production-preparation workflows — structured entrances, exits, and blocking, plus a minimal production overview and extended reports.

Phase 4 delivered a trustworthy, editable timeline with props, cues, costumes, microphones, set pieces, and minimal reports. **Phases 1–4 already satisfy most of the [MVP success criteria](PROJECT.md#success-criteria-mvp).** Phase 5 closes the largest functional gap: **structured entrances, exits, and blocking** — steps 9–10 of the [production preparation workflow](PROJECT.md#production-preparation-workflow).

This phase is **not** about UX polish. Filter polish, live search, bookmarks redesign, and similar items stay on the wish list.

---



## Owner Decisions (to confirm before implementation)


| Topic                             | Proposed default                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Phase 5 theme**                 | Complete prep workflow + demo-ready package — not advanced production management                      |
| **Entrances / exits model**       | Moment-attached records (mirror props pattern) — **not** the full event engine                        |
| **Blocking model**                | Moment-attached records per character with free-text blocking notes — no coordinate system            |
| **On-stage state**                | Derive "who is on stage" within a scene from entrance/exit sequence — read-only indicator, not stored |
| **Production overview**           | Minimal stats landing page when opening a production — **not** a preparation-progress dashboard       |
| **Tasks & performances**          | Out of scope unless a concrete demo need emerges mid-phase                                            |
| **Re-import / production status** | Deferred post-MVP — structural editing + manual correction is sufficient for demo                     |
| **UX polish**                     | Explicitly out of scope — functional UI only                                                          |


---



## Where We Are (post–Phase 4)



### Shipped and demo-ready today


| Area                                           | Status |
| ---------------------------------------------- | ------ |
| Script import + timeline viewer                | Done   |
| Import review editing + structural fixes       | Done   |
| Casting, groups, actor-filtered timeline       | Done   |
| Search, cue-only mode, notes, bookmarks        | Done   |
| Songs, props, cues, costumes, mics, set pieces | Done   |
| Minimal reports (prop, cue, costume sheets)    | Done   |
| Admin user management + app settings           | Done   |
| Role enforcement (Admin / Director / Actor)    | Done   |




### Gaps blocking a complete prep story


| Item                 | Notes                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| Entrances and exits  | Deferred since Phase 3 — still prose in stage directions only           |
| Blocking             | Not implemented — core differentiator vs. a script reader               |
| Production overview  | Opening a production jumps straight to timeline; no at-a-glance context |
| Full-show validation | Demo relies on `endurance-scene1.md` (single scene)                     |
| Demo walkthrough     | No documented path for staff/director presentation                      |




### Explicitly not Phase 5 (per owner)


| Item                                                    | Target                      |
| ------------------------------------------------------- | --------------------------- |
| Live search, multi-select filters, filter badges polish | Wish list                   |
| Bookmarks dedicated timeline view                       | Wish list                   |
| Split / merge moments                                   | Wish list                   |
| Rehearsals, attendance, archives                        | Post-MVP                    |
| Full event-derived state engine                         | Post-MVP                    |
| Re-import, production `status` / `published`            | Post-MVP                    |
| Tasks, performances                                     | Post-MVP (unless pulled in) |
| Preparation progress dashboard                          | Post-MVP                    |
| PDF export, print CSS, rich analytics                   | Post-MVP                    |
| AI assistance                                           | Post-MVP                    |


---



## Read First (authoritative)


| Document                                                          | Use for                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| [PROJECT.md](PROJECT.md)                                          | Vision, prep workflow, MVP success criteria               |
| [DATABASE.md](DATABASE.md)                                        | Schema conventions; future event model (do not build yet) |
| [ROLES.md](ROLES.md)                                              | Permission matrix                                         |
| [UI_STANDARDS.md](UI_STANDARDS.md)                                | Timeline + panel patterns                                 |
| [PHASE_4.md](PHASE_4.md)                                          | What already ships                                        |
| [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md)                              | Entrances/exits stay prose at import                      |
| [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) | Code style, Docker, uv                                    |


**Test fixture:** Continue using [fixtures/scripts/endurance-scene1.md](../fixtures/scripts/endurance-scene1.md) for regression. Add a multi-scene or full-act fixture for Phase 5 validation.

---



## Phase 5 Theme

Phase 4 made the timeline **trustworthy**. Phase 5 makes the product **complete enough to demo**:

1. Directors can record **who enters and exits** at specific moments — not just prose stage directions.
2. Directors can attach **blocking notes** to moments for specific characters.
3. The app can **derive on-stage presence** within a scene from entrance/exit data.
4. Opening a production gives **context** before diving into the timeline.
5. A **demo walkthrough** lets staff and directors evaluate the vision without the implementer present.

---



## In Scope



### P0 (must-ship) — Entrances, exits, and blocking

**Data model (direct storage on moments — not the future event engine):**

- `moment_entrances` — `moment_id`, `character_id`, optional `notes`
- `moment_exits` — same shape (separate tables keep queries and permissions simple)
- `moment_blocking` — `moment_id`, `character_id`, `notes` (blocking description / position in prose)

**API:**

- CRUD attach/detach on moments (mirror props/microphones pattern)
- Extend `MomentSummary` with `has_entrance`, `has_exit`, `has_blocking` flags
- Timeline filters: `entrance_only`, `exit_only`, `blocking_only` (boolean flags, same pattern as `costume_only`)
- Actor read-only; Director/Admin write

**UI:**

- Moment detail sections for entrances, exits, and blocking (progressive disclosure — mirror props)
- Optional: show derived on-stage character list in moment detail (within current scene)
- No separate catalog pages — these attach directly to moments (unlike props)

**Tests:**

- Permission tests, attach/detach, filter behavior, on-stage derivation edge cases



### P1 (should-ship) — Production overview

**Production overview (minimal — not a progress dashboard):**

- New route: `/productions/:id` (overview) — production list "Open" lands here instead of timeline
- Display: title, author, import date, counts (acts, scenes, moments, characters, cast assignments)
- Quick links: Timeline, Characters, Reports
- No checklist percentages or "ready for rehearsal" scoring

**Reports (extend Phase 4 minimal pattern):**

- Entrance/exit sheet — timeline-ordered, grouped by scene
- Blocking sheet — timeline-ordered, filterable by character



### P2 (can slip)

- On-stage indicator badges on timeline list rows (functional, not styled)
- Character filter highlights moments where selected character has blocking attached
- Group-level entrance/exit (attach a group instead of individual characters)
- Second demo production pre-seeded in dev (optional env flag)

---



## Out of Scope (defer)


| Item                                                          | Rationale                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Full event engine migration                                   | Post-MVP architecture; MVP uses direct moment attachments               |
| Blocking coordinate system / stage map                        | Over-engineering for community theater MVP                              |
| Tasks, performances, rehearsals, attendance                   | Production management — next product phase after MVP feedback           |
| Re-import                                                     | High risk to sacred `original_text` model; structural editing is enough |
| Production status / publish workflow                          | Needs product decision after staff feedback                             |
| UX polish (live search, multi-select filters, bookmarks view) | Owner: not part of Phase 5                                              |
| Preparation progress dashboard                                | [PROJECT.md](PROJECT.md) marks this post-MVP                            |
| PDF / print export                                            | Post-MVP                                                                |


---



## Work Package Priority


| Tier   | Packages        | Rationale                                  |
| ------ | --------------- | ------------------------------------------ |
| **P0** | WP1 → WP2 → WP3 | Schema + API before UI; core prep workflow |
| **P1** | WP4, WP5 → WP6  | Overview and reports prove completeness    |
| **P2** | WP7             | Timeline enhancements and extras           |


**Hard dependencies:**

- WP1 before WP2 (API before UI)
- WP1/WP2 before WP5 (reports need entrance/exit/blocking data)
- WP4 can run in parallel with WP1 once route structure is agreed

---



## Work Packages



### WP1 — Entrances, Exits & Blocking API (P0)

**Objective:** Structured prep data on moments without building the future event engine.

**Tasks:**

- [x] Alembic migration: `moment_entrances`, `moment_exits`, `moment_blocking`
- [x] SQLAlchemy models + relationships on `Moment`
- [x] Routes (mirror moment-props pattern):
  - `GET/POST/DELETE .../moments/{moment_id}/entrances`
  - `GET/POST/DELETE .../moments/{moment_id}/exits`
  - `GET/POST/PATCH/DELETE .../moments/{moment_id}/blocking`
- [x] Validate character belongs to same production as moment
- [x] Extend `MomentSummary` with `has_entrance`, `has_exit`, `has_blocking`
- [x] Timeline filters: `entrance_only`, `exit_only`, `blocking_only`
- [x] On-stage derivation service: given scene + sequence, compute character set from entrances/exits up to each moment
- [x] Expose derived on-stage list on moment detail response
- [x] Document new tables in [DATABASE.md](DATABASE.md)
- [x] Tests: CRUD, permissions, filters, derivation (enter → on stage → exit → off stage)

**Done when:** Director attaches CREAN entrance and exit to two moments; blocking note on a third; API returns correct on-stage set between them.

---



### WP2 — Entrances, Exits & Blocking UI (P0)

**Objective:** Directors manage stage movement and blocking from the moment detail panel without leaving the timeline.

**Tasks:**

- [x] Moment detail sections: Entrances, Exits, Blocking (mirror props/microphones UX)
- [x] Character picker scoped to production
- [x] Add/remove rows without closing detail panel (reuse Phase 4 pattern)
- [x] Show derived on-stage characters in moment detail (read-only list)
- [x] Timeline filter controls for entrance/exit/blocking modes
- [x] List row refresh after attach/detach without selection reset

**Done when:** Director completes entrance/exit/blocking workflow entirely from browser on `endurance-scene1.md` production.

---



### WP3 — Phase 5 Tests & Hardening (P0 — runs throughout)

**Tasks:**

- [x] `backend/tests/test_phase5.py`
- [x] Extend `backend/scripts/smoke_test.py`
- [x] On-stage derivation edge-case tests (double entrance, exit without entrance, scene boundary reset)
- [x] Actor forbidden on entrance/exit/blocking mutations

---



### WP4 — Production Overview Page (P1)

**Objective:** Give staff and directors context when opening a production — functional, not polished.

**Tasks:**

- [x] `GET /api/productions/{id}/overview` — aggregated counts + metadata
- [x] `ProductionOverviewPage.tsx` at `/productions/:id`
- [x] Change production list "Open" target from timeline to overview
- [x] Overview shows: title, author, created/import dates, act/scene/moment/character counts, cast coverage (N of M characters cast)
- [x] Quick-link cards to Timeline, Characters, Casting, Reports
- [x] Timeline nav item still available from sidebar

**Done when:** Director opens production → sees overview with accurate counts → clicks through to timeline.

**Not required:** progress bars, milestone checklists, editable fields on overview.

---



### WP5 — Extended Minimal Reports (P1)

**Tasks:**

- [x] Entrance/exit sheet on Reports page — scenes as sections, timeline order within each
- [x] Blocking sheet — timeline order, character name column
- [x] Backend aggregation endpoints (mirror Phase 4 report pattern)

**Done when:** Director generates entrance/exit and blocking sheets from live production data.

---



### WP7 — Timeline Enhancements (P2)

**Tasks:**

- [ ] On-stage badge chips on timeline list rows (Director/Admin; optional toggle)
- [ ] Timeline filter: show moments where selected character has blocking
- [ ] *(Optional)* Group-attached entrance/exit if ensemble tracking is needed for demo

---



## Phase 5 Exit Criteria



### P0 (required for MVP demo)

- [x] Director can attach entrances, exits, and blocking notes to moments
- [x] Moment detail shows derived on-stage characters within the scene
- [x] Timeline filters work for entrance, exit, and blocking modes
- [x] Actors can view (not edit) entrance/exit/blocking data
- [x] Phase 5 tests pass; smoke test covers new paths



### P1 (should-ship for staff/director demo)

- [x] Production overview page shows accurate counts and navigation
- [x] Entrance/exit and blocking reports render from live data
- [ ] DEMO_WALKTHROUGH.md exists and matches the running app



### P2 (nice-to-have)

- [ ] On-stage badges on timeline list rows
- [ ] Blocking filter by selected character

---



## Technical Decisions (pre-made — do not re-litigate)


| Topic               | Decision                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Event engine        | **Do not build.** Use moment junction tables like props. Future migration path documented in DATABASE.md. |
| Import behavior     | Entrances/exits in script file remain prose stage directions. Structured tracking is layered in-app only. |
| Entrance vs exit    | Separate tables (not a single `type` enum table) — simpler queries and report grouping.                   |
| Blocking            | Free-text `notes` per character per moment — no coordinates, zones, or stage map.                         |
| On-stage derivation | Computed per scene from entrance/exit sequence; resets at scene boundary; not persisted.                  |
| Catalog pages       | None for entrances/exits/blocking — moment-attached only.                                                 |
| Edit permissions    | Admin + Director write; Actor read                                                                        |
| Overview scope      | Counts + links only — no preparation progress scoring                                                     |
| UX standard         | Functional shadcn/ui components; no polish pass                                                           |


---



## API Contract Sketches



### Entrances / exits (mirror props)

```http
POST /api/productions/{id}/moments/{moment_id}/entrances
{ "character_id": 3, "notes": "from SR wing" }

POST /api/productions/{id}/moments/{moment_id}/exits
{ "character_id": 3, "notes": "into trap" }

DELETE /api/productions/{id}/moments/{moment_id}/entrances/{attachment_id}
DELETE /api/productions/{id}/moments/{moment_id}/exits/{attachment_id}
```



### Blocking

```http
POST /api/productions/{id}/moments/{moment_id}/blocking
{ "character_id": 3, "notes": "Cross DSL to chair US of table" }

PATCH /api/productions/{id}/moments/{moment_id}/blocking/{blocking_id}
{ "notes": "Updated position" }
```



### Moment detail (extended)

```http
GET /api/productions/{id}/moments/{moment_id}
→ {
  "...existing fields...",
  "entrances": [...],
  "exits": [...],
  "blocking": [...],
  "on_stage_characters": [{ "id": 3, "name": "CREAN" }]
}
```



### Production overview

```http
GET /api/productions/{id}/overview
→ {
  "title": "...",
  "author": "...",
  "imported_at": "...",
  "act_count": 2,
  "scene_count": 12,
  "moment_count": 847,
  "character_count": 24,
  "cast_count": 18
}
```



### Timeline filters (new query params)

```http
GET /api/productions/{id}/timeline?entrance_only=true
GET /api/productions/{id}/timeline?exit_only=true
GET /api/productions/{id}/timeline?blocking_only=true
```

---



## Demo Narrative (for staff/directors)

Use this arc when presenting — maps to DEMO_WALKTHROUGH.md:

1. **"The script is sacred"** — import markdown, show original text preserved, director corrects parse errors without destroying source.
2. **"One living production"** — timeline is the center; everything attaches to moments.
3. **"Prep, not just reading"** — cast actors, mark entrances/exits, add blocking, attach props and cues.
4. **"Role-appropriate views"** — actor sees highlighted lines and cue-only mode; director sees full prep toolkit.
5. **"Reports from the timeline"** — prop, cue, entrance/exit, and blocking sheets generated automatically.
6. **"What's next"** — rehearsals, tasks, attendance, re-import, and polish are intentionally deferred pending your feedback.

---



## Manual Smoke Test Script



### P0 path

1. Director → open moment → add entrance for a character → add exit at later moment.
2. Confirm on-stage list updates between those moments.
3. Add blocking note on a dialogue moment.
4. Toggle entrance_only / blocking_only filters.



### P1 path

1. Open production → lands on overview with correct counts.
2. Reports → entrance/exit sheet and blocking sheet render.
3. Log in as Actor → see entrance/blocking data read-only on moment detail.



### Demo path

1. Follow [DEMO_WALKTHROUGH.md](DEMO_WALKTHROUGH.md) end-to-end on clean `docker compose up`.

---



## Suggested Agent Execution Order

```
WP1 Entrances/exits/blocking API
  → WP2 UI
  → WP3 Tests (throughout)
WP4 Production overview (parallel after WP1 schema settled)
WP5 Reports (after WP1)
WP6 Demo package (after WP2 + WP4 + WP5)
WP7 Timeline enhancements (anytime; can slip)
```

---



## Local Dev Quick Start

Unchanged from prior phases:

```bash
docker compose up --build
```


| URL                                                          | Purpose        |
| ------------------------------------------------------------ | -------------- |
| [http://localhost:5173](http://localhost:5173)               | Frontend       |
| [http://localhost:8000/health](http://localhost:8000/health) | Backend health |
| `admin` / `admin`                                            | Admin          |
| `director` / `director`                                      | Director       |
| `actor` / `actor`                                            | Actor          |


```bash
cd backend && uv sync && uv run pytest
cd backend && uv run python scripts/smoke_test.py
```

---



## Notes for Implementing Agent

- Do **not** introduce the full event engine or refactor props/cues into events.
- Do **not** spend time on UX polish — ship functional UI and move on.
- On-stage derivation must reset at scene boundaries (characters do not carry over between scenes unless re-entered).
- Keep filter logic in the backend; frontend sends query params.
- When uncertain, choose the simpler implementation and document the tradeoff here.
- Update this document's checkboxes as work completes.

---



## Decisions Log


| Date       | Decision                                                                 |
| ---------- | ------------------------------------------------------------------------ |
| 2026-07-10 | Phase 5 reframed: MVP completion + demo readiness, not advanced features |
| 2026-07-10 | Entrances/exits/blocking use moment junction tables, not event engine    |
| 2026-07-10 | Production overview = counts + links; no progress dashboard              |
| 2026-07-10 | UX polish explicitly out of scope for Phase 5                            |
| 2026-07-10 | Rehearsals, tasks, performances, re-import deferred post-MVP             |


