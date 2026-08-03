# Feature plan — Actor prep packs (scene-scoped)

**Status:** Far-future (v2+ / post first full show·season) — **do not phase or build now**  
**Created:** 2026-07-29  
**Parked:** 2026-08-02 — owner decision: wait until the system has been used for at least one whole show/season before reconsidering  
**Related:** [STP_PRODUCT_OVERVIEW.md](../STP_PRODUCT_OVERVIEW.md) idea #1, [PHASE_14.md](../PHASE_14.md) (derived asset state), [print-and-call-sheets.md](print-and-call-sheets.md), [in-play-moment-deep-links.md](in-play-moment-deep-links.md)

---

> **Parking note:** This remains a valid long-term product idea (actor × selected scenes → printable prep handout). It is **not** near-term roadmap. Prefer call sheets / print polish / lav UX / pilot learning first. Revisit only after real-show validation, or if STP explicitly asks for actor packs over other sheets.

---

## Goal

Give an **actor (or their character)** a printable / mobile-friendly **prep pack for selected scene(s)** — not a vague “whole show tonight” dump.

**Primary motivating UX:** Director or actor picks Character = Crean and Scenes = Act 2 Scenes 3–5 (tonight’s call). The pack shows only Crean’s line reminders / cue context, entrances & exits in that range, costumes worn, props they handle, and set pieces they move — ready to print or glance at on a phone before rehearsal.

**Secondary motivating UX:** Actor opens their own cast view, selects “My scenes for Sunday,” and gets a personal checklist without hunting Timeline filters.

**Tertiary motivating UX:** Same engine powers a thinner “lines only” or “changes only” mode when the full pack is too much.

---

## Problem

STP idea #1 was framed as a per-character “what do I need tonight?” pack. That framing is fuzzy:

- “Tonight” is not a first-class concept in the app (no rehearsal calendar yet).
- A full-show character dump is often **too big** to be useful and overlaps poorly with Rehearse.
- What’s actually useful is **scope + person**: “for these scenes, what does *this* actor need?”

Existing tools don’t close the gap:

| Today | Limitation |
| --- | --- |
| Timeline character filter | Live browsing, not a pack / print surface |
| Rehearse modes | Lines/practice, not props/costumes/entrances checklist |
| Reports | Production-wide sheets, not actor × scene range |
| Phase 14 in-play state | Moment-local; not aggregated into an actor handout |

---

## Product model (proposed)

### Inputs

| Input | Notes |
| ----- | ----- |
| **Character** (required) | One character per pack for v1. Optionally resolve to cast actor name for the header. |
| **Scene selection** (required) | Multi-select scenes, or an act, or “all scenes.” Default empty → force explicit pick (avoid accidental full-show monsters). |
| **Pack sections** (toggles) | Which blocks to include (see below). |

### Output sections (each filterable to the character + scene range)

| Section | Content (derived) |
| ------- | ----------------- |
| **Header** | Production, character, actor name if cast, scene list, generated timestamp |
| **Line reminders** | Spoken lines / lyric lines for that character in range, with preceding cue line optional |
| **Entrances / exits** | Structured E/E in range for that character |
| **Costumes** | Costumes with wear/clear events intersecting the range (Phase 14 `moment_costume_events` + derived state) |
| **Props** | Props they take / hand off / hold via events in range |
| **Set pieces** | Set pieces they move / place via events in range |
| **Notes** (optional) | Public notes on their moments in range — off by default |

**v1 recommendation:** ship with sections: header, lines (with previous-line cue), entrances/exits, costumes, props. Set pieces + notes as easy toggles if data is already available.

### Relationship to call sheets

| Pack (this doc) | Call sheet ([print-and-call-sheets.md](print-and-call-sheets.md)) |
| --- | --- |
| One character × selected scenes | Selected scenes × **everyone / everything** needed |
| Actor-facing personal checklist | Stage-manager / director rehearsal call |

Share derivation helpers (who’s in scenes, assets in play) but keep **two UIs / two print templates**.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Character filter on Timeline | Single-character filter exists |
| Multi-select scenes | Not a first-class “pack builder” |
| Phase 14 asset events | Props / sets / costumes on/off; derived `asset_state` |
| Entrances / exits | Structured on moments |
| Print | Some reports have print CSS; no actor pack route |
| Actor identity | Casting links users ↔ characters |

Relevant systems: Timeline moments, casting, Phase 14 event tables + `asset_state.py`, existing Reports print patterns, Rehearse line helpers.

---

## Proposed UX

1. Nav entry under production: **Prep pack** (or under Reports: **Actor prep**).
2. Form: Character picker → Scene multi-select (with Act quick-picks) → section toggles → **Generate**.
3. On-screen pack (readable on phone) + **Print** (CSS `@media print`).
4. Deep link optional later: `?character=&scenes=1,2,3` for “send this to Crean.”

Actors: can generate packs for **their cast characters** only. Directors/Admins: any character.

---

## Explicitly out of scope (v1)

- Rehearsal calendar / “tonight” auto-detection (see [scheduling-and-attendance.md](scheduling-and-attendance.md))
- Multi-character packs in one PDF
- PDF export suite (print-to-PDF from browser is enough)
- Understudy swap logic ([understudies-and-cast-overrides.md](understudies-and-cast-overrides.md))
- Editing Timeline from the pack (read-only handout)
- Competing with Rehearse as a practice mode

---

## Open questions

1. **Cue context for lines** — one previous spoken line, N lines, or scene-header only?  
   **Recommendation:** one previous spoken line (or stage direction if no prior line).
2. **Costume/prop “in play at scene start”** — include assets already held entering the first selected scene, or only events *inside* the range?  
   **Recommendation:** include **carry-in state** at the first moment of the selection (Phase 14 derivation), plus events inside the range — otherwise packs miss “you’re already wearing X.”
3. **Group membership** — if character is in a group entrance, show it?  
   **Recommendation:** yes, list group E/E that include the character.
4. **Name** — “Nightly pack” vs “Actor prep” vs “Character pack”?  
   **Recommendation:** **Actor prep pack** in UI; keep filename slug for history.

---

## Done when

- User can select character + ≥1 scene and see a correct filtered pack.
- Carry-in asset state at range start is correct for costumes/props (and set pieces if included).
- Print layout is usable on letter paper without cutting off sections.
- Actors cannot generate packs for characters they are not cast as.
- Shared derivation does not invent a second source of truth for Timeline data.

---

## Suggested build sequence (when phased)

1. Read-only API: `character_id` + `scene_ids[]` → structured pack JSON (lines, E/E, assets).
2. Web view + print CSS.
3. Section toggles + cue-line option.
4. Actor self-service + shareable query-string link.

---

## Risks / tradeoffs

- **Overlap with call sheets** — mitigate by shared backend, distinct UI copy.
- **Full-show packs feel useless** — mitigate by requiring scene selection (or warning on “all scenes”).
- **Derivation bugs show up loudly on paper** — treat pack correctness as a Phase 14 consumer test.
