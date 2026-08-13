# Feature plan — Print & call sheets (rehearsal scene selection)

**Status:** Roadmap (approved intent — build eventually; not yet phased)  
**Created:** 2026-07-29  
**Related:** [character-nightly-packs.md](character-nightly-packs.md), [tech-week-chart-suite.md](tech-week-chart-suite.md), existing Reports, [PHASE_14.md](../PHASE_14.md), [PRE_AUGUST_STP_PREP.md](../PRE_AUGUST_STP_PREP.md) print polish

---

## Goal

Let a director (or SM) **select the scene(s) being rehearsed** and generate a **call / prep sheet**: who is needed, and which costumes, props, set pieces (and later lavs) are required for that slice of the show.

**Primary motivating UX:** “We’re working Act 1 Scenes 4–6 tonight.” One click produces a printable sheet: cast list for those scenes, props that appear, costumes worn, set pieces that move — so stage management can pull and actors know they’re on.

**Secondary motivating UX:** Improve **print CSS** on existing production-wide reports so paper/PDF-from-browser looks intentional.

**Tertiary motivating UX:** Optional “changes only” mode — only assets that **change** inside the selection (not the full static inventory).

---

## Problem

Directors think in **tonight’s scenes**, not “entire prop list for the musical.” Current reports are mostly production-wide. Actor prep packs are **one person × scenes**; call sheets are **scenes × company**.

---

## Product model (proposed)

### Inputs

| Input | Notes |
| ----- | ----- |
| **Scene selection** | Multi-select; act quick-picks; required |
| **Sections** | Cast, costumes, props, set pieces, cues (optional), lavs (later) |
| **Mode** | `everything in play` vs `events/changes in range` |

### Outputs

| Block | Derivation |
| ----- | ---------- |
| **Actors / characters called** | Anyone with lines, E/E, or asset involvement in range (define union clearly) |
| **Costumes** | Carry-in state at range start + wear/clear in range |
| **Props** | Same pattern via Phase 14 |
| **Set pieces** | Same pattern |
| **Cues** | Cue attachments on moments in range (existing cue model) |
| **Header** | Production, scene list, date blank line for handwriting, generated time |

### Relationship to actor prep packs

| Call sheet (this) | Actor prep pack |
| --- | --- |
| Company-facing | Person-facing |
| “Who/what do we need for these scenes?” | “What do *I* need for these scenes?” |
| Shared derivation APIs | Shared derivation APIs |

---

## Print quality bar

Applies to call sheets **and** upgrades to existing reports:

- Clear hierarchy (title → section → rows)
- Avoid cutting mid-row across pages (`break-inside: avoid` on rows)
- Landscape optional for wide tables
- “Printed from Theater Thing · {timestamp}” footer
- Hide app chrome on print

Existing report types to polish: props, cues, entrances/exits, blocking, lav matrix.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Reports | Production-scoped lists; some print CSS |
| Scene multi-select for reports | Not a call-sheet builder |
| Phase 14 | Can answer “in play” / events in range |
| Casting | Character → user for display names |

---

## Explicitly out of scope (v1)

- Calendar-integrated “tonight’s rehearsal” auto-fill
- Signed call confirmations / RSVP
- Equity-style formal call sheets with union fields
- Rich PDF generator library (browser print first)
- Live show calling

---

## Open questions

1. **Cast inclusion rule** — lines only, or any E/E, or any asset touch?  
   **Recommendation:** union of (spoken/lyric lines ∪ entrances/exits ∪ costume/prop/set involvement) in range, plus carry-in wearers of costumes still on.
2. **Group cast** — expand groups to member characters?  
   **Recommendation:** yes for call list.
3. **Nav home** — new **Call sheet** under Reports vs Prep?  
   **Recommendation:** under Reports next to other printables; actor packs separate entry.

---

## Done when

- Selecting ≥1 scene generates a correct company call sheet with cast + key assets.
- Print layout is usable on paper without app chrome.
- At least one pass of print polish landed on existing core reports.
- Derivation matches actor prep pack rules (no contradictory “in play” definitions).

---

## Suggested build sequence

1. Align derivation helpers with actor prep pack work (shared library).
2. Call sheet UI + print template.
3. Print CSS pass on existing reports.
4. Optional changes-only mode; cues section; lav section later.

---

## Risks / tradeoffs

- Duplicate of actor packs if UX copy is unclear — name carefully (**Rehearsal call sheet** vs **Actor prep**).
- Huge casts make sheets long — allow section toggles; default cast + props + costumes.
