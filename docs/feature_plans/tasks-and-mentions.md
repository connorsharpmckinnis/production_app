# Feature plan — Tasks + @-mentions

**Status:** Proposal (not scheduled)  
**Created:** 2026-07-28  
**Related:** [app-announcements.md](../shipped_features/app-announcements.md) (bell / inbox), [email-notifications.md](email-notifications.md), deferred Tasks in [PROJECT.md](../PROJECT.md) / [DATABASE.md](../DATABASE.md), Notes (moment annotations), [STP_PRODUCT_OVERVIEW.md](../STP_PRODUCT_OVERVIEW.md) (“not yet: assignable task lists”)

---

## Goal

Add **basic production project management** via Tasks, and let people **@-mention** teammates in task text and in notes/comments so the mentioned user gets an in-app notification (and, later, optional email). Keep the surface intentionally small — not Asana, not Slack — just enough for “Connor, can you confirm prop X for Scene 3?” and “Emmy — costume fitting checklist before Sunday.”

**Primary motivating UX:** Director creates a task “Confirm Iceberg handoff blocking,” assigns it to a stage lead (or leaves unassigned), due before next rehearsal, linked to a Moment. Assignee sees it on a production Tasks list and in the bell when assigned / @-mentioned in a follow-up comment.

**Secondary motivating UX:** Actor leaves a public note on a Moment: “@Director — is this entrance still USR?” Director gets a bell notification with a deep link back to that Moment.

**Tertiary motivating UX:** On a task thread, Director comments “@Alex please bring the spare mic pack.” Alex opens the bell days later and jumps straight to the task.

---

## Problem

Prep work today lives in email, texts, and memory. The app has rich Timeline/Rehearse structure but **no assignable work items** and **no way to poke a specific person** inside a note. Notes exist (moment annotations, public/private) but are passive — nobody is notified when you write them.

Tasks are already sketched in the long-term domain model and explicitly deferred past MVP. This plan proposes a **thin vertical slice**: create → assign → due → complete, plus mention-triggered notifications that reuse the announcements bell inbox rather than inventing a second notification UI.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Tasks table / API / UI | **None** (docs-only in DATABASE.md / PROJECT.md) |
| Notes | Moment (and API-ready character) annotations; `public` \| `private`; no @-parse; no notifications |
| Note UI | Moment detail panel only; actors always private; Directors/Admins can choose public |
| Mentions | None |
| Notification inbox | Prototype shipped — [app-announcements.md](../shipped_features/app-announcements.md) |
| Email | No outbound mail; `users.email` optional metadata only |
| Deep links | Timeline `?scene=&moment=`; good target for “open the note’s moment” |

Relevant code (approximate):

- Notes model/API/UI: `backend/app/models/note.py`, `backend/app/api/notes.py`, `MomentDetailPanel.tsx`
- Users: `users.email` optional; username / first / last for mention labels
- Domain sketch: [DATABASE.md](../DATABASE.md) `# TASKS`, [PROJECT.md](../PROJECT.md) Task section

---

## Product model (proposed)

### Tasks (basic PM)

A **Task** is a production-scoped work item:

| Field | Notes |
| ----- | ----- |
| `production_id` | Required |
| `title` | Required, short |
| `description` | Optional plain text (mentionable) |
| `status` | Prefer `open` \| `done` over boolean `completed` if we want later `blocked` — or stick to DATABASE.md `completed` bool for v1 |
| `due_date` | Optional date (no full calendar/scheduling product) |
| `created_by_user_id` | Author |
| `assigned_user_id` | Optional single assignee for v1 |
| Optional refs | `scene_id`, `moment_id`, `character_id`, `prop_id` (match DATABASE.md sketch) |

**Out of v1 task scope:** subtasks, multi-assignee, labels/tags board, time tracking, recurring tasks, dependencies, kanban, Planning Center sync.

**Permissions (draft):**

