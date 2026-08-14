# Phase 6 — Rehearsal UX & Timeline Polish

**Status:** Shipped (2026-07-11)

**Goal:** Make the app comfortable enough for real rehearsal use — especially for **Actors** — by shipping a dedicated Rehearse experience, refining the moment detail panel, fixing timeline interaction papercuts, and adding early scene-level context on the Timeline.

Phase 5 completed the functional MVP prep workflow. **The product works; it does not yet feel good to use for tomorrow's show.** Phase 6 closes that gap without expanding into post-MVP production management, demo packaging, deployment hardening, or importer changes.

---

## Owner Decisions (confirmed 2026-07-11)

| Topic | Decision |
| ----- | -------- |
| **Phase 6 theme** | Rehearsal-first UX polish — not new prep objects or backend architecture |
| **Rehearse nav** | Visible to **all roles** (Admin, Director, Actor) |
| **Production Open landing** | **Overview for all roles** — no Actor-specific default route |
| **Cue-only checkbox** | **Removed from Timeline entirely** — rehearsal display modes live only on Rehearse |
| **Rehearse API strategy** | **No new endpoints, no extra fetches** — one scene moments load per scene change; all Rehearse presets filter **client-side** |
| **Rehearse presets** | Three practice modes aligned to owner workflow: **Scene run-through**, **My lines**, **Line cues** (see [Rehearse display model](#rehearse-display-model)) |
| **Line blur** | P2 — blur own lines until click/hover reveal; presets alone are sufficient for P0 |
| **Scene summary v1** | Read-only chips; derived client-side from loaded moment list + catalogs |
| **Scene summary future** | Clickable chips → character drill-down modals — documented in [PROJECT.md](PROJECT.md) Wish List |
| **On-stage in moment detail** | **Remove** once scene summary strip ships — on-stage context belongs at scene level, not per moment |
| **Display persistence** | Rehearse choices in `sessionStorage` per production |
| **Moment detail add-actions** | Single **Add to moment** menu → sub-flow per attachment type |
| **Script cleanup** | Owner task — not an implementer work package |

---

## Where We Are (post–Phase 5)

### Shipped and reliable

| Area | Status |
| ---- | ------ |
| Full prep workflow (import → cast → props/cues/costumes → entrances/exits/blocking) | Done |
| Production overview + minimal reports | Done |
| Actor read access to timeline, notes, bookmarks | Done |
| Cue-only mode (checkbox on Timeline) | Done — **to be removed** |
| Backend tests through Phase 5 | Done |

### Gaps blocking comfortable rehearsal use

| Item | Notes |
| ---- | ----- |
| Actor rehearsal workflow | No dedicated practice modes — actors share director-prep Timeline chrome |
| Line practice | No "my line + what comes before it" view for cue-in practice |
| Moment detail panel | Cluttered; on-stage list in wrong place; empty stage-direction field on dialogue moments |
| Timeline click targets | Only the text portion of a row selects the moment |
| Scene-level context | Who's in the scene, which songs appear — buried or absent |
| Filter bar UX | Long row of selects and checkboxes; cue-only checkbox adds confusion |
| Phase 5 P2 items | On-stage row badges, blocking-by-character filter — still unchecked |

### Explicitly not Phase 6

| Item | Target |
| ---- | ------ |
| `DEMO_WALKTHROUGH.md` | Out of scope (owner decision) |
| Multi-scene importer tolerance / new fixtures | Owner cleans script manually; no importer changes |
| Production deploy / nginx / CORS / secrets | Post–Phase 6 |
| Event engine migration | Post-MVP |
| Rehearsals, attendance, tasks, performances | Post-MVP |
| Bookmarks dedicated timeline view | Wish list — owner design undecided |
| Stage diagram blocking picker | Wish list |
| New Rehearse API endpoints or filter params | Out of scope — client-side only |
| Live search, multi-select character filter | P2 within Phase 6 if time; otherwise wish list |
| PDF export, preparation progress dashboard | Post-MVP |
| Saved named views (persisted rehearsal modes) | Post-MVP |

---

## Read First (authoritative)

| Document | Use for |
| -------- | ------- |
| [PROJECT.md](PROJECT.md) | Vision, MVP success criteria, wish list |
| [ROLES.md](ROLES.md) | Actor view-only rules; what actors may edit (notes, bookmarks) |
| [UI_STANDARDS.md](UI_STANDARDS.md) | Timeline + panel patterns — **update in WP7** |
| [PHASE_5.md](PHASE_5.md) | What already ships; deferred P2 timeline items |
| [SCRATCH_NOTES.md](SCRATCH_NOTES.md) | Owner UX notes feeding this phase |
| [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) | Code style, vertical slices, Docker, uv |

**Test fixture:** Continue regression on [fixtures/scripts/endurance-scene1.md](../fixtures/scripts/endurance-scene1.md). Owner validates a cleaned full script separately.

---

## Phase 6 Theme

Phase 5 made the product **complete**. Phase 6 makes it **usable in rehearsal**:

1. **Everyone gets Rehearse** — a timeline view built around how actors actually practice lines, without new API complexity.
2. **Directors keep Timeline for prep** — cue-only removed; filters reorganized; moment detail less overwhelming.
3. **Scene context appears where you need it** — read-only chips at the top of the scene; on-stage info removed from moment detail.
4. **Small interaction fixes compound** — full-row clicks, sensible empty fields, better labels.

---

## Rehearse Display Model

Rehearse is a **client-side view mode** over the same scene data Timeline already loads. Switching presets must **not** trigger new API requests.

### Owner rehearsal workflow (what we are enabling)

| Practice step | What the actor does | Rehearse preset |
| ------------- | ------------------- | --------------- |
| 1 | Read through scenes they are in — their lines **and** everyone else's | **Scene run-through** |
| 2 | Read only their own lines | **My lines** |
| 3 | Practice saying each line **after** whatever comes immediately before it | **Line cues** |

### API loading strategy (non-negotiable)

```
Scene change  →  one GET .../scenes/{scene_id}/moments  (full scene, no character filter)
Preset change →  client-side filter only (zero new requests)
Search submit →  may refetch with search param (same endpoint, acceptable)
```

Catalog data (characters, songs) is already loaded for name resolution and highlights. **Do not** add rehearsal-specific backend filter params.

### Display presets (dropdown)

Implement as pure functions in `rehearsePresets.ts` operating on `MomentSummary[]` + `myCharacterIds`.

| Preset | Intended use | Client-side filter logic |
| ------ | ------------ | ------------------------ |
| **Scene run-through** | Full scene script; actor reads everyone else's lines too | All moments in loaded scene; **highlight** moments where `speaking_character_ids` intersects `myCharacterIds` |
| **My lines** | Solo line memorization | Moments where `speaking_character_ids` intersects `myCharacterIds` (dialogue/lyric moments only, unless stage-direction reference heuristic exists — see note) |
| **Line cues** | Practice entering on cue — see the line/direction **immediately before** each of your lines | For each "my line" moment at sequence `N`, include moment `N` **and** moment `N-1` (if exists in same scene). Deduplicate. Order preserved. |

**Stage-direction reference note:** Timeline highlight logic already treats stage directions referencing a filtered character name as relevant. Rehearse **Line cues** preset should use the same "is this my moment?" helper for determining which moments are "my lines" so a stage direction immediately before my dialogue is included naturally.

**Naming:** Preset is **Line cues** (not "Cues only") to avoid confusion with technical lighting/sound cues.

### Scope control (always visible on Rehearse)

| Control | Behavior |
| ------- | -------- |
| Act / Scene | Same as Timeline — scene change triggers the single moments fetch |
| Search | Scene-scoped; live debounce (~275ms) plus Enter / Search to commit immediately |

No character dropdown on Rehearse — "my characters" is always derived from the logged-in user's casting (`myCharacterIds`). Directors/admins using Rehearse see the same presets relative to **their** cast assignments (if any); uncast staff see Scene run-through as undifferentiated full script.

### Display toggles

| Toggle | Default | Effect |
| ------ | ------- | ------ |
| Highlight my lines | On | Blue left-border on moments matching `myCharacterIds` (Scene run-through) |
| Show stage directions | On | Client-side hide `stage_direction` moments when off |
| Show lyrics & songs | On | Client-side hide song moment types when off |
| Show prep badges | Off | Prop / Cue / Entrance / Exit / Blocking badges on list rows |
| **Blur my lines** | Off | **P2** — own line text blurred until click or hover reveal; context lines stay visible |

Adjusting toggles after choosing a preset switches the preset label to **Custom**.

### What Rehearse hides (vs Timeline)

- Director prep filters: group, costume/entrance/exit/blocking toggles, prop/cue-category/mic/set-piece selects
- Cue-only checkbox (removed from Timeline too)
- Structural editing controls (move up/down, insert, delete)
- Parsed-data / import-review editing

All roles retain on Rehearse: moment detail (read-only prep data for actors), notes, bookmarks.

---

## In Scope

### P0 (must-ship) — Rehearse experience

- Rehearse page + sidebar nav (all roles)
- Three presets: Scene run-through, My lines, Line cues
- Client-side filtering — no new API endpoints or filter params
- Remove cue-only checkbox from Timeline

### P0 (must-ship) — Moment detail refinement

- Hide stage-direction section on Dialogue-type moments
- Rename "Parsed data correction" → **Imported data**
- **Add to moment** menu for Director/Admin prep attachments
- Remove **On stage** section from moment detail after scene strip ships (WP5)

### P0 (must-ship) — Timeline interaction fixes

- Full moment row clickable (including padding below text)
- Shared row component in Timeline and Rehearse

### P1 (should-ship) — Scene-level context

- Scene summary strip — **client-side** from loaded moments + character/song catalogs
- Read-only chips: characters with dialogue in scene, songs in scene
- Props: v1 shows "Props in scene" indicator (count of moments with `has_props`) — named prop chips deferred (see wish list)
- Strip on Timeline and Rehearse; on-stage list **removed** from moment detail

### P1 (should-ship) — Timeline filter cleanup (Director/Admin)

- Collapsible **Advanced filters** for prep-only controls
- Phase 5 P2 **on-stage badges** on list rows (optional via Rehearse "prep badges" toggle)

### P2 (can slip)

- **Blur my lines** toggle (click/hover reveal)
- Scene summary **clickable chips** → character drill-down modal (wish list vision)
- Blocking filter by selected character (Phase 5 P2 carryover)
- Live search
- Rehearse preset persistence in `localStorage`
- Named prop chips in scene summary (may need `prop_ids` on `MomentSummary` later — not Phase 6)

---

## Out of Scope (defer)

| Item | Rationale |
| ---- | --------- |
| Demo walkthrough doc | Owner excluded |
| Importer changes | Owner cleans source script |
| Deployment hardening | Separate future phase |
| New Rehearse backend endpoints | Owner: keep it simple |
| Technical cue-only mode | Was a director/tech tool; use Timeline advanced filters or Reports if needed |
| Bookmarks redesign | Owner undecided |
| Event engine | Post-MVP |
| Saved named views | Post-MVP |

---

## Work Package Priority

| Tier | Packages | Rationale |
| ---- | -------- | --------- |
| **P0** | WP1 → WP2 → WP3 → WP4 | Rehearse + detail + clicks |
| **P1** | WP5 → WP6 | Scene context + director filter cleanup |
| **P2** | WP7 (docs/tests) + WP8 (extras) | Hardening and blur/modals |

**Hard dependencies:**

- WP1 component extraction before WP2 and WP4
- WP5 scene strip before removing on-stage from WP3
- WP7 runs throughout

---

## Work Packages

### WP1 — Rehearse Page & Navigation (P0)

**Objective:** All roles get a rehearsal-focused timeline view without director clutter or extra API calls.

**Tasks:**

- [ ] New route: `/productions/:id/rehearse` → `RehearsePage.tsx`
- [ ] Extract shared pieces from `TimelinePage.tsx`:
  - `useTimelineScene` (or similar) — acts, scenes, single moments fetch per scene
  - `TimelineMomentList` — row rendering, selection, highlights
  - `TimelineMomentDetail` — panel/sheet wiring
- [ ] Rehearse fetches **full scene** moments (no `character_ids` on API call)
- [ ] Sidebar: **Rehearse** nav item for Admin, Director, and Actor (placement: directly above or below Timeline)
- [ ] Production list **Open** → Overview for **all roles** (unchanged)
- [ ] Remove **Cue-only mode** checkbox from `TimelinePage` entirely
- [ ] Frontend tests for `rehearsePresets.ts` pure functions (no backend changes required for Rehearse)

**Done when:** Any role navigates to Rehearse via sidebar; scene loads once; switching presets does not refetch.

---

### WP2 — Rehearse Display Controls (P0)

**Objective:** Three practice presets matching owner workflow; instant client-side switching.

**Tasks:**

- [ ] Preset dropdown: **Scene run-through**, **My lines**, **Line cues**
- [ ] `rehearsePresets.ts` — pure filter functions + unit tests:
  - `filterSceneRunThrough(moments, myCharacterIds)`
  - `filterMyLines(moments, myCharacterIds)`
  - `filterLineCues(moments, myCharacterIds)` — each my-line moment + immediate predecessor
- [ ] `isMyMoment(moment, myCharacterIds)` — shared helper aligned with Timeline highlight rules
- [ ] Display toggles: highlight, stage directions, lyrics/songs, prep badges
- [ ] Custom preset label when toggles diverge from preset defaults
- [ ] `sessionStorage` persistence per `productionId`
- [ ] Empty states: "You have no lines in this scene" / "No cast characters — showing full scene"
- [ ] Mobile-friendly control layout

**Done when:** Actor runs through all three practice steps on `endurance-scene1.md` without any API call beyond scene load and search.

---

### WP3 — Moment Detail Panel Refinement (P0)

**Objective:** Less clutter; fields only where they belong.

**Tasks:**

- [ ] Hide **Stage direction** section when `moment_type === 'dialogue'`
- [ ] Verify **Dialogue** hidden for `stage_direction` moments
- [ ] Rename parsed-data section to **Imported data**
- [ ] Director/Admin: **Add to moment** menu → Prop, Cue, Microphone, Set piece, Entrance, Exit, Blocking
- [ ] Attached items stay inline with remove/edit
- [ ] Actor: prep sections collapsed by default (expand to read)
- [ ] **Remove On stage block** from moment detail once WP5 scene strip is shipped
- [ ] Regression: panel does not close on attach/detach

**Done when:** Dialogue moment has no empty stage-direction field; on-stage info gone from detail; director adds cue via Add menu.

---

### WP4 — Timeline Click Targets & List Polish (P0)

**Objective:** Moment selection feels natural on both pages.

**Tasks:**

- [ ] Entire row clickable except structural edit buttons
- [ ] Keyboard accessible (`Enter` / `Space`)
- [ ] Selected + highlight styles on full row height
- [ ] Touch-friendly `min-height` on mobile
- [ ] Shared between Timeline and Rehearse

**Done when:** Whitespace below moment text selects the moment.

---

### WP5 — Scene-Level Context (P1)

**Objective:** Scene-wide stats at the top of the scene — no new API endpoint.

**Tasks:**

- [ ] `SceneSummaryStrip.tsx` — derives from **already-loaded** `moments[]` + `characters[]` + `songs[]`:
  - **Characters:** unique names from `speaking_character_ids` across scene moments
  - **Songs:** unique titles from `moment.song_id` resolved against songs catalog
  - **Props:** v1 — badge or text like "Props used (N moments)" from `has_props` count; named chips deferred
- [ ] Render on Timeline and Rehearse below act/scene selectors
- [ ] Copy: "Characters in this scene" (script presence, not current on-stage state)
- [ ] Remove **On stage** from `MomentDetailPanel` after strip ships
- [ ] Document richer future (clickable chips, per-character entrance/exit drill-down) in PROJECT.md Wish List — see WP7

**Done when:** Opening a scene shows character and song chips without an extra HTTP request or opening a moment.

---

### WP6 — Director Timeline Filter Cleanup (P1)

**Objective:** Timeline filter bar scannable; carry forward Phase 5 P2 items.

**Tasks:**

- [ ] **Advanced filters** disclosure: group, costume/entrance/exit/blocking toggles, prop/cue/mic/set selects
- [ ] Always visible: act, scene, character, search
- [ ] On-stage row badges (Phase 5 P2) when entrance/exit data exists — visible on Timeline; Rehearse when prep badges toggle on
- [ ] Blocking-by-character filter in advanced section (Phase 5 P2)
- [ ] Active-filter indicator on Advanced filters button

**Done when:** Desktop Timeline fits primary filters on one row; cue-only checkbox is gone.

---

### WP7 — Tests, Docs & Standards (runs throughout)

**Tasks:**

- [ ] `frontend` unit tests for `rehearsePresets.ts` (primary Phase 6 test surface — no backend changes expected)
- [ ] Extend `backend/scripts/smoke_test.py` — actor navigates to `/rehearse` (route renders; no new API assertions)
- [ ] Update [UI_STANDARDS.md](UI_STANDARDS.md) — Slice 6: Rehearse page, presets, scene strip
- [ ] Update [PROJECT.md](PROJECT.md) wish list with scene-summary and blur future vision
- [ ] Mark checkboxes in this document as work completes

---

### WP8 — Phase 6 Extras (P2)

**Tasks:**

- [ ] **Blur my lines** — CSS blur on own line text in list rows; reveal on click or hover; toggle in Rehearse controls
- [ ] Scene summary clickable chips → character modal (entrance/exit/costume/prop drill-down)
- [x] Live search on Timeline + Rehearse
- [ ] `localStorage` persistence for Rehearse presets
- [ ] Named prop chips in scene summary (evaluate extending `MomentSummary` vs separate fetch)

---

## Client-Side Filter Reference

### Line cues algorithm (pseudocode)

```text
myLineMoments = moments.filter(m => isMyMoment(m, myCharacterIds))
idsToShow = empty set
for each moment in myLineMoments:
  add moment.id to idsToShow
  predecessor = moment immediately before in sequence (same scene)
  if predecessor exists:
    add predecessor.id to idsToShow
return moments.filter(m => idsToShow.has(m.id))  // preserve timeline order
```

### Scene summary derivation (pseudocode)

```text
characterIds = union of moment.speaking_character_ids for all moments
characters = resolve names from characters catalog
songIds = unique non-null moment.song_id
songs = resolve titles from songs catalog
propMomentCount = count of moments where moment.has_props
```

---

## Manual Validation Script

### P0 — Actor rehearsal path

1. Log in as `actor` → **Open** production → lands on **Overview** → navigate to **Rehearse** via sidebar.
2. **Scene run-through** → full scene visible; own lines highlighted; others' lines visible.
3. **My lines** → only own dialogue/lyric moments remain.
4. **Line cues** → each own line appears with the moment immediately before it (stage direction or other character's line).
5. Switch presets rapidly → confirm **no network refetch** (devtools Network tab).
6. Open moment → private note + bookmark → refresh → Rehearse controls restore from session.

### P0 — Director prep path

1. Log in as `director` → Timeline → no cue-only checkbox; Advanced filters work.
2. Dialogue moment → no stage-direction field; **Imported data** label correct.
3. **Add to moment** → attach cue without panel closing.
4. Full row click selects moment.

### P1 — Scene context

1. Scene with known cast → summary strip shows correct character chips (from dialogue).
2. Moment detail → **no On stage section** after WP5 complete.

---

## Suggested Agent Execution Order

```
WP1 Rehearse route + shared components + remove cue-only
  → WP2 Presets (client-side) + tests
  → WP4 Click targets (parallel WP2)
WP3 Moment detail (parallel; remove on-stage after WP5)
WP5 Scene summary strip (client-side)
WP6 Timeline advanced filters
WP7 Docs & frontend tests (throughout)
WP8 Blur + clickable chips if time remains
```

---

## Owner Task (outside implementer scope)

- [ ] Clean up the production script you intend to use (e.g. `fixtures/scripts/endurance-full.md` or your Google Docs export) so it imports successfully under [IMPORT_SPEC.md](IMPORT_SPEC.md) — **no importer code changes in Phase 6**.
- [ ] Run a real rehearsal session with at least one actor and capture friction in [SCRATCH_NOTES.md](SCRATCH_NOTES.md) for a future phase.

---

## Decisions Log

| Date | Decision |
| ---- | -------- |
| 2026-07-11 | Phase 6 scoped as rehearsal UX + timeline polish — not demo/deploy/importer work |
| 2026-07-11 | Rehearse nav for all roles; Open → Overview unchanged for everyone |
| 2026-07-11 | Cue-only checkbox removed from Timeline; Rehearse owns practice modes |
| 2026-07-11 | Rehearse presets: Scene run-through, My lines, Line cues — all client-side |
| 2026-07-11 | No new Rehearse API endpoints — one moments fetch per scene change |
| 2026-07-11 | Scene summary v1 = read-only client-side chips; rich modals → wish list |
| 2026-07-11 | On-stage removed from moment detail once scene strip ships |
| 2026-07-11 | Line blur (hover/click reveal) = P2 |
| 2026-07-11 | Script cleanup assigned to owner, not implementer |

---

## Notes for Implementing Agent

- **Extract components** from `TimelinePage.tsx` early — do not clone the page.
- Rehearse preset switching must cause **zero** API requests — verify in Network tab during QA.
- **Line cues** is not technical `cue_only` — it is "the moment before my line."
- Do **not** add backend rehearsal filter params unless a blocking bug forces it — document why if you must.
- Do **not** introduce the event engine or new prep tables.
- Scene summary: derive from loaded data; do not add `GET .../summary` endpoint in Phase 6.
- Actor permissions unchanged: read-only on prep mutations; notes private only.
- When uncertain, ship the simpler UI and document the tradeoff here.
