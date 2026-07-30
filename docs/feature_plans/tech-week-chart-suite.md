# Feature plan — Tech-week chart suite

**Status:** Roadmap (approved intent — build eventually; not yet phased)  
**Created:** 2026-07-29  
**Related:** [SCRATCH_NOTES.md](../SCRATCH_NOTES.md) Report Ideas, [PHASE_12.md](../PHASE_12.md) lav matrix, [PHASE_13.md](../PHASE_13.md) lav follow-ons, [PHASE_14.md](../PHASE_14.md), [print-and-call-sheets.md](print-and-call-sheets.md), [character-nightly-packs.md](character-nightly-packs.md)

---

## Goal

Ship a small family of **visual tech-week charts** that answer “who/what is where across the show?” better than tables alone — especially **horizontal timeline visuals** for characters, set, and break/quick-change risk.

**Primary motivating UX:** Character burn-down — rows = characters, columns = show time / scenes; color blocks show on-stage presence; icons mark costume/prop/mic change points. Printable for the booth.

**Secondary motivating UX:** Break-time / quick-change chart — highlight dangerously short off-stage gaps so directors protect actors (and avoid impossible mic swaps).

**Tertiary motivating UX:** Set-change chart — set pieces on a horizontal timeline with on/off / move markers from Phase 14 events.

---

## Problem

Scratch notes already name three charts people want at a glance. Lav **assignment** matrix shipped (Phase 12); lav **change-list** did not. Tables and Overview counts do not replace a spatial “whole show” picture during tech.

Stage Write owns ground-plan blocking visuals. **We own derived Timeline truth as charts** — different gap.

---

## Chart family (roadmap)

| Chart | Question it answers | Data source |
| ----- | ------------------- | ----------- |
| **Character burn-down** | Who is on when? Where are change spikes? | Entrances/exits (+ optional costume/prop/mic markers) |
| **Break-time / quick-change** | Who has almost no off-stage time? | Derived gaps between exit→next entrance (and optional costume/mic events in gap) |
| **Set-change** | What set moves when? | Phase 14 set-piece events |
| **Lav change-list** | Who swaps wire/pack when? | Future lav Timeline events + Phase 12 assignments ([lav-follow-ons.md](lav-follow-ons.md)) |

Treat lav change-list as part of this suite narratively, but implement with lav follow-ons when Timeline lav events exist.

---

## Visual direction (important)

Improve **visual** quality over current report tables:

- Horizontal time axis aligned to **scenes** (v1) or moment index; full continuous time only if we later add durations.
- One row per entity (character / set piece).
- On-state as solid bars; events as ticks/icons.
- Print-first CSS: landscape letter, high contrast, legend.
- Hover/tap detail on screen; print shows icon key.
- Avoid dashboard chrome clutter — one chart per view, one job.

**v1 recommendation:** scene-column burn-down first (highest wow per effort). Break-time second (unique STP value). Set-change third. Lav change-list when lav events exist.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Lav matrix | Shipped; print OK; not a change timeline |
| Entrance/exit reports | Tabular |
| Phase 14 events | Props/sets/costumes on/off |
| Scene summary chips | Read-only; no burn-down |
| Moment durations | Not modeled — scene sequence is the honest axis |

---

## Product model (proposed)

### Shared chart engine ideas

- Input: production_id, optional act filter, optional character subset.
- Build a **scene-ordered spine**.
- For characters: derive on-stage intervals from E/E (same rules as “who’s on”).
- Overlay markers from costume/prop/mic events when those exist.
- Break-time: for each character, compute off-stage gaps; flag gaps below threshold (configurable minutes **or** “fewer than N intervening moments/scenes” if clock time absent).

**Without wall-clock duration:** define quick-change risk as **fewer than N scenes** or **fewer than M moments** between exit and next entrance — document the heuristic honestly.

---

## Explicitly out of scope (v1)

- Live show-calling / auto-scrolling during performance
- Ground-plan / stage diagram ([stage-diagram-blocking.md](stage-diagram-blocking.md))
- Pixel-perfect PDF suite (browser print is fine)
- Real-time multi-user co-editing of charts
- Replacing Stage Write spacing charts

---

## Open questions

1. **Time axis** — scenes only vs proportional duration fields later?  
   **Recommendation:** scenes (and act breaks) for v1.
2. **Quick-change threshold** — scene-count heuristic vs require duration data?  
   **Recommendation:** scene/moment heuristic + clear legend (“gap &lt; 1 scene”).
3. **Who can see charts?** All production members, or Directors+ only?  
   **Recommendation:** Directors/Admins for break-time (sensitive); burn-down visible to cast optional.
4. **Mic markers on burn-down** before lav Timeline events?  
   **Recommendation:** omit mic ticks until lav follow-ons; costume/prop ticks OK from Phase 14.

---

## Done when

- At least character burn-down renders correctly from E/E and prints in landscape.
- Break-time chart flags short gaps with an explained heuristic.
- Charts use Timeline as single source of truth (no parallel manual chart data entry).

---

## Suggested build sequence

1. Shared “scene spine + character on-intervals” API.
2. Burn-down UI + print.
3. Break-time view + threshold setting.
4. Set-change view.
5. Lav change-list when lav events ship.

---

## Risks / tradeoffs

- Visual charts invite Stage Write comparisons — stay Timeline-derived, not ground-plan.
- Wrong E/E data makes charts worse than useless — pair with Overview readiness for E/E coverage.
- Overbuilding a chart framework — ship one excellent burn-down before abstractions.
