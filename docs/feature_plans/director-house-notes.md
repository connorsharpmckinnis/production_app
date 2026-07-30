# Feature plan — Director notetaking ease (house / mobile)

**Status:** Roadmap (approved intent — build eventually; not yet phased)  
**Created:** 2026-07-29  
**Related:** [STP_PRODUCT_OVERVIEW.md](../STP_PRODUCT_OVERVIEW.md) idea #4, [PROJECT.md](../PROJECT.md) wish list (real-time note-flagging, mobile interface), Notes model, Timeline deep links, [app-announcements.md](app-announcements.md) (not this)

---

## Goal

Let a director (or SM) **take notes from the house or aisle** with minimal friction: stay aligned to the current Moment, capture a short note (tap or dictate), and return eyes to the stage.

**Primary motivating UX:** Phone in hand during a run. Tap through Moments as the show progresses (or let an assistive follower suggest the Moment). Tap mic → dictate “tighten the cross on ‘iceberg’” → note lands on that Moment as a private (or public) note.

**Secondary motivating UX:** Fast “flag this Moment” without opening full Moment Detail chrome — one-thumb note composer.

**Tertiary motivating UX (stretch):** **Auto-listener / follow-along** that advances the selected Moment by matching spoken dialogue (or approximate progress) so the director doesn’t manually tap every line.

---

## Problem

Laptop Timeline prep is strong; **in-rehearsal capture** is weak. Directors currently leave the room in their head to type notes later, or scribble on paper and lose the Moment link. Mobile is usable but not optimized for “eyes up, thumb down.”

---

## Product model (proposed) — layered

Build as **layers**; each layer is useful alone.

### Layer 1 — Mobile house mode (do first)

| Element | Behavior |
| ------- | -------- |
| **House mode** route | `/productions/:id/house` (or Rehearse-adjacent) — large tap targets, minimal chrome |
| **Moment strip** | Current moment text prominent; prev/next big buttons; optional scene jump |
| **Add note** | One field + save; default visibility Director-private; optional public |
| **Offline-ish** | Best-effort: queue note if network blips (nice-to-have, not v1 blocker) |

### Layer 2 — Dictation

| Element | Behavior |
| ------- | -------- |
| **Speech-to-text** | Use browser / OS dictation (`webkitSpeechRecognition` or platform equivalent) where available |
| **Fallback** | Keyboard always works; no server-side audio upload in v1 |
| **Privacy** | Client-side STT only for v1; document browser permission prompts |

### Layer 3 — Follow-along assist (curiosity-grade until proven)

| Approach | Notes |
| -------- | ----- |
| **A. Manual tap-through (baseline)** | Director advances Moments; simplest, most trustworthy |
| **B. Timed / estimated pace** | Weak without durations |
| **C. Dialogue listening** | Mic listens to stage; fuzzy-match next expected line; auto-advance with easy undo | High value, high error risk, privacy/consent issues in a room |

**Recommendation:** Ship Layers 1–2 firmly. Treat Layer 3 as **experimental** behind a flag; default off; always show “suggested Moment” with one-tap confirm rather than silent auto-advance.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Notes | On Moment Detail; public/private; Actors always private |
| Mobile | Responsive but not house-optimized |
| Dictation | None |
| Auto follow | None |
| Deep links | `?scene=&moment=` |

---

## Permissions

- Creating notes: existing rules (Director/Admin public|private; Actor private only).
- House mode: anyone who can view Timeline + add notes; **optimize UX for Director**.
- Auto-listener: Director/Admin only if ever shipped.

---

## Explicitly out of scope (v1)

- Server-side audio storage / transcription vendors
- Multi-director conflict-free real-time cursors
- Replacing Stage Write prompt books
- Live show calling / cue lights
- Full offline PWA guarantee

---

## Open questions

1. **Default note visibility in house mode?**  
   **Recommendation:** private to author; one toggle for “visible to cast.”
2. **Auto-listener consent** — cast/mic privacy in the room?  
   **Recommendation:** if built, require explicit opt-in each session; no audio leaves device in v1.
3. **Reuse Rehearse UI vs new House mode?**  
   **Recommendation:** new House mode — Rehearse is actor-practice-shaped; don’t overload it.
4. **Flag without text?**  
   **Recommendation:** allow empty body with a “flag” tag/preset (“look at this”) if notes require text today — or require one character minimum; decide when implementing against Note model constraints.

---

## Done when (Layer 1–2)

- Director can run a scene from a phone, advance Moments with large controls, and add dictated or typed notes bound to the selected Moment.
- Notes appear in normal Timeline/Moment Detail afterward.
- Works on current iOS/Android browsers you care about for STP (document tested browsers).

**Layer 3 done when (later):** suggested-Moment assist is correct often enough to help, with trivial undo and no silent wrong-Moment notes.

---

## Suggested build sequence

1. House mode UI + moment navigation + note composer.
2. Dictation button where STT exists.
3. Polish: keep-awake, contrast, landscape.
4. Experimental follow-along prototype (flagged).
5. Evaluate with a real STP run before promoting Layer 3 to default.

---

## Risks / tradeoffs

- Auto-listener wrong Moment = notes attached to wrong place — **confirm before save** if auto-advanced.
- Dictation quality in a noisy house — always allow type/edit before save.
- Scope creep into full mobile app — stay mobile-web until proven.
