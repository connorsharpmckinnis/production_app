# Feature plan — Lav assignment UX (Excel-competitive matrix)

**Status:** Shipped (UX polish — no PHASE doc; 2026-08-02)  
**Created:** 2026-08-02  
**Related:** [PHASE_12.md](../PHASE_12.md) (shipped matrix MVP), [lav-follow-ons.md](../feature_plans/lav-follow-ons.md) (Timeline markers / change-list — separate track), `frontend/src/pages/LavChartPage.tsx`, `backend/app/services/lav_chart.py`

**Owner decisions at build:** fill row/act = **all scenes** (not need-only); taken assets shown **disabled + “in use by X”** (may switch to hide later); **row locks only** (manual-edit guard). **Propose (2026-08-03):** full overwrite of the **active sheet** — one-shot starter chart, then manual tweak; does not preserve filled/locked cells.

---

## Goal

Make **assigning wires and packs** on the lav chart feel as fast and low-friction as maintaining a shared spreadsheet for that one job — especially the common case: **one person keeps the same wire/pack for most or all of the run**.

If booth operators bounce back to Excel for drag-fill and “who has Pack 3,” the Timeline/catalog benefits of the app get ignored for lav planning.

**Primary motivating UX:** “Crean gets Pack A for the whole show” → one action fills his row (or need scenes), and Pack A stops being an easy accidental pick for anyone else in those scenes.

**Secondary motivating UX:** Sheet toggle, Save/Propose, and assignment controls sit **next to the grid**, not buried above collapsed inventory/rules chrome.

**Tertiary motivating UX:** Optional lock so a settled row or act doesn’t get stomped by Propose or casual edits.

---

## Problem (current MVP)

| Friction | Today |
| -------- | ----- |
| Sheet toggle far from grid | Wires/Packs buttons live in the top toolbar; inventory + rules `<details>` sit between them and the table (inventory defaults **open**) |
| Cell-by-cell only | Every need-capable scene is its own `<select>`; no fill-row / fill-act / copy |
| No “taken” filtering | Dropdowns always list full catalog; double-assign only fails via conflict banner + blocked Save |
| No locks | Propose / edits can overwrite settled work; no row/scene protection |
| Wide shows | Many narrow selects; hard to scan; sticky actor column helps but chrome doesn’t |
| Propose is blunt | Always both sheets; persists immediately; no preview; overwrites without range control |

Data model is fine for v1: per-(wearer × scene) assignments + production wire/pack catalogs. This plan is mostly **interaction + small API helpers**, not a re-architecture. Timeline lav events / change-list stay in [lav-follow-ons.md](../feature_plans/lav-follow-ons.md).

---

## Product model (proposed)

### Layout chrome (WP1)

1. Collapse **Manage wires & packs** and **Rules** by default (or move inventory to a side panel / dialog).
2. Sticky **chart toolbar** immediately above the scrollable matrix:
   - Wires | Packs toggle
   - Save / Propose / Print (or keep Print in page header)
   - Compact conflict/warning count that scrolls with the toolbar
3. Optional: act-grouped column headers (`Act 1` spanning scenes) for orientation — cheap win for long shows.

### Bulk assignment (WP2) — Excel substitute without full spreadsheet engine

Row actions on the sticky actor label (or a small ⋮ menu):

| Action | Behavior |
| ------ | -------- |
| **Fill row →** | Set all scenes (or all *need* scenes — see open Q) to the value of the first selected / focused cell, or prompt “choose pack/wire” then fill |
| **Fill act** | Same, scoped to one act |
| **Clear row / clear act** | Set cells to — |
| **Copy from…** | Copy another row’s pattern, or copy previous scene’s column onto selected cells |

Keyboard / pointer stretch (nice-to-have after menus work):

- Shift-click or drag across contiguous cells in a row to set the same value (true drag-fill can wait if fill-row covers 90%).

**Recommendation:** Ship **Fill row (need scenes)** + **Fill act** + **Clear** first. Defer full Excel drag-handle until after a real booth session complains.

### Scene reservation / taken assets (WP3)

When opening a cell’s dropdown for scene S:

