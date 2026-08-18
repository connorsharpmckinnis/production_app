# Feature plan — Character on-stage presence chart (prototype)

**Status:** Prototype shipped 2026-08-18 (evaluate usefulness before expanding the tech-week chart suite)  
**Created:** 2026-08-18  
**Related:** [tech-week-chart-suite.md](tech-week-chart-suite.md), [SCRATCH_NOTES.md](../SCRATCH_NOTES.md) Report Ideas, Phase 5 entrance/exit reports, [on_stage.py](../../backend/app/services/on_stage.py)

---

## Goal

Find out whether a **horizontal show-timeline chart** is worth building for other production views (costumes, props, set, break time) by shipping **one** real chart: **who is on stage, when**, derived from existing entrance and exit records.

This is a concept test, not the full tech-week suite. If the chart is hard to read, unused, or misleading, we stop here. If it is useful, we reuse the pattern.

**Primary motivating UX:** A Gantt-like strip chart. X-axis = the show from Act 1 (left) through later acts (right), with act and scene marks. Y-axis = one **narrow** row per character. A thin colored bar appears while that character is on stage (entrance → exit). Hovering a bar shows who it is and the entrance/exit points.

---

## Why this slice

Scratch notes and the tech-week suite both want a character “burn-down.” The existing **Entrances & exits** report already has the source events, but as a scene-grouped list it cannot answer “who is on across the whole show?” at a glance.

We already derive on-stage presence per moment (`on_stage.py`). The prototype **compresses that into intervals** and draws them.

---

## Locked decisions for this prototype

| Topic | Decision | Why |
| ----- | -------- | --- |
| Placement | New **Reports** section (`#report-on-stage-chart`), Directors/Admins only, same as other reports | Matches “try it next to Entrances & exits”; no new nav item |
| Time axis | **Equal width per moment** (flattened timeline index). Act bands on top, scene numbers under them | Shows enter/exit *inside* a scene; scene-column occupancy would hide mid-scene exits |
| Presence rules | **Same as Timeline:** scene-scoped; entrances then exits on a moment; presence does **not** carry across a scene break | One source of truth; a character still on at scene end is drawn through the last moment of that scene only |
| Rows | Characters with at least one entrance or exit, sorted by name | Empty rows would clutter a concept test |
| Chart library | **None** — HTML/CSS bars | Project has no chart dependency; avoid framework cost for a maybe-keep view |
| Markers | No costume / prop / mic icons | Prove presence first; icons are the suite’s later overlay |
| Print | Inherit Reports print; do not special-case landscape yet | Screen evaluation first |
| Duration | No wall-clock time | Moments have no duration field |

**Scene-break behavior (call this out in the UI):** if CREAN enters in Scene 1 and never exits, the bar ends at the last moment of Scene 1. Scene 2 starts empty unless they enter again. That is existing Phase 5 / Phase 14 policy, not a chart invention.

---

## Product model

### API

`GET /api/productions/{id}/reports/on-stage-chart`

Director/Admin + production access. One payload:

- `moment_count` — length of the flattened spine
- `acts[]` — `{ act_number, act_title, start_index, moment_count }`
- `scenes[]` — `{ scene_id, act_number, scene_number, scene_title, start_index, moment_count }`
- `characters[]` — `{ character_id, character_name, intervals[] }`
- each interval — `start_index`, `end_index` (exclusive), entrance moment ref + notes, optional exit moment ref + notes, `ends_at_scene_boundary`

Indexes are 0-based positions on the show-wide moment spine (act sort, scene sort, sequence).

### Interval rules

Walk each scene’s moments in order (reset the on-stage set at every scene):

1. Apply all **entrances** on a moment, then all **exits** (same as `on_stage.py`).
2. Opening an interval: character not currently on → start at this moment’s spine index.
3. Closing on an **exit**: `end_index` = that moment’s index (bar’s right edge is the exit). Same-moment enter+exit → one-moment-wide bar (`end_index = start_index + 1`).
4. Still on at scene end → close at the first index of the next scene (or `moment_count`), `ends_at_scene_boundary: true`, no exit ref.

Unmatched exits (exit without a prior entrance in that scene) are ignored, same as Timeline.

### UI

- Sticky character names on the left; horizontal scroll if the show is long (`min-width` from moment count).
- Narrow rows; bar is a short rounded strip, not a tall block.
- Act band + scene-number band above the tracks; vertical scene boundaries.
- Hover/focus tooltip: character name, entrance (act.scene.sequence + notes), exit or “end of scene (no recorded exit)”.
- Clicking a bar opens Timeline at the **entrance** moment (existing human deep link).
- Short legend explaining scene reset.
- Empty copy if there are no entrance/exit records.

---

## Explicitly out of scope

- Break-time / quick-change highlighting
- Set-change or costume/prop/mic overlay icons
- Scene-column occupancy mode (the suite’s original v1 sketch — different question)
- Actor-facing chart
- Filters (act, character subset)
- Chart.js / Recharts / D3
- PDF / landscape print polish
- Carrying presence across scene breaks
- Editing E/E from the chart

---

## Done when

- Directors can open Reports, jump to **On-stage chart**, and see one row per character who has E/E data.
- Bars match Timeline on-stage rules on a fixture with enter, mid-scene exit, same-moment enter+exit, and a scene boundary with no exit.
- Hover names the character and the entrance/exit (or scene-end).
- Act and scene numbers are readable on the X-axis.
- No new npm/Python visualization dependency.

---

## How to judge the prototype

After using it on a real (or Endurance) script with E/E filled in, decide:

1. **Keep and extend** — pattern is useful; next could be filters, print, or a second entity (set pieces).
2. **Keep as-is** — helpful next to the E/E list; do not build the rest of the suite yet.
3. **Change the axis** — moment-equal is too spiky / too sparse; try scene columns instead.
4. **Drop** — lists are enough; archive this section.

---

## Suggested build sequence

1. This plan. **Done.**
2. Pure interval assembler + report endpoint + pytest. **Done.**
3. Reports section + chart component + hover. **Done.**
4. Closeout notes (scratch + suite plan pointer). **Done.**

## Shipped slice (2026-08-18)

- Plan: this file.
- API: `GET /api/productions/{id}/reports/on-stage-chart` (Director/Admin).
- UI: Reports → **On-stage chart** (first TOC item). Narrow color bars, act/scene axis, hover tooltip, click to entrance moment.
- Presence: scene-scoped, same rules as `on_stage.py`.
- Not shipped: costume/prop/mic icons, break-time, scene-column mode, print polish, chart library.

---

## Risks

- Sparse E/E data makes a mostly empty chart — that is also a readiness signal.
- Long shows + many characters: interval payload stays small; DOM is one bar per interval, not one cell per moment.
- Equal-moment width is not “clock time”; a short scene with many moments looks long. Honest for now.
- Scene reset will surprise anyone who expects “never exited = still on in the next scene.” Legend must say so.
