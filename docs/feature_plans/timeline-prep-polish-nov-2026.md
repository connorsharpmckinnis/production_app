# Feature plan — Timeline / prep polish (Nov 2026)

**Status:** Roadmap (mostly shipped 2026-11-07; WP4 shell + full Object Detail migration still open)  
**Created:** 2026-11-07  
**Context:** Harden the existing Timeline + Moment Detail system before starting new verticals (casting, catalogs, tasks).

---

## Goal

Make Timeline prep denser and more consistent: move attachments between Moments via the Timeline itself, fix Moment Detail attachment-type layout, strip AI-ish section subtitles, fix light-mode character color chips, lightly align Moment Detail with Object Detail shell patterns, and track full Moment→Object Detail migration as a GitHub milestone.

---

## Locked decisions

| Topic | Decision |
| ----- | -------- |
| Move destination UX | Enter move mode from an attachment; **click a Timeline moment row** as destination (read while choosing; no search required). |
| Attachment types | All seven: props, set pieces, costumes, cues, entrances, exits, blocking. |
| Conflict on destination | Reject with a clear error if uniqueness would break. |
| Add-to-moment buttons | Up to **2–3 rows**; equal-width cells that fill the container; **hide types with nothing to attach** without leaving ghost columns (no fixed `grid-cols-7`). |
| Moment → Object Detail | **Now:** shell alignment only (shared patterns; keep co-planar Timeline inspector). **Later:** full host migration + focus/select behavior — tracked as GH milestone. |
| Section sub-text | **Remove** subtitle-like helper lines almost everywhere unless truly protective guidance (prefer different UX if needed). |
| Scroll-back arrow | **Leave alone** (browser-native smooth scroll; no custom duration). |
| Character color chips | In light mode, swatches use the **same bright accent** as the highlight border/text, not the dark-mode-looking muted tint. Tokens live with other color CSS for easy tweaking. |

---

## Work packages

### WP0 — Character color chips (light mode) + token placement — **done**
- Light-mode `--char-*` accents brightened; documented next to moment tokens in `index.css`.

### WP1 — Add-to-moment type button layout — **done**
- Dynamic equal-width grid; no ghost columns for hidden types.

### WP2 — Strip section sub-text — **done**
- Removed subtitle helpers on Character Detail, Display prefs, Rehearsal, Settings, Lav, Groups/People, etc.

### WP3 — Move attachment via Timeline row
- **Implemented 2026-11-07:** all seven attachment types can be moved with a
  single production-scoped transfer endpoint. Destinations may be any Moment in
  the same production (not limited to the source scene); the Timeline row
  interaction makes cross-scene moves available without a separate picker.
- Backend: transfer attachment to another moment in the same production (prefer same scene for v1 UX; confirm if cross-scene allowed).
- Frontend: “Move” on attachment → move mode banner → next Timeline row click commits (Esc/cancel clears mode).
- Refresh source + destination; surface uniqueness errors.

### WP4 — Moment Detail shell alignment (partial)
- Align close/dirty/resize patterns with Object Detail where cheap.
- Do **not** route Moments through `ObjectDetailHost` yet.
- GH milestone covers full migration (focus collapse, selection, host, URL sync).

### Explicitly out of scope
- Scroll-back arrow timing changes
- Drag-and-drop attachments
- Split/merge Moments
- Full Object Detail host migration (milestone only)
- Tasks / casting / org catalogs / AI

---

## Suggested sequence

1. WP0 + WP1 + WP2 (fast UI)
2. WP3 (main product value)
3. WP4 + GH milestone issues

---

## Related

- Emmy leftover “move to another Moment”: [emmy-directors-feedback-sept-2026.md](emmy-directors-feedback-sept-2026.md)
- Object detail deferred migration: [object-detail-pages.md](../shipped_features/object-detail-pages.md)
- Issue #127 (Moment Detail → object-detail host) — fold into new milestone