- Options = catalog minus assets **already assigned to another wearer in scene S** (current sheet).
- Still show the cell’s **current** value even if somehow conflicting.
- Optionally group options: “Available” vs “Used elsewhere this scene” (disabled), so operators see *why* Pack A is gone.

This is **UI reservation**, not a new DB entity. Server conflict hard-block on Save remains the source of truth.

**Not in v1 of this plan:** holding an asset with no wearer (“reserved empty slot”); org-wide checkout.

### Locks (WP4)

| Lock target | Effect |
| ----------- | ------ |
| **Row lock** | Cells in that wearer row not editable; excluded from Propose overwrite |
| **Scene / act lock** | Column(s) not editable; Propose skips those scenes |

**Recommendation for persistence:** store locks on the production (`lav_row_locks` / `lav_scene_locks` or a small JSON blob on production) so they survive reload — session-only locks are too weak for multi-device booth use.

Visual: lock icon on row header / act header; unlock requires explicit click (Director/Admin only — same as chart edit).

### Propose QoL (WP5 — small)

- Propose **active sheet only** (or checkbox: wires / packs / both).
- Optional: “Propose into unlocked empty cells only” so locks + manual work stick.
- Preview-before-persist can wait unless Propose keeps surprising people.

### Explicitly out of scope (this plan)

- Timeline lav Moments / change-list sheet ([lav-follow-ons.md](../feature_plans/lav-follow-ons.md))
- Real spreadsheet grid (Handsontable, etc.)
- Org inventory / CSV
- Configurable assignment rules UI
- Actor self-serve editing of lav chart
- Character prep packs

---

## Suggested work packages

### WP0 — Decisions (doc only)

Resolve open questions below; freeze v1 scope.

### WP1 — Chart chrome

- Scope: sticky toolbar with sheet toggle next to matrix; inventory/rules out of the way; optional act headers
- Files: `LavChartPage.tsx`, lav print CSS if toolbar print-hidden
- Done when: toggling Wires/Packs never requires scrolling away from the grid on a typical laptop viewport

### WP2 — Fill / clear row & act

- Scope: client-side bulk edit of local maps + dirty flag; reuse existing Save PUT
- Done when: assign one pack to a wearer for all need scenes in ≤2 clicks; undo via Clear or reload-before-save

### WP3 — Taken-in-scene filtering

- Scope: filter `<select>` options from current local maps; highlight both sides of a conflict if one still exists
- Done when: cannot casually pick an in-use pack/wire for the same scene without choosing a disabled/used option or clearing the other cell first

### WP4 — Locks

- Scope: persist row (and optionally act) locks; honor in UI + Propose
- Done when: locked row survives reload and is not changed by Propose

### WP5 — Propose scoping

- Scope: sheet selector + “empty unlocked only” mode
- Done when: can propose packs without wiping a hand-tuned wire chart

---

## Open questions

1. **Fill row default scope** — all scenes, or only **need** scenes (speak/sing), leaving silent scenes blank?  
   **Recommendation:** need scenes for packs; all scenes for wires (matches current propose heuristics: wires cover more broadly).

2. **Taken assets** — hide used options entirely, or show them disabled with “in use by X”?  
   **Recommendation:** show disabled + wearer label (Excel users want to *see* the conflict, not wonder where Pack 3 went).

3. **Locks — row only vs row + act?**  
   **Recommendation:** row locks in v1; act locks if cheap once row locks exist.

4. **Propose vs locks** — should Propose refuse entirely when any lock exists, or skip locked cells?  
   **Recommendation:** skip locked cells (and optionally skip non-empty cells).

5. **Authorize build now as a phase slice, or keep as feature plan until WP0 answers?**  
   **Recommendation:** answer Q1–Q4, then promote a thin PHASE / WP list for WP1–WP3 first (locks can follow).

---

## Risks / tradeoffs

- **Fake Excel expectations** — fill-row gets most of the win; chasing full drag-fill / multi-select ranges can balloon scope.
- **Propose + locks interaction** — easy to get surprising; document in-app near the Propose button.
- **Local dirty state** — bulk fills amplify “I edited then Propose wiped me”; WP5 empty-only + confirm copy matters more after bulk edit exists.
- **Conflict UX** — today issue attachment can highlight only one of two conflicted rows; fix while doing WP3.