| Action | Who |
| ------ | --- |
| Create / edit / delete / reassign / complete any task | Admin, Director |
| Complete own assigned task | Assignee (Actor ok) |
| View tasks | Anyone with production access (cast + staff) |
| Comment on task | Anyone with production access (or Directors+ only — see open questions) |

**UI sketch:**

- Production nav item: **Tasks** (list: open first, filters: mine / all / done)
- Task detail: title, description, assignee, due, linked Moment/Scene chip (deep-link), activity/comments
- Optional: “Create task from Moment” affordance on Moment detail (pre-fills `moment_id`)

### Comments vs Notes

Two related but different surfaces:

| Surface | Role | Mentionable? |
| ------- | ---- | ------------ |
| **Notes** (existing) | Annotations on Moment/Character; public/private | **Yes** (public notes only notify) |
| **Task comments** (new) | Discussion on a Task | **Yes** |
| Task `description` | Initial body | **Yes** (on create/edit if mentions added) |

Avoid inventing a third “Comments” entity for Moments if Notes already serve that job — extend Notes with mention parsing instead of a parallel Moment comment thread (see Q2).

### @-mentions

**Authoring:** Type `@` → typeahead of users visible in this production (Directors/Admins + cast users; not every org user if actors shouldn’t see full directory — see Q5).

**Storage (recommended):**

- Keep human-readable text in `content` / `description` (e.g. `@Connor` or display name).
- Persist structured rows in `mentions` (or `notification_events`) with `mentioned_user_id`, `source_type`, `source_id`, `created_by`, so renames don’t break notification targeting.

**Parse rules (simple):**

- Match `@username` or a chosen handle; or insert a stable token like `@[user:123]` in stored text and render as display name (cleaner long-term).
- No nested mentions gymnastics; plain text body + structured mention list is enough.

**When a mention fires a notification:**

| Event | Notify |
| ----- | ------ |
| Public note created/edited with new @user | Mentioned user (if they can access the production) |
| Private note with @user | **Do not notify** others; optionally warn author “mentions in private notes won’t notify” |
| Task description / comment with @user | Mentioned user |
| Task assigned to user | Assignee (assignment notification — related but not a mention) |
| Self-mention | Skip (or allow no-op) |

**Notification payload (in-app):** Reuse the bell inbox from announcements as a **unified notification feed**, with `kind` discriminating:

- `announcement`
- `mention` (note | task_comment | task_description)
- `task_assigned`
- (later) `task_due_soon`, etc.

Deep link targets:

- Note mention → `/productions/:id/timeline?scene=&moment=` (+ scroll/highlight note if easy)
- Task mention / assignment → `/productions/:id/tasks/:taskId`

This implies the announcements plan’s inbox should be generalized to **notifications**, not announcement-only rows — or announcements become one `kind` in a shared `notifications` table. Prefer **one bell, many kinds** (see open questions / dependency).

---

## Dependency on announcements / email

```text
[Tasks + Mentions] ──creates──► in-app notification events
         │
         ├── requires ► bell inbox (app-announcements Slice A, generalized)
         │
         └── optional ► email-notifications (per-event or digest)
```

**Recommendation:** Do not ship mentions before an in-app notification sink exists. Tasks *without* mentions/notifications can ship earlier as a dumb checklist, but lose most of the “poke someone” value.

---

## What we could implement

### Slice A — Tasks CRUD (no mentions yet)

- `tasks` table aligned with DATABASE.md (+ `created_by`, status)
- API + production Tasks list/detail
- Assign, due date, complete, optional moment/scene link
- No comments, no notifications

**Done when:** Director can assign “Bring spare mic” to an actor; actor marks done.

### Slice B — Task comments

- `task_comments` (task_id, user_id, content, created_at)
- Chronological thread on task detail

**Done when:** Back-and-forth on a task works without leaving the app.

### Slice C — @-mentions + in-app notifications

- Mention typeahead + structured mention records
- Wire into task comments/descriptions and **public** notes
- Write notification rows; show in shared bell with deep links
- Assignment → `task_assigned` notification

