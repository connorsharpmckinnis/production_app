# Feature plan — Rehearsal management

**Status:** Shipped (Phases 15–18)  
**Created:** 2026-08-21  
**Related:** [PHASE_15.md](../PHASE_15.md)–[PHASE_18.md](../PHASE_18.md), [print-and-call-sheets.md](print-and-call-sheets.md), [casting-and-auditions.md](casting-and-auditions.md), [scheduling-and-attendance.md](scheduling-and-attendance.md) (superseded), [email-notifications.md](email-notifications.md)

---

## Goal

Digitize STP’s existing rehearsal call-planning process: reserved slots on a production, director planner (time/location blocks, scenes, who’s called), soft-published call sheets, rehearsal notes, and scene `times_rehearsed` feedback — without replacing Planning Center or inventing a new process.

Pam walkthrough target: “this replaces the week-before call email and sticky-note notes.”

---

## Locked decisions

| Topic | Decision |
| ----- | -------- |
| First build-out | Season slots + planner + call times + call sheet + director notes + actor My call; availability defaults to no conflicts |
| Calendar ownership | App owns production rehearsal slots + call plans; staff invent dates outside the app, then enter them at setup |
| Ad-hoc rehearsals | Supported |
| Actor availability forms | Deferred |
| Publish / email | Soft publish + printable call sheet only; email later |
| Auditions / conflict calendar | Out of this program |

## Defaults

| Topic | Default |
| ----- | -------- |
| Planner shape | Rehearsal → Blocks (time + optional location + work focus) |
| Work focus | Scenes (multi-select) + optional free-text label |
| Who is called | Suggested from casting ∩ scene presence (dialogue/lyrics/E&E), then edit |
| Locations | Org-level room catalog; blocks may override |
| Soft publish | `scheduled` → `planned` → `published` → `in_progress` → `completed` |
| Notes | Rehearsal-scoped (not Moment notes) |
| Times rehearsed | Integer on Scene; increment on complete (once per rehearsal×scene) |
| Nav | **Rehearsals** (distinct from **Rehearse** line practice) |

---

## Current boundary

The shipped planner does not yet store actor availability. Rehearsal responses
currently default availability to `True`, and overlapping calls are advisory
within a rehearsal. Per-production unavailable dates and Casting-only conflict
review are planned in [casting-and-auditions.md](casting-and-auditions.md);
date-only conflicts should remain warnings until a later intake model supports
time ranges.


## Data model

- `locations` — organization_id, name, sort_order
- `rehearsals` — production_id, starts_at, ends_at, kind (all_call|called), status, title, location_id
- `rehearsal_blocks` — rehearsal_id, starts_at, ends_at, location_id, label, sort_order
- `rehearsal_block_scenes` — block_id, scene_id
- `rehearsal_block_calls` — block_id, user_id
- `rehearsal_notes` — rehearsal_id, author_user_id, content
- `scenes.times_rehearsed`, `scenes.last_rehearsed_at`

---

## Phases

| Phase | Slice |
| ----- | ----- |
| 15 | Locations + rehearsal slots CRUD + list |
| 16 | Call planner (blocks, scenes, suggested cast, recommendations) |
| 17 | Soft publish + director call sheet + actor My call |
| 18 | Open rehearsal notes + complete + times_rehearsed |

---

## Non-goals

- Planning Center / Google Calendar sync
- Actor conflict forms / audition flows (see [casting-and-auditions.md](casting-and-auditions.md))
- Outbound email/SMS (follow-on via email-notifications)
- Attendance check-in
- Equity formal call sheet fields
- Renaming or replacing Rehearse mode

---

## Supersedes

[scheduling-and-attendance.md](scheduling-and-attendance.md) — owner chose call-planning ops (beyond thin stub Option C), not a full org calendar.
