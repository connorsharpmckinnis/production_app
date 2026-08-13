# Feature plan — In-play → Moment deep links

**Status:** Shipped (Slice A + B — props/set pieces; OFF prior-on back-link 2026-08-01)  
**Created:** 2026-07-27  
**Shipped:** 2026-07-30  
**Related:** [PHASE_14.md](../PHASE_14.md) (event-driven asset state), bookmarks/reports Timeline deep-links (already shipped), [UX_UI_IMPROVEMENTS.md](../UX_UI_IMPROVEMENTS.md) scene-summary drill-down wish, [SCRATCH_NOTES.md](../SCRATCH_NOTES.md) scene-level entrance/exit drill-down

---

## Goal

From a Moment’s **Currently in play** readout (props / set pieces), let the user jump to the Timeline Moment that last set that asset’s current state, and (when one exists) the next Moment where that asset changes again.

Primary motivating UX: while looking at a moment mid-show, see “Iceberg — Downstage Left” and open the Moment where that location was set, without hunting the Timeline by hand.

---

## Problem

Phase 14 derives “currently in play” by walking ON/OFF events in show order. The Moment Detail UI shows that derived snapshot as a compact card (name + person; notes intentionally omitted from the readout for now — see #75).

That card is **display-only**. It does not expose which Moment produced the snapshot, so there is nothing to link.

Separately, **Timeline supports** one-shot deep-links (soft, by show position):

```text
/productions/:id/timeline?act=<actNumber>&scene=<sceneNumber>
/productions/:id/timeline?act=<actNumber>&scene=<sceneNumber>&moment=<sequenceNumber>
```

`act` / `scene` are Act/Scene **numbers** (not PKs). `moment` is the per-scene `sequence_number`. Omitting `moment` opens the first moment of that scene. Legacy PK links `?scene=<sceneId>&moment=<momentId>` still work. Bookmarks and reports emit **human** URLs. Timeline consumes the params, selects the scene, opens Moment Detail, then **clears the query string after a successful (or failed-but-ready) resolve** — params are kept until then so a catalog re-fetch cannot strand the link.

So the missing piece for in-play drill-down is **data + UI on the in-play card**, not a new navigation primitive — with a few product decisions about what “start” / “stop” mean and how far to go.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Timeline deep-link | Human `?act=&scene=&moment=` (soft) + legacy PK; params cleared after resolve; bookmarks/reports emit human URLs |
| Selection model | `selectedMomentId` in React state (`useTimelineScene`); sheet open when non-null |
| Rehearse deep-link | **None** (path param only) |
| Sticky URL while panel open | **No** — manual selection does not write `?moment=` back |
| `props_in_play` / `set_pieces_in_play` API | Asset id/name, person, notes only — **no moment ids** |
| `AssetStateSnapshot` | `in_play`, person, notes, `last_kind` — **no source moment id** |
| Costumes “wearing” | Same gap (no originating wear-moment id) |
| In-play UI | Label + person + notes list under Props / Set pieces sections |

Relevant code (approximate):

- Consume deep-link: `frontend/src/pages/TimelinePage.tsx`
- Producers: `frontend/src/components/AppShell.tsx` (bookmarks), `frontend/src/pages/ReportsPage.tsx`
- In-play UI: `frontend/src/components/MomentDetailPanel.tsx` (`AssetEventSection`)
- Derivation: `backend/app/services/asset_state.py`
- Response shaping: `backend/app/api/timeline.py` (`_props_in_play_response`, `_set_pieces_in_play_response`)
- Schemas: `PropInPlayResponse`, `SetPieceInPlayResponse`

---

## What we could implement

### Slice A — Minimum useful (recommended first)

**Backend**

- While computing asset state, record the **moment id** (and its **scene id**) of the event that produced the current snapshot.
- For assets currently in play, that is the last **ON** that set person/notes (including re-ON “moves / handoffs”).
- Expose on in-play responses, e.g.:

  - `source_moment_id`
  - `source_scene_id`
  - optionally `source_kind` (`on` — always `on` for in-play items)

**Frontend**

- On each Currently in play row, add a control (text button / icon) such as **“Set at …”** or a deep-link affordance that navigates to:

  `/productions/:id/timeline?act=<actNumber>&scene=<sceneNumber>&moment=<sequenceNumber>`

  (Prefer human show-position links. Legacy PK form still works if only ids are handy.)

- Same-page: if already on Timeline, either reuse that URL (triggers existing effect) **or** call `selectSceneById` + `setSelectedMomentId` directly. Prefer one pattern and stick to it (see open questions).

**Done when:** From any moment where an asset is in play, the user can open the Moment that last set that asset’s current person/notes/location, including when that Moment is in an earlier scene/act.

### Slice B — “Stop” / next OFF (optional follow-on)

For an asset still in play at the **current** moment, OFF has not happened yet in the walk up to now. “Stop” therefore means **looking forward**:

- Find the next OFF for that asset after the current moment (if any).
- Expose `next_off_moment_id` / `next_off_scene_id` (nullable).
- UI: second control, e.g. **“Clears at …”**, disabled or hidden when null.

**Done when:** User can jump to the later Moment that takes the asset out of play, when one exists.

### Slice C — Same pattern for costumes (optional)

Mirror Slice A (and optionally B) for `costumes_wearing`: source wear moment, optional next clear moment.

Lower priority unless costume walkthroughs need the same “where did this look start?” jump.

### Slice D — Sticky / shareable Timeline URLs (orthogonal)

Keep `?scene=&moment=` in the URL while Moment Detail is open; sync selection ↔ params; remove on close.

Useful for share/refresh, independent of in-play cards. Bookmarks already produce one-shot links; this would make **any** open moment addressable after navigation.

Explicitly optional — do not couple to Slice A unless the owner wants both.

### Slice E — Scene-summary / catalog drill-down reuse (later)

Scene summary chip drill-down and catalog “where does this appear?” flows want the same “jump to moment” behavior. Once source moment ids exist on derived state (or a small shared helper), those UIs can reuse the deep-link without inventing a second mechanism.

Parked here so Phase 14 follow-ons stay aligned with [PROJECT.md](../PROJECT.md) wish list / scratch notes.

---

## Open questions (decide before build)

| # | Question | Recommendation | Alternatives |
| - | -------- | -------------- | ------------ |
| **Q1** | For in-play items, what is **“start”**? | **Last ON** that produced the current snapshot (includes re-ON move/handoff). Matches “current location/state.” | First ON in the unbroken in-play run (ignores later moves) — useful for “when did it enter?” but wrong for “why is it DSL now?” |
| **Q2** | Do we need **“stop”** in v1? | **No** — ship Slice A only. Next OFF is a cheap follow-on once source tracking exists. | Ship A+B together if rehearsal cues often need “when does this leave?” |
| **Q3** | Navigation style from Moment Detail? | **Reuse existing human** `?act=&scene=&moment=` deep-link (same as bookmarks/reports). Works across scenes; one code path. Legacy PK still OK if only ids are available. | In-process `setSelectedMomentId` only when same scene; URL when crossing scenes — more branches for little gain. |
| **Q4** | Cross-scene jumps while a sheet is open — expected UX? | Switching scene + opening the source moment **replaces** the current detail (same as picking another moment). Optional toast: “Opened Act 1 Scene 2 · Moment N”. | Open source in a second panel / modal — overbuilt for MVP. |
| **Q5** | What if filters hide the target moment? | Deep-link selects scene then waits for moment list; if still missing after load, show a short error toast and leave selection unchanged. Do **not** auto-clear all filters unless owner wants that. | Clear filters automatically so the jump always succeeds. |
| **Q6** | Include **costumes** in v1? | **Defer** (Slice C). Props/sets are the motivating case. | Include if costume walkthroughs are equally important before next rehearsal. |
| **Q7** | Sticky URL (Slice D) in same effort? | **Defer.** Separate concern; don’t block in-play links. | Bundle if share/refresh of open moments is a near-term pain. |
| **Q8** | Label / affordance copy? | Compact: asset row + link control **“Set here”** / icon with `aria-label` “Open moment that set this state”. Avoid cluttering the muted in-play block. | Show act/scene/sequence text inline (more informative, noisier). |
| **Q9** | Should the **ON event row on the source moment itself** also deep-link anywhere? | No — you’re already there. Links only on **derived** in-play cards (and later drill-downs). | Also link from reports (already have moment links). |

None of these block writing the plan; **Q1–Q3 and Q6** should be locked before implementation.

---

## Proposed work packages (if authorized)

### WP0 — Decisions + acceptance notes

- Lock Q1–Q3, Q6 (and Q2 if stop is in/out).
- Write 2–3 acceptance examples (e.g. Iceberg ON in A1S1 with notes DSL; later re-ON move; jump from A2 moment lands on last ON).

**Done when:** Owner sign-off recorded in this doc’s Decision log.

### WP1 — Derivation + API fields (Slice A)

- Extend `AssetStateSnapshot` (or parallel map) with `source_moment_id` (+ scene id when shaping responses).
- Include fields on `PropInPlayResponse` / `SetPieceInPlayResponse`.
- Unit tests: first ON; re-ON overwrites source; OFF clears in-play (and thus no card); state persists across scenes with correct source.

**Files (expected):** `asset_state.py`, timeline API helpers, schemas, `frontend/src/lib/types.ts`, `test_asset_state.py` (+ API tests if present).

**Done when:** Moment detail JSON for an in-play asset includes resolvable source scene/moment ids.

### WP2 — Currently in play UI links

- Map new fields into `AssetInPlayItem`.
- Add link/button per row; navigate via Timeline deep-link pattern.
- Keyboard / `aria-label` parity with other Timeline icon actions.
- Manual check: same-scene jump; cross-scene jump; missing moment toast path if easy to fixture.

**Done when:** Clicking the control opens the correct Moment Detail on Timeline.

### WP3 — Optional next OFF (Slice B)

- Forward scan (or second pass) for next OFF after current moment.
- Nullable API fields + UI control when present.
- Tests for “OFF later in same scene”, “OFF later act”, “never OFF”.

**Done when:** Stop link works when an OFF exists; absent when not.

### WP4 — Optional costumes (Slice C) / sticky URL (Slice D)

- Only if prioritized after A (and maybe B).

---

## Explicitly out of scope (this proposal)

- New event kinds (`move`, `transfer`, …) — Phase 14 locked **on/off only**; re-ON remains the move/handoff mechanism
- Polymorphic event store or schema rewrite
- Rehearse-mode deep-links (can mirror later; not required for in-play cards in Moment Detail)
- Dedicated bookmarks timeline redesign
- Full scene-summary chip drill-down modals (wish list; may consume this later)
- Storing in-play as rows (keep **derived over stored**)

---

## Risks / tradeoffs

| Risk | Mitigation |
| ---- | ---------- |
| Cross-scene jump feels disorienting | Brief toast with act/scene context; reuse familiar bookmark behavior |
| Filters hide target moment | Toast; don’t silently fail; document Q5 choice |
| “Start” ambiguity (first ON vs last ON) | Lock Q1 in Decision log; document in UI tooltip if needed |
| Scope creep into sticky URLs + costumes + scene chips | Ship Slice A alone; park B–E |
| Forward OFF scan cost | Show-order walk already happens; tracking next OFF is cheap if done carefully in the same pass family |

**Recommendation (updated 2026-07-30):** Ship **Slice A + B** together (source + next-change deep links on props & set pieces). Defer costumes and sticky URLs.

**Why this fits now:** Phase 14 derived in-play already walks the show; tracking source + forward-scanning next event is cheap; deep-link plumbing already exists.

**Deferring:** Slice C–E; Rehearse parity; scene-summary drill-down.

---

## Suggested sequence

1. Answer open questions (especially Q1–Q3, Q6).
2. Authorize Slice A (WP0–WP2) as a small follow-on — either its own tiny phase or a PHASE_14 follow-up WP.
3. Rehearse with real show data (Iceberg / handoff / multi-act persistence).
4. Only then consider Slice B (next OFF) if “when does this leave?” comes up often.

---

## Decision log

| Date | Topic | Decision |
| ---- | ----- | -------- |
| 2026-07-30 | Q1 start | Last event that set current state (today: last ON; future MOVE etc. also update source; OFF clears in-play) |
| 2026-07-30 | Q2 next change in v1? | **Yes** — next event for that asset after the viewed Moment (ON or OFF, not OFF-only). Hide link when null. |
| 2026-07-30 | Q3 navigation | Human `?act=&scene=&moment=` via `humanTimelinePath` |
| 2026-07-30 | Q6 costumes in v1? | **Defer** (Slice C) |
| 2026-07-30 | Q7 sticky URL? | **Defer** (Slice D) |
| 2026-07-30 | Q8 affordance | Dotted moment codes (`1.3.10`) as underlined links; source always; next when present (`source → next`) |
| 2026-07-30 | Ship scope | Slice A + B (props/set pieces) |

---

## Acceptance sketches

1. **Basic:** Prop ON at Moment 10 (Scene 1) with notes “DSL”. At Moment 40 (Scene 3), in-play shows the prop with those notes. Source link `1.1.10` opens Moment 10 Detail.
2. **Re-ON / move:** Same prop re-ON at Moment 25 with notes “USR”. At Moment 40, source link opens Moment **25**, not 10.
3. **Off then on again:** OFF at 30, ON at 35. At Moment 40, source link opens 35.
4. **Next change:** At a moment between ON and a later re-ON/OFF, second link opens that later Moment. When no later event exists, only the source link shows.

---

## References

- Timeline deep-link consume: `frontend/src/pages/TimelinePage.tsx`
- Bookmark producer: `frontend/src/components/AppShell.tsx`
- Report producer: `frontend/src/pages/ReportsPage.tsx`
- In-play UI: `frontend/src/components/MomentDetailPanel.tsx`
- Derivation: `backend/app/services/asset_state.py`
- Phase 14 authoring decisions: [PHASE_14.md](../PHASE_14.md) (on/off, re-ON updates notes/person, state persists across scenes/acts)