**Done when:** Motivating UX #2 and #3 work with badge + deep link.

### Slice D — Moment → Task shortcut + “My tasks” home affordance

- Create task from Moment detail
- Optional filter chips; badge count of open tasks assigned to me (could live near bell or on Tasks nav)

### Slice E — Parked

- Multi-assignee, watchers (“subscribe to task”)
- Due-soon digests
- @role / @group mentions (`@cast`, `@directors`)
- Character-note UI + mentions there
- Rich text / markdown
- Task templates
- Planning Center / external PM sync
- Full activity audit log

---

## Open questions (decide before build)

| # | Question | Recommendation | Alternatives | Status |
| - | -------- | -------------- | ------------ | ------ |
| **Q1** | Ship Tasks before or after announcements bell? | **Bell/inbox first** (or same phase with shared `notifications`), then Tasks+mentions. | Tasks checklist only with no notify — weaker. | **Locked** 2026-07-28 |
| **Q2** | Mentions on Notes vs new Moment comments? | **Extend Notes**; public notes are the comment surface. | Separate Moment comment threads (duplicates Notes). | **Locked** 2026-07-28 |
| **Q3** | Can actors create tasks? | **No** in v1 — Directors/Admins create; actors complete + comment. | Actors can create (more PM, more noise). | **Locked** 2026-07-28 |
| **Q4** | Can actors comment on tasks? | **Yes** — otherwise assignment is a dead end. | Comments = staff only. | **Locked** 2026-07-28 |
| **Q5** | Mention typeahead directory | Users with access to **this production** only. | Entire org user list. | Open |
| **Q6** | Private notes + @mention | **No notify**; soft warning in UI. | Auto-upgrade note to public (surprising). | **Locked** 2026-07-28 |
| **Q7** | Shared notification table vs announcement-only + side channel | **One `notifications` feed**, announcements as a kind. | Separate bells (bad UX). | **Locked** 2026-07-28 |
| **Q8** | Single assignee only? | **Yes** for v1. | Multi-assignee immediately. | Open (lean yes) |
| **Q9** | Status model | `completed` boolean per DATABASE.md for v1. | `open/done/cancelled` enum. | Open (lean bool) |
| **Q10** | Email on every mention? | **Defer to email plan**; default off or digest until templates exist. | Immediate email always (needs address quality). | **Locked** 2026-07-28 (see email plan) |

Architectural locks (Q1, Q2, Q7) are recorded below; remaining opens can wait until build authorization.

---

## Proposed work packages (if authorized)

### WP0 — Notification schema alignment

- Q1–Q4, Q6–Q7, Q10 locked (see Decision log); confirm remaining opens (Q5, Q8, Q9) at build time if needed.
- Sketch `notifications` row shape with announcements plan: `kind`, `user_id`, `actor_user_id`, `production_id`, `title`, `body`, `resource_type`, `resource_id`, `deep_link`, `read_at`, `created_at`.

**Done when:** Shared `notifications` shape agreed with announcements implementer.

### WP1 — Tasks Slice A

- Migration, API, list/detail UI, permissions tests.

**Done when:** Assign + complete works for a cast fixture user.

### WP2 — Task comments (Slice B)

- Comments API + UI.

### WP3 — Mentions + notification writes (Slice C)

- Parser/typeahead; mention rows; note + task comment hooks; bell kinds; deep links.
- Tests: private note mention does not notify; cross-production user cannot be notified for inaccessible show.

### WP4 — Moment → Task + polish (Slice D)

---

## Explicitly out of scope (this proposal)

- Full project management suite (boards, workloads, Gantt)
- Chat / DMs / presence
- Replacing email for people who never log in (see email plan)
- Scheduling / rehearsals / attendance
- @everyone spam without safeguards

---

## Risks / tradeoffs

