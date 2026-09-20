# Feature plan — Rehearsal capture, Moment notes, and suggested→official actions

**Status:** Shipped 2026-09-19  
**Created:** 2026-09-19  
**Updated:** 2026-09-19  
**Related:** [rehearsal-management.md](rehearsal-management.md) (shipped Phases 15–18), [director-house-notes.md](director-house-notes.md), [tasks-and-mentions.md](tasks-and-mentions.md), [crew-roles.md](crew-roles.md), [ROLES.md](../ROLES.md), [DATABASE.md](../DATABASE.md)

---

## Goal

Make the app useful **during** Scrooge rehearsals. Staff can capture unstructured notes and structured Timeline actions (entrances, exits, blocking, and the other Moment attachments) while work happens in parallel rooms. Directors and Stage Managers can see what happened in a given rehearsal and **Approve** suggestions so they are marked looked-at and official.

Approve is not a visibility gate. Public notes go public as soon as someone with permission toggles Public. Suggested actions stay visible to actors (dashed amber border; no pill).

---

## Locked decisions

| Topic | Decision |
| ----- | -------- |
| Status names | `suggested` / `official` |
| Who suggests | Capability `timeline.suggest`. Owner assigns it (TTA). |
| Who approves | Capability `timeline.approve`. Owner assigns it (Director, SM). |
| Director / SM creates | Default `official`; they can switch that save to `suggested`. |
| Suggest-only creates | Always `suggested`. No Approve control. |
| Actors and suggested actions | Visible, dashed amber border. Org-level hide setting deferred. |
| Unstructured notes | Not approved. Public is immediate. |
| Public toggle | On every unstructured-note UI, only if the user has `notes.publish` (or is Admin). Default off (private). |
| Private notes | Author only. Admin sees all. Director and SM do not see others’ private notes. |
| Note model | One `notes` table. `rehearsal_notes` migrated in, then dropped. |
| Note targets | Moment and/or Character and/or Rehearsal. Session note = `rehearsal_id` only. Moment note from a rehearsal = `moment_id` + `rehearsal_id`. |
| Provenance | Stamp `rehearsal_id` on create. Window is rehearsal time ± 1 hour. Stamp when exactly one rehearsal is in the window. Open/complete status is ignored. No picker. |
| Backfill | Existing attachments `official`, null author/rehearsal. Migrated session notes `public` so other staff still see them. |
| Reject | Delete. No `rejected` status. |
| Shared UI | One notes component used everywhere unstructured notes appear. Attachments do not use that composer; they do share the attribution control. |
| Open rehearsal | UI Open button removed. Capture does not require `in_progress`. Complete remains (scene `times_rehearsed`). |
| Out of scope | House mode, dictation, @-mentions, tasks, full history, concurrent-rehearsal picker, hiding suggestions from actors, tablet house-mode polish. |

---

## What shipped

- Matrix extras: `timeline.suggest`, `timeline.approve`, `notes.publish` (Settings toggles only on those resources). Director seeded with all three.
- Migration `032_rehearsal_capture`: unified notes, dropped `rehearsal_notes`, attachment provenance columns.
- Shared `NotesPanel` + tap-to-expand `AttributionInfo`.
- Suggested → official attachments with green-check Approve; compact Moment Detail cards.
- Rehearsal “What happened” activity log with Timeline deep links.
- Time-window stamp (±1h); no Open step required for capture.

---

## Work packages

| WP | Status |
| -- | ------ |
| WP0 Capabilities | Done |
| WP1 Schema and stamp | Done |
| WP2 Shared notes UI | Done |
| WP3 Suggested / official | Done |
| WP4 Rehearsal activity log | Done |
| WP5 Tablet polish | Skipped (no walkthrough blocker) |
| WP6 Docs | Done |

---

## Owner follow-ups (not code)

1. Run migration `032` wherever this deploy lands (local Docker / prod).
2. In App Settings → production roles: turn on `timeline.approve` for Stage Manager; `timeline.suggest` (and `notes.publish` if needed) for TTA.
3. Commit when ready (changes were left uncommitted during build).

---

## Explicitly deferred

- [director-house-notes.md](director-house-notes.md) house mode / dictation
- [tasks-and-mentions.md](tasks-and-mentions.md)
- Edit history / undo
- Concurrent-rehearsal picker when two slots overlap the window
- Org setting to hide unconfirmed actions from actors
- Tablet-only in-progress banner
- Character detail NotesPanel wiring (Moment + Rehearsal use the shared component today)