---

## Suggested sequence

1. WP0 answers  
2. WP1 chrome (immediate relief, low risk)  
3. WP2 fill/clear (biggest Excel gap)  
4. WP3 taken filtering (stops double-book mistakes)  
5. WP4 locks + WP5 propose scoping  
6. Park true drag-fill / change-list / Timeline markers until after booth feedback

---

## Done when (overall)

A director can wire a typical cast for a show **mostly via fill-row + a few mid-show exceptions**, without scrolling to find the Packs toggle, without fighting full-catalog dropdowns, and without Propose casually destroying settled rows — at least as fast as maintaining the same matrix in a shared sheet for that workflow.

---

## Follow-ups (performance)

**Shipped 2026-09-04 — inventory form state isolation:** Add-wire / add-pack / edit-dialog draft fields live in local child state (`InventoryColumn`, `EditInventoryDialog`) so typing no longer re-renders the full assignment matrix. Parent only receives values on Add/Save.

**Shipped 2026-09-04 — local catalog patch on add/edit:** Create/update wire or pack uses the API response to patch `chart.wires` / `chart.packs` only. Does **not** call full `loadChart()` / `applyChart`, so assignment maps and unsaved cell edits stay intact. Full reload remains for first load, Save chart, Propose, Retry, and delete (cells may clear server-side).

**Deferred if still needed:**
- Extract `LavChartGrid` + `React.memo` so other page chrome (sheet toggle, menus, dialogs open/close) does not thrash the matrix.
- `useMemo` conflict detection; build Select option lists only when a cell menu is open.
- Virtualization only if scrolling/editing the grid itself stays slow on long shows.

App-wide review of dense forms/charts parked in [UX_UI_IMPROVEMENTS.md](../UX_UI_IMPROVEMENTS.md) Wish list.

---

## Shelved — future interaction models (2026-09-04)

**Status:** Ideas only. Current matrix + local catalog patch is **acceptable** for now; revisit if booth use or longer shows make cell density painful again.

**Core jobs to preserve:** propose a starting chart; assign wire/pack per wearer×scene; fill row/act; see conflicts / taken assets; print; manage catalog.

### Incremental (same matrix shape, cheaper cells)

1. **Native `<select>` or text chip + one shared picker** — Drop per-cell Radix Select. Cells are plain labels; click opens one portal/popover with the catalog (or a native select). Cuts hundreds of heavy widgets to ~N×M light nodes + one editor.
2. **Options only when open** — Keep Radix but don’t build `catalog.map` until that cell opens.
3. **Memoized row/cell** — Only the edited cell re-renders; shared option list.

### Structural (change how the page works)

4. **Row-first editor (spreadsheet-lite)** — Matrix is **read-only text** (color/conflict dots). Editing happens in a side panel or row sheet: “Crean — Act 1” with a short list of scene assignments or one “Pack A for all / exceptions.” Matches how people think (“same pack all night”) better than 40 dropdowns.
5. **Paint / stamp mode** — Pick one wire/pack once (“holding Pack A”), then click cells or drag across a row to apply. Zero per-cell menus; conflicts update as you paint.
6. **Run-length / span model** — Store “Crean has Pack A from scene 1–12, Pack B from 13–end” instead of one value per scene. UI edits spans; grid is a visualization. Far fewer editable controls; bigger data/API change.
7. **Exception-only UX** — Default = Propose output or “same as previous scene.” Operators only open cells that differ (booth changes). Most cells never become interactive widgets.
8. **Split screens** — Inventory + Propose on one view; assignment grid on another (or print-first grid with sparse edit). Matrix never mounts during catalog churn.
9. **Canvas / virtualized sheet** — One canvas or windowed table for very wide shows. Only if N×M grows past what light DOM can handle.

### Recommendation when revisiting

Try **(1) or (5)** first for biggest snappiness/UX win without schema change; consider **(4)** if fill-row is already 80% of the workflow. Park **(6)** until Timeline lav events / change-list in [lav-follow-ons.md](../feature_plans/lav-follow-ons.md) force a richer model anyway.
