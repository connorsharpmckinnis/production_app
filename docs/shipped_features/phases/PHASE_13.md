# Phase 13 — Retire Timeline Microphones (Lav Chart Owns Lavs)

**Status:** Complete (2026-07-26) — WP-slim shipped; derivation follow-on documented below

**Goal:** Remove the Timeline `microphones` / `moment_microphones` system. Production lav planning lives only on the **Lav chart** (wires + packs). Document the future **derived Timeline change Moments** path without building it in this WP.

---

## Owner Decisions (confirmed 2026-07-26)

| Topic | Decision |
| ----- | -------- |
| **Timeline end-state** | Derived-only from lav chart (not a second manual attach UI) |
| **What directors see on Moments (goal)** | When a wire or pack **changes** for an actor — as a Moment (notes optional). Not built in WP-slim. |
| **Existing mic data** | Drop — not concrete yet |
| **Non-lav mics** | Out of scope |
| **Nav** | Drop Microphones; Lav chart only; Director/Admin only |
| **This WP** | **WP-slim:** remove Timeline mic surfaces + APIs + tables; retarget readiness; document derivation follow-on |

---

## WP-slim scope (this phase)

1. Drop `moment_microphones` and `microphones` tables (migration).
2. Remove mic catalog API, moment attach/detach, CSV import, Timeline filter/badge/detail UI, Microphones page/nav.
3. Retarget Overview readiness soft dimension from microphones → lav chart (wires/packs inventory + assignment coverage).
4. Update docs; keep lav chart as staff-only.
5. Record derivation follow-on in this doc (+ GitHub issue if `gh` available).

### Explicitly out of WP-slim

- Generating Timeline Moments from lav chart diffs
- Editable Timeline lav events
- Handheld / podium mics
- Org-wide wire/pack inventory

---

## Follow-on — Derive Timeline lav changes from the lav chart

**Status:** Planned, not started  
**Depends on:** Lav chart assignments stable (Phase 12)

### Product intent

Lav chart remains the **editable source of truth** (who wears which wire/pack in which scene).

Timeline should **display** (and later lightly annotate) **change events** derived from that chart, so tech can scrub the script and see “here Connor gets Pack 3 / loses Pack 1” without re-entering the same plan on Moments.

### Suggested derivation rules (v1 when built)

1. Order scenes by act/scene sort.
2. For each lav-chart wearer row, walk consecutive scenes and compare wire_id / pack_id cells.
3. When wire or pack **changes** (including null → assigned, assigned → null, or A → B) between scene N−1 and scene N, create or refresh a derived prep marker on a Moment in scene N:
   - Prefer the **first Moment** of the scene (or a dedicated moment type later).
   - Payload: wearer (user/character), asset kind (wire|pack), from_id, to_id, optional auto note (“Pack P1 → P3”).
4. Intermission-only changes are still “changes” at the first scene of the next act.
5. Re-running derivation after chart save **replaces** previously derived lav-change rows for that production (humans don’t manually invent the assignment; notes on derived rows may be preserved if we add a `notes` field later).
6. Timeline filters/badges: `has_lav_change` / filter by wire or pack id from chart inventory.
7. Moment detail: list derived changes for that moment/scene; link “Edit on Lav chart.”

### Non-goals for derivation v1

- Mid-moment timing finer than scene boundary (unless booth demands it later)
- Auto-creating Moments that alter sacred script text
- Syncing the other way (Timeline → chart)

### Tracking

- **Primary:** this section in [PHASE_13.md](PHASE_13.md) (GitHub CLI was unavailable when WP-slim shipped — open issue from this title when convenient).
- Suggested issue title: **Derive Timeline lav wire/pack change Moments from lav chart**
- Scratch / PRE_AUGUST: character packets remain after lav Timeline integration if desired.

---

## Definition of Done (WP-slim) ✅

1. No Microphones nav or page; Lav chart remains Director/Admin-only.
2. No `microphones` / `moment_microphones` tables or APIs (migration `017`).
3. Timeline has no mic filter, badge, or moment attach section.
4. Readiness soft dimension points at lav chart (`lav_chart`), not microphones.
5. CSV catalog no longer lists microphones.
6. Derivation plan documented in this file (open GitHub issue when `gh` is available).
7. Phase 12 lav chart still works.

---

## Decision Log

| Date | Decision |
| ---- | -------- |
| 2026-07-26 | WP-slim authorized; drop mic data; derivation documented not built |
| 2026-07-26 | Goal-state: derived change Moments on Timeline from lav chart |
| 2026-07-26 | WP-slim complete: tables dropped (017), APIs/UI removed, readiness → `lav_chart` |