| Risk | Mitigation |
| ---- | ---------- |
| Building Tasks without a notification sink | Sequence after / with shared inbox (Q1/Q7) |
| Notes vs comments confusion | One Moment surface (Notes); Tasks get comments |
| Mention spam | Rate-limit later; no @everyone in v1; production-scoped directory |
| Actors can’t find Tasks | Clear nav + “Assigned to me” default filter |
| Divergence from DATABASE.md Task sketch | Stay close; document any status/enum drift in Decision log |
| Notification schema painted into a corner by announcements-only design | Design announcements inbox as multi-kind from day one |

**Recommendation:** Treat **shared notifications + Tasks Slice A** as the spine; add comments and @-mentions as soon as the bell can render non-announcement kinds. Keep PM features minimal.

**Why this fits later (not next):** Announcements/inbox and core prep workflows are higher leverage first; Tasks are explicitly post-MVP in PROJECT.md but become high-value once people live in the app daily.

**Deferring:** Email per mention, @group, multi-assign, boards, character-note UI.

---

## Suggested sequence

1. Align notification model with [app-announcements.md](../shipped_features/app-announcements.md) (one bell, many kinds).
2. Ship announcements inbox (or minimal notifications table).
3. Authorize Tasks Slice A → B → C.
4. Wire [email-notifications.md](email-notifications.md) for `mention` / `task_assigned` when outbound mail exists.
5. Only then consider @group, due digests, richer PM.

---

## Other considerations

### Display names

Prefer “First Last” in the rendered note with a stable underlying user id token, so username changes don’t orphan mentions.

### Permissions on deep links

If a mentioned user loses production access, notification remains but open action shows “unavailable” rather than 403-spamming.

### Read state

Mention notifications use the same mark-read / mark-all-read as announcements.

### Search

v1 list filters beat full-text search; add search when task volume hurts.

---

## Decision log

| Date | Topic | Decision |
| ---- | ----- | -------- |
| 2026-07-28 | Q1 sequencing | **Bell / multi-kind inbox first** (announcements), then Tasks CRUD, then comments/@-mentions. Email blast can follow announcements; mention email waits on this plan’s Slice C + email prefs. |
| 2026-07-28 | Q2 Notes vs Moment comments | **Extend public Notes** as the Moment mention surface — no separate Moment comment threads in v1. |
| 2026-07-28 | Q3 actor create tasks | **No** — Directors/Admins create; actors may complete assigned tasks. |
| 2026-07-28 | Q4 actor comment on tasks | **Yes** — actors can comment on tasks they can see. |
| 2026-07-28 | Q6 private notes + @ | **No notify**; UI warns that mentions in private notes will not notify anyone. |
| 2026-07-28 | Q7 shared feed | **One notifications feed / one bell**; announcements, mentions, and task assignments are kinds — not separate inboxes. |
| 2026-07-28 | Q10 mention email | **Not immediate-by-default**; follow [email-notifications.md](email-notifications.md) (blast first; mention mail via prefs / digest later). |

---

## Acceptance sketches (draft)

1. **Assign:** Director creates task on Production A, assigns Actor; Actor sees it under Tasks → Assigned to me; marks done.
2. **Note mention:** Actor posts public Moment note “@Director check entrance”; Director badge +1; click opens Timeline Moment.
3. **Private note:** Same text in a private note → no Director notification; author sees warning.
4. **Task comment mention:** Comment “@Alex spare pack”; Alex notification opens task detail.
5. **No cross-show leak:** User not in Production B cannot be mentioned into B’s notifications (or mention is rejected).

---

## References

- Announcements / bell: [app-announcements.md](../shipped_features/app-announcements.md)
- Email: [email-notifications.md](email-notifications.md)
- Domain: [PROJECT.md](../PROJECT.md) Task, [DATABASE.md](../DATABASE.md) TASKS / Notes
- Notes UI: `frontend/src/components/MomentDetailPanel.tsx`
- Product honesty: [STP_PRODUCT_OVERVIEW.md](../STP_PRODUCT_OVERVIEW.md)
