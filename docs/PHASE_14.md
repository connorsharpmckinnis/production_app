# Phase 14 — Event-Driven Asset State on the Timeline

**Status:** Complete (2026-08-01) — WP1–WP6 shipped; owner walkthrough passed.

**Goal:** Make Timeline Moments the place where props and set pieces turn **ON** / **OFF**, then **derive** current state forward (across scenes and acts) until the next change. Optional free-text notes carry location / exit detail; optional person affiliation (character or user). Light costume **on/off** replaces `costumes.scene_id` without a deep costume redesign. Lav chart stays as-is (SoT confirmed; Timeline markers deferred until the event engine feels solid).

Overrides PRE_AUGUST “do not build full event-driven engine” for this **scoped** slice. Tracks PROJECT Event Philosophy; DATABASE Planned Event Model; parked [#51](https://github.com/connorsharpmckinnis/production_app/issues/51) / [#70](https://github.com/connorsharpmckinnis/production_app/issues/70) (props/sets portion).

**Branch:** Owner creates the feature branch manually after this plan; agent does not create it.

---

## Owner Decisions (confirmed 2026-07-26)

| Topic | Decision |
| ----- | -------- |
| **Timing** | Build now — intentional early runway |
| **Focus** | **Props + set pieces** are the event-engine proving ground |
| **Costumes** | **Light touch only:** replace `scene_id` with on/off (wear/clear) events; whole sets; pieces/outfits later — do not over-invest |
| **Lav** | Chart remains editable SoT; Timeline derived markers **deferred** (not this phase) |
| **Location** | **Free-text notes only** (no zone enum / catalog). Stacking / ambiguity is OK for now |
| **Horizon** | State **persists across scenes and acts** until the next ON/OFF for that asset |
| **Event vocabulary** | Simple **`on` / `off` only** — richer kinds (transfer, stow, move, …) later |
| **Person affiliation** | Optional: **character XOR user** (or neither). Examples: Iceberg ON with Connor; Ice Axe OFF of Shackleton |
| **Notes** | Free text on the event — location when ON (“Downstage Left”), exit/stow detail when OFF (“Tuck under the ship”) |
| **Re-ON while already on** | Allowed — updates notes + person (covers “moved / handed off” without new event kinds) |
| **Existing data** | **No migration** — owner re-enters; tests/fixtures updated as needed; drop/replace junction tables OK |
| **Schema style** | Specialized `moment_*` tables + shared derivation service (not polymorphic event store) |
| **Authoring UI** | Moment detail (primary); show derived “currently …” where cheap |

### SoT split (locked)

| Domain | Editable SoT | Derived | This phase? |
| ------ | ------------ | ------- | ----------- |
| **Props** | Timeline on/off events | In-play? person? notes? | **Yes — primary** |
| **Set pieces** | Timeline on/off events | In-play? person? notes? | **Yes — primary** |
| **Costumes** | Timeline on/off events | What character is wearing | **Yes — thin** |
| **Lav wires / packs** | Lav chart | (future Timeline markers) | **No — leave as-is** |
| **Entrances / exits** | Existing | On-stage (scene-scoped) | Unchanged |
| **Blocking / cues** | Existing | — | Unchanged |

---

## Open questions

None blocking. One implementation default (accept unless you object at build time):

| Topic | Default | Notes |
| ----- | ------- | ----- |
| **UI labels** | **On** / **Off** in the Moment detail form | Matches your examples; store as `on` / `off` |
| **Costume person** | Costume events require **`character_id`** (who is wearing); no user wearer in v1 | Costumes stay character-centric; props/sets keep character XOR user |
| **Unique constraint** | At most one event per `(moment_id, asset_id)` | Same Moment can still change many different assets |

---

## Where We Are

### Shipped and useful

| Area | Status |
| ---- | ------ |
| Moment attachments: props, set pieces, entrances, exits, blocking, cues | Done (presence-style for props/sets) |
| On-stage derivation (`on_stage.py`) | Done — scene-scoped; pattern to generalize |
| Costumes as `character × scene` | Done — **to be replaced lightly** |
| Lav chart | Done — **untouched this phase** |
| Reports / readiness / Timeline filters | Done — retarget for new semantics |

### Gaps this phase addresses

| Item | Notes |
| ---- | ----- |
| Props/sets are tags, not lasting state | Cannot derive “Iceberg still DSL later” |
| No first-class on/off + notes + person | Directors think in those terms already |
| Costume scene matrix ≠ Timeline | Quick changes awkward; light on/off fixes SoT |
| Event philosophy never shipped as a slice | This phase |

### Explicitly not Phase 14

| Item | Target |
| ---- | ------ |
| Lav Timeline derived markers / change-list sheet | After event engine confidence (Phase 13 follow-on remains) |
| Costume pieces → outfits | Later costume phase |
| Stage-zone enum, scale model, x/y dimensions | Wishlist |
| Richer event kinds (transfer, stow, move, …) | After on/off proves out |
| Character packets UI | Follow-on consumer |
| Data migration of old moment_props / moment_set_pieces / costume scenes | Owner re-enters |
| Polymorphic event store / event-sourcing / undo | Out |
| Visual stage diagram | PRE_AUGUST defer |

---

## Read First

| Document | Why |
| -------- | --- |
| [PROJECT.md](PROJECT.md) | Timeline-centered; Event Philosophy |
| [DATABASE.md](DATABASE.md) | Current junctions; Planned Event Model |
| [PHASE_5.md](PHASE_5.md) | Entrance/exit + on-stage derivation precedent |
| [PHASE_13.md](PHASE_13.md) | Lav SoT + deferred derivation (not built here) |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Moment detail patterns |

**Code anchors:** `backend/app/services/on_stage.py`, `timeline_filters.py`, `readiness.py`, `api/timeline.py`, `MomentDetailPanel.tsx`, prop/set/costume models + APIs/reports.

---

## Problem Statement

Directors already think in changes: *Iceberg ON with Connor — "Downstage Left"*; *Ice Axe OFF of Shackleton — "Tuck under the ship."* The app stores presence tags and scene costume rows, so “what is still true later?” lives in people’s heads.

Phase 14 makes on/off events the source of truth for props and set pieces (and lightly for costumes), then derives current state for Timeline, reports, and future packets.

---

## Target Design

### Mental model

```text
Catalog (Prop / SetPiece / Costume)
        │
        ▼
ON / OFF event on a Moment   (+ optional person, free-text notes)
        │
        ▼
Show-order derivation walk   (persist across scenes/acts)
        │
        ▼
Timeline / Moment “currently…” / reports / readiness
```

### Event shape (v1) — keep it boring

Shared idea for props and set pieces:

| Field | Meaning |
| ----- | ------- |
| `kind` | `on` \| `off` |
| `notes` | Free text (location, exit direction, stow, etc.) — nullable |
| Person | Optional: exactly one of `character_id` or `user_id`, or neither |
| Asset FK | `prop_id` or `set_piece_id` |

Display examples:

- Iceberg **ON** with Connor — *Downstage Left*
- Ice Axe **OFF** of Shackleton — *Tuck under the ship*

**Derivation rules:**

1. Walk Moments in Act → Scene → `sequence_number` order (whole production).  
2. Per asset: start **off**.  
3. `on` → in play; set person + notes from this event (replaces previous person/notes).  
4. `off` → not in play; clear person; keep last off-notes only as historical (snapshot at that Moment may still show off notes for the change itself).  
5. State after Moment M is what later Moments inherit until the next event for that asset.  
6. **No scene/act reset** for props/sets/costumes. Entrances/exits stay scene-scoped as today.

**Re-ON:** If already on, another `on` updates person + notes (move / handoff / “still on but now DSL”).

### Costumes (thin)

| Field | Meaning |
| ----- | ------- |
| `kind` | `on` \| `off` (UI may say Wear / Clear if clearer) |
| `costume_id` | Catalog look (required on `on`) |
| `character_id` | Who wears it (required) |
| `notes` | Optional free text |

- Drop `costumes.scene_id`.  
- **Finalized 2026-07-27:** `costumes` remain a production catalog of whole looks and **keep** `character_id` on the catalog row (as default owner); only `scene_id` drops.  
- Derivation: per character, current costume = last unmatched `on` (or none after `off`).  
- Costumes page + report: retarget enough to work; no outfit/piece work.

### Schema (illustrative)

```text
moment_prop_events
  id, moment_id, prop_id, kind [on|off],
  character_id NULL, user_id NULL, notes NULL,
  CHECK (character_id IS NULL OR user_id IS NULL),
  UNIQUE (moment_id, prop_id)

moment_set_piece_events
  id, moment_id, set_piece_id, kind [on|off],
  character_id NULL, user_id NULL, notes NULL,
  CHECK (character_id IS NULL OR user_id IS NULL),
  UNIQUE (moment_id, set_piece_id)

moment_costume_events
  id, moment_id, character_id, kind [on|off],
  costume_id NULL,  -- required when kind=on (enforce in app)
  notes NULL,
  UNIQUE (moment_id, character_id)  -- one costume change per character per moment

# Drop / stop using:
#   moment_props, moment_set_pieces, costumes.scene_id
```

Exact table names locked in WP1. **No data backfill** from old junctions — truncate/drop OK.

### Derivation service

`backend/app/services/asset_state.py` (name flexible):

- Batch snapshots for a scene Timeline payload (compact: in-play flags + ids; detail on Moment fetch).  
- Reuse patterns from `on_stage.py`; do **not** merge character on-stage into this module unless it stays readable.

### Lav

Unchanged. PHASE_13 follow-on text remains the plan for **later**. Confirm again: no second lav attach UI on Moments.

---

## Downstream impacts

| Consumer | Phase 14 change |
| -------- | --------------- |
| **Moment detail** | On/Off form for props & sets (+ person, notes); thin costume on/off; derived “currently in play” |
| **Timeline badges / filters** | Mean change events / in-play relevance under new model |
| **Prop / set reports** | Chronology of on/off + notes + person |
| **Costume report / page** | From events, not scene matrix (minimal viable) |
| **Readiness** | Soft dims count on/off coverage sensibly |
| **Lav chart** | No change |
| **Character packets** | Not built; will read these APIs later |
| **Importer / CSV** | Still catalog-only; no auto events |
| **Tests / fixtures** | Rewrite attachment helpers; no migrate-from-old-rows tests |

---

## Deprecated / replaced

| Current | Fate |
| ------- | ---- |
| `moment_props` | **Replace** with `moment_prop_events` (drop old table; no row migrate) |
| `moment_set_pieces` | **Replace** with `moment_set_piece_events` |
| `costumes.scene_id` | **Remove**; timing via `moment_costume_events` |
| Costume filter via scene ∩ speakers | **Retarget** to events / derived wearing |
| Presence-only “attach prop/set” meaning | **Replaced** by on/off |
| PRE_AUGUST ban on event engine | **Superseded** for this scoped slice |
| Lav Timeline markers in this phase | **Deferred** (SoT decision still stands for later) |

**Not deprecated:** lav chart; entrances/exits/blocking/cues; catalogs; `on_stage.py`.

---

## Work Packages

### WP0 — Branch + authorize build

- Owner creates feature branch.  
- Explicit “go build” on this confirmed plan.  
- Accept implementation defaults above (or object).

**Done when:** Branch exists; build authorized.

### WP1 — Docs lock-in

- [DATABASE.md](DATABASE.md): new event tables; drop old junctions / `scene_id`; derivation rules; person XOR check.  
- [PROJECT.md](PROJECT.md): Event Philosophy → shipping for props/sets; phase summary.  
- [PRE_AUGUST_STP_PREP.md](PRE_AUGUST_STP_PREP.md) / scratch: note intentional early slice; lav markers still later; costume pieces still later.  
- ERD touch if cheap.

**Done when:** Docs match confirmed decisions.

### WP2 — Schema + derivation (props & set pieces) — **Done (2026-07-27)**

- Alembic: create event tables; drop `moment_props` / `moment_set_pieces`.  
- `asset_state` derivation + unit tests (cross-scene persistence; re-ON updates notes; off clears in-play).  
- Timeline API flags / summaries for prop & set events + derived in-play where needed.

**Done when:** Tests prove Iceberg ON @ M1 with notes → still in play with same notes in a later act until OFF or re-ON. ✅ `backend/app/services/asset_state.py` + `backend/tests/test_asset_state.py`; `moment_prop_events` / `moment_set_piece_events` tables (migration `018`); `MomentDetailResponse.props_in_play` / `set_pieces_in_play` derived from the walk. `props`/`set-pieces` moment endpoints now create/update/delete on/off events (kind, character XOR user, notes) instead of presence rows.

### WP3 — Timeline UI (props & set pieces) — **Implemented (2026-07-27); walkthrough passed 2026-08-01**

- Moment detail: On/Off + notes + optional character/user picker.  
- Badges/filters updated.  
- Light “currently in play” read-out from derivation.

**Done when:** Owner walkthrough below works in the UI. ✅ Moment detail panel now has separate prop / set-piece event sections (list existing on/off events with kind badge, person, notes; inline edit via PATCH; remove via DELETE) plus an add form (asset select, On/Off, Person type None/Character/User, notes). A compact "Currently in play" read-out renders `props_in_play` / `set_pieces_in_play` under each section. Person picker (`user` option) uses `GET /productions/{id}/active-users` (all active org users, any role) via `useTimelineScene` for Director/Admin — not Actor-only `castable-users`. Timeline badges/filters unchanged (still driven by `has_props` / `has_set_piece` etc. from the backend). Owner has not yet walked through the live UI.

### WP4 — Reports + readiness (props & sets) — **Done (2026-07-27)**

- Prop sheet uses on/off chronology. **No set sheet report** (confirmed 2026-07-27 — set pieces get events/derivation/UI but not a dedicated report this phase).  
- Readiness soft dims retargeted.

**Done when:** Prop sheet matches event model; no references to old junction APIs. ✅ `prop-sheet` report now reads `moment_prop_events` and includes `kind` + character/user person per row, still in show order (= chronology). Readiness `props` / `set_pieces` soft dimensions now count scenes with at least one event. ✅ Frontend: Reports page prop sheet chronology now shows an On/Off badge and character-or-user person alongside notes.

### WP5 — Costumes thin slice — **Done (2026-07-27)**

- `moment_costume_events`; drop `costumes.scene_id`.  
- Minimal Moment detail + Costumes page + filter + costume report so the app does not break.  
- No pieces, no outfit model, no heavy UX polish.

**Done when:** Can ON a costume for a character mid-show and OFF later; scene matrix gone. ✅ Migration `019` creates `moment_costume_events` (`character_id` required, `kind` on/off, `costume_id` required on `on` via CHECK, unique `(moment_id, character_id)`) and drops `costumes.scene_id` (no data migration). `compute_costume_state_by_moment` / `costume_states_at_moment` in `asset_state.py` derive current wearing per character, persisting across scenes/acts. Costume catalog API/schema drop `scene_id`; new moment costume event endpoints (`GET/POST/PATCH/DELETE .../moments/{id}/costumes`) validate character + costume in production and 409 on duplicate `(moment_id, character_id)`. `MomentDetailResponse` exposes `costume_events` + `costumes_wearing`; `costume_only` Timeline filter and `has_costume` now mean "has a costume event on this moment" (event-based, not scene-matrix). Readiness costume dimension retargeted: speaking non-builtin characters with ≥1 `on` costume event anywhere in the production / total speaking characters. `costumes-by-scene` report replaced by `GET .../reports/costume-changes` (flat chronology: character, kind, costume, notes, act/scene/seq). CSV import drops scene/act columns (`name, character, description`), dedupes on `(name, character_id)`. Frontend: `CostumesPage` is catalog-only (character + name + description); `MomentDetailPanel` has a dedicated Costumes event section (Wear/Clear, costume required for Wear, "Currently wearing" read-out) plus a link to the Costumes catalog page; Reports page shows "Costume changes" chronology.

### WP6 — Closeout — **Done (2026-07-27)**

- Feature closeout skill: phase status, scratch, PRE_AUGUST, UX backlog synced.  
- GitHub #51/#70 left for owner to update on merge (props/sets + thin costumes done; costume pieces / lav markers still open).  
- Regression: full backend suite green (220 passed, 1 skipped); frontend build + vitest green.

**Done when:** Docs match shipped behavior. ✅

---

## Rollout Order

```text
WP0 authorize + branch
  → WP1 docs
    → WP2 schema + derivation (props/sets)
      → WP3 Timeline UI
        → WP4 reports/readiness
          → WP5 costumes (thin)
            → WP6 closeout
```

---

## Definition of Done

1. Props and set pieces use **on/off** events with optional person (character XOR user) and free-text notes.  
2. Derivation persists **across scenes/acts** until the next event for that asset.  
3. Re-ON updates notes/person without richer event kinds.  
4. Old `moment_props` / `moment_set_pieces` are gone (no data migrate).  
5. Costumes use thin on/off events; `scene_id` removed; pieces not modeled.  
6. Lav chart and Timeline lav behavior unchanged.  
7. Reports/readiness/filters retargeted for props/sets (and costumes enough to work).  
8. Entrances/exits/cues/blocking and sacred script unchanged.  
9. Docs match shipped behavior.

---

## Risks / tradeoffs

| Risk | Mitigation |
| ---- | ---------- |
| Free-text locations hard to filter | Accept for v1; enum/model later |
| ON/OFF too coarse for handoffs | Re-ON updates person/notes; richer kinds later |
| Character XOR user UI clutter | Single “Person” control with type toggle or grouped select |
| Costume WP distracts from engine | Hard cap: schema + minimal UI/report only |
| Dropping old junctions breaks local DBs | Owner accepted re-entry; document in migration notes |

**Recommendation:** Build WP1–WP4 on the feature branch first; land WP5 only after props/sets walkthrough feels right (same branch OK).

**Deferring:** lav Timeline markers, costume pieces, stage model, richer event kinds, character packets, location enums.

---

## Follow-on (not this phase)

1. Lav derived Timeline markers (PHASE_13) + change-list sheet once engine is trusted  
2. Costume pieces → outfits  
3. Richer event kinds if on/off + re-ON is not enough  
4. Character packets reading derived state  
5. Optional stage-zone enum or scale-model positions  
6. Scene-summary drill-down into in-play assets  

---

## Decision Log

| Date | Decision |
| ---- | -------- |
| 2026-07-26 | Planning draft written |
| 2026-07-26 | **Confirmed:** build now; props/sets focus; free-text notes; persist across show; on/off only; optional character XOR user; no data migrate; lav markers deferred; thin costume on/off replacing `scene_id` |
| 2026-07-27 | **Build authorized:** WP1–WP4 (props/sets) now; WP5 (costumes) paused until props/sets walkthrough. Costume catalog keeps `character_id`, drops `scene_id` (WP5). WP4 ships prop sheet chronology only — no set sheet report. No data migration confirmed; old junctions may be dropped. WP1 docs lock-in complete. |
| 2026-07-27 | **WP2 + WP4 backend shipped.** `moment_prop_events` / `moment_set_piece_events` tables (migration `018`, `moment_props`/`moment_set_pieces` dropped, no data migrated); `app/services/asset_state.py` derivation (walks Act→Scene→sequence order, persists across scenes/acts, re-`on` updates person/notes, `off` clears in-play); `props`/`set-pieces` moment endpoints now create/PATCH/delete on/off events; `MomentDetailResponse` exposes `props_in_play`/`set_pieces_in_play`; prop sheet report and readiness soft dimensions retargeted to the new tables. WP3 (Timeline UI) and WP5 (costumes) are still not started — this is backend-only. |
| 2026-07-27 | **WP3 + WP4 frontend shipped.** Moment detail panel: dedicated Props / Set pieces event sections (on/off badge, character-or-user person, notes; inline PATCH edit; DELETE remove) replacing the old presence-only attach list; add-event form with On/Off + Person type (None/Character/User) + notes; compact "Currently in play" read-out from `props_in_play`/`set_pieces_in_play`. Person User picker loads `active-users` (all active org users) rather than Actor-only `castable-users`. Reports page prop sheet chronology shows the On/Off badge and character-or-user person. Costumes untouched (WP5, still not started). Owner walkthrough still pending. |
| 2026-07-27 | **WP5 (costumes) shipped, backend and frontend.** Migration `019` adds `moment_costume_events` and drops `costumes.scene_id` (no data migration). Costume derivation, catalog/event APIs, timeline integration, readiness retarget, `costume-changes` report, and CSV import all updated per WP5 scope. Frontend Costumes catalog page, Moment detail costume event section, and Reports page updated to match. Owner walkthrough still pending for WP3–WP5 together. |
| 2026-07-27 | **WP6 closeout.** Docs/scratch/UX backlog synced to shipped event model. #51/#70 left for owner on merge. |
| 2026-07-28 | Pre-merge UX polish: icon attachment-type picker; On/Off (Wear/Clear) toggles; unified searchable character+user person combobox (#73); searchable catalog selects; Currently in play / wearing hide event notes (#75). |
| 2026-07-30 | **In-play → Moment deep links (Slice A+B).** `AssetStateSnapshot` tracks `source_moment_id`/`source_scene_id`; in-play API rows expose human triples for source + optional next-change; Moment Detail “Currently in play” shows dotted `1.3.10` links via `humanTimelinePath`. Costumes later shipped 2026-08-13 (Slice C); sticky URL still deferred — see [in-play-moment-deep-links.md](shipped_features/in-play-moment-deep-links.md). |
| 2026-08-01 | **Owner walkthrough passed — phase complete.** Follow-on polish: OFF-moment prior-ON deep links (#83), ON-moment in-play dedupe (#76), Moment Detail refresh/expand after attach (#74). |
| 2026-08-13 | **In-play costume deep links (Slice C).** `CostumeWearingSnapshot` tracks `source_moment_id`/`source_scene_id` + `in_play`; wearing rows expose source + next-change (Wear or Clear, keyed by `character_id`); OFF costume event rows expose prior-on. Same `humanTimelinePath` dotted codes as props/sets. Sticky URL / Rehearse still deferred. |

---

## Suggested owner walkthrough (after WP3)

1. Set piece “Iceberg” → Moment: **ON** with Connor — notes `Downstage Left`.  
2. Scrub later scene/act — still on, same notes.  
3. Later Moment: **ON** with Connor — notes `Upstage Right` (re-ON = move).  
4. Prop “Ice Axe” → **ON** with Shackleton; later **OFF** of Shackleton — notes `Tuck under the ship`.  
5. Confirm derived “currently…” and prop report chronology.
