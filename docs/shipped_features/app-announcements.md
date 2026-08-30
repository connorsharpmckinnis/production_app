# Feature plan — App announcements & notification inbox

**Status:** Prototype shipped (Slices A–C) — 2026-07-29  
**Created:** 2026-07-28  
**Updated:** 2026-08-01 — hard-delete inactive announcements (#84)  
**Related:** Overview spotlight messages ([PHASE_8.md](../PHASE_8.md), [PREP_READINESS.md](../PREP_READINESS.md)), [ROLES.md](../ROLES.md), [SCRATCH_NOTES.md](../SCRATCH_NOTES.md) (spotlight vs future notifications), [UX_UI_IMPROVEMENTS.md](../UX_UI_IMPROVEMENTS.md) (bookmarks panel as header-panel precedent), [casting-and-auditions.md](../feature_plans/casting-and-auditions.md), [tasks-and-mentions.md](../feature_plans/tasks-and-mentions.md), [email-notifications.md](../feature_plans/email-notifications.md)

---

## Goal

Give Directors and Admins a first-class way to **broadcast durable, targetable announcements** inside Theater Thing — with optional call-to-action buttons/links, multiple presentation modes (banner vs blocking modal), and a **bell + unread inbox** so infrequent and daily users get information parity when they next open the app.

**Primary motivating UX:** Actor opens a production and sees a colored banner: “Reminder: off-book due at next rehearsal,” with a button that jumps into Rehearse Mode for that show.

**Secondary motivating UX:** Actor who hasn’t opened the app in two weeks clicks the header bell, sees unread items (audition form link, new Rehearse features modal they dismissed earlier, production reminder), and catches up without depending on email.

**Tertiary motivating UX:** Admin ships a product update (“Rehearse Mode now supports X”) as a one-time blocking modal for all users, with a CTA that opens `/productions/:id/rehearse`, plus an external “Share feedback” button that opens a Google Form in a new tab.

---

## Problem

Leaders currently have no good in-app channel for group communication:

| Channel today | Limitation |
| --- | --- |
| Group email / chat outside the app | One-way or siloed; not tied to the place people actually work |
| Overview spotlight `announcement` kind | Soft, rotating greeting on **Overview only**; no unread state, no CTAs, no role targeting, no org-wide product news, no inbox |
| Toasts / confirm dialogs | Ephemeral or reactive to the user’s own action — not broadcast |
| Notes / feedback | Per-moment or outbound to GitHub — not cast-wide messaging |

We expect mixed usage patterns: some cast members open the app weekly for line practice; others live in it during tech week. Announcements need to **persist until acknowledged or expired**, not only flash on the day they are posted.

Public two-way communication (@-mentions, tasks, DMs) is a separate future feature — see [tasks-and-mentions.md](../feature_plans/tasks-and-mentions.md). Outbound email is separate too — see [email-notifications.md](../feature_plans/email-notifications.md). This plan is **one-way broadcast + read tracking**, not chat. Prefer designing the bell as a **multi-kind notification feed** (announcements, later mentions/assignments) so those plans can plug in without a second inbox.

---

## Current behavior (post-ship baseline)

| Area | Today |
| ---- | ----- |
| Overview spotlight | Production-scoped messages: `encouragement` / `scripture` / soft `announcement`; rotates on Overview; no CTAs, no inbox |
| Announcements | Org-wide (Admin Settings) + production-scoped (Overview section); banners, Admin-only blocking modals, role targeting, CTAs, and centered severity-accented modal presentation |
| Notifications inbox | Header bell + unread badge; multi-kind feed (`announcement` now; mentions/tasks later) |
| Toasts | Ephemeral success/error (`ToastContext`) |
| Confirm / dialogs | User-initiated CRUD and destructive confirms |
| Deep links | Timeline human `?act=&scene=&moment=` (+ legacy PK); costumes `?characterId=`; Rehearse is path-only |
| Roles | `Admin` globally; `Member`, `Director`, and `Actor` through active production memberships |
| Production visibility | Admin: all productions in their organization; active production members: assigned productions |
| Notification tables | `announcements`, `announcement_audiences`, `announcement_ctas`, `notifications` |

External audition-availability forms remain a valid announcement CTA for now.
An eventual in-app intake should reuse the Casting workspace's production
membership and unavailable-date records; it is planned separately in
[casting-and-auditions.md](../feature_plans/casting-and-auditions.md).

Relevant code (approximate):

- Shell / header / bell: `frontend/src/components/AppShell.tsx`, `NotificationHost.tsx`
- Announcement composers: `AnnouncementManager.tsx` (Settings + Overview)
- Spotlight: `frontend/src/components/OverviewSpotlight.tsx`, Overview message editor
- API / models: `backend/app/api/notifications.py`, `models/announcement.py`, `models/notification.py`
- Auth / access: `backend/app/auth/dependencies.py`, `backend/app/api/deps.py`
- Routes: `frontend/src/App.tsx`

### Relationship to Overview spotlight

**Keep spotlight as ambient personality** (scripture, encouragement, soft show greetings).  
**Do not overload it** into a notification system.

Recommendation: leave existing Overview `announcement` kind alone for v1 of this feature. Optionally later:

- Soft-deprecate spotlight “announcement” in favor of this system, or
- Allow a production announcement to *also* appear in the spotlight queue (cross-post), without making spotlight the source of truth for unread/CTAs.

Document that distinction in Settings / Overview editor help text when this ships so Directors are not confused about “which announcements?”

---

## Product model (proposed)

### Core concepts

| Concept | Meaning |
| ------- | ------- |
| **Announcement** | One authored broadcast: title, body, severity/style, audience, placement, CTAs, schedule, optional dismiss rules |
| **Delivery / impression** | How it surfaces: inbox always; optionally also banner and/or blocking modal |
| **Read state** | Per-user: unread → read (and optionally dismissed for banners/modals without marking “never show again” separately) |
| **CTA** | Zero or more buttons/links: internal app route or external URL |

### Announcement types (presentation)

These are **presentation modes**, not mutually exclusive with the inbox. Every announcement should appear in the bell backlog (unless explicitly “banner-only ambient” — see open questions). Presentation modes control *interruptiveness*:

| Type | UX | Good for |
| ---- | -- | -------- |
| **Inbox only** | Bell badge + list item; no forced chrome | FYIs, archival catch-up, low urgency |
| **Banner** | Colored strip on matching surfaces (global app shell and/or production-scoped pages) | Reminders, deadlines, soft alerts while working |
| **Modal (blocking)** | Dialog that must be acknowledged (primary CTA and/or “Got it”) before continuing | New feature tours, critical first-login info, policy/safety notices |
| **Hybrid** | Modal or banner **plus** inbox entry | Default for anything important enough to interrupt — rare users still find it later in the bell |

**Severity / color** (banner + list accent): e.g. `info` | `success` | `warning` | `urgent` — mapped to existing design tokens, not a rainbow of one-offs.

### Placement / targeting (where banners show)

| Scope | Example |
| ----- | ------- |
| **Org / app-wide** | Product news; all logged-in users |
| **Production** | Off-book reminder when viewing that production (any page or Overview-only) |
| **Production + route** | Banner only on Rehearse, or only on Timeline, etc. |
| **Role** | Actors only; Directors+Admins only; everyone |
| **Future:** Group / casting subset | “Principals only” via existing `groups` — defer unless needed for MVP |

Production announcements are resolved against active production memberships and
the selected production role. Membership access is independent of casting, so
an uncast Member or Actor can receive announcements before character assignment.

### Call-to-action links

Each announcement can attach **0–N CTAs**:

| CTA kind | Behavior | Example |
| -------- | -------- | ------- |
| **Internal** | Same-tab navigate to an in-app path (and optional query) | `/productions/12/rehearse`, `/productions/12/timeline?act=1&scene=2&moment=115`, `/about` |
| **External** | `target=_blank` + `rel="noopener noreferrer"` | Google Form, Drive folder, website |

Authoring UX should make the distinction obvious (path picker / known routes vs raw URL). Validate internal paths against a small allowlist of app route patterns so we don’t deep-link into broken or privileged admin URLs for actors.

Optional CTA fields: label, kind, href/path, sort order, style (`primary` / `secondary` / `link`).

### Bell + unread backlog

- **Header bell** left of the user menu in `AppShell` (always visible when authenticated).
- **Badge** = count of unread announcements visible to this user (cap display at `9+` if needed).
- **Panel** (dropdown/sheet, similar spirit to bookmarks strip but preferably a compact panel — learn from bookmarks “full-width banner” feedback):
  - Unread first, then recent read
  - Production label when scoped
  - Timestamp / “Posted …”
  - Tap opens detail (or expands inline) with body + CTAs
  - Mark one read / mark all read
- **Parity goal:** Opening the app after a long gap surfaces unread items; dismissing a modal still leaves the item in history (read) unless we add “archive” later.

No email/push in v1 unless explicitly added (see slices). In-app only is enough for information parity *among people who open the app*; it does not replace email for people who never log in.

### Authorship & permissions

| Action | Who (MVP) |
| ------ | --------- |
| Create/edit org-wide / product announcements | Admin |
| Create/edit production-scoped announcements | Admin or active production member with announcement capability |
| View / dismiss / mark read | Any authenticated user in audience |
| Actor creates announcements | **No** (unless later “cast captain” role) |

Composer UI: Admin area for org-wide; production-level composer near Overview messages or a dedicated “Announcements” section under production settings — keep separate from spotlight editor.

### Lifecycle

| Field | Purpose |
| ----- | ------- |
| `starts_at` / `ends_at` | Schedule visibility window (optional end = until dismissed or manually deactivated) |
| `active` | Soft kill switch |
| `priority` | Ordering when multiple banners compete |
| `requires_ack` | Modal must be acknowledged once per user |
| `max_impressions` / `snooze` | Optional later — don’t overbuild v1 |

**Competing banners:** Show highest priority one (or stack max 1–2). Overflow lives in the bell. Never stack three colored bars.

**Competing modals:** Queue one at a time (FIFO or priority); don’t open two dialogs.

---

## What we could implement

### Slice A — Data model + inbox API + bell (recommended foundation)

**Backend**

- Tables roughly:

  - `announcements` — content, type flags, severity, scope (org vs production_id), optional route/path filter, schedule, author, active
  - `announcement_ctas` — label, kind (`internal` \| `external`), target, sort_order
  - `announcement_audience` — role targets (or JSON/simple columns: `roles[]`)
  - `announcement_reads` — `(announcement_id, user_id, read_at, dismissed_at?)`

- APIs:

  - `GET /announcements/inbox` — items for current user (unread + recent), with CTAs
  - `POST /announcements/{id}/read` (and mark-all)
  - Admin/Director CRUD scoped appropriately
  - Audience resolution: role ∩ production access

**Frontend**

- Bell + badge + panel in `AppShell`
- List + detail with CTA buttons (internal navigate / external new tab)
- Empty state: “You’re all caught up”

**Done when:** Director can create a production announcement; cast member sees it unread in the bell; marking read clears badge; external + internal CTAs work.

### Slice B — Banners

- Banner component in app shell and/or production layout
- Placement rules: org-wide vs production vs production+route
- Severity colors; dismiss control (marks dismissed and usually read)
- Priority / single-banner policy

**Done when:** Off-book reminder appears as a banner on the target production pages and remains until dismissed or `ends_at`.

### Slice C — Blocking modals

- On login / route enter: fetch “pending ack” modals for this user
- One-at-a-time queue; primary CTA + “Got it”
- Ack writes read (+ dismissed); item remains in inbox history as read

**Done when:** First login after publish shows feature modal once; subsequent visits do not; bell still lists it as read.

### Slice D — Authoring UX polish

- Route picker for internal CTAs (common destinations: Overview, Rehearse, Timeline, catalogs, About, Users/Settings for admins)
- Preview (“as Actor on Production X”)
- Duplicate / schedule UI (deactivate + hard-delete inactive shipped 2026-08-01)
- Optional: pin / priority controls

### Slice E — Optional extensions (park)

- Email digest of unread announcements (weekly)
- Push / PWA notifications
- Target by `groups` / character casting subset
- Cross-post into Overview spotlight
- Analytics (open rates, CTA clicks)
- Markdown / rich text body (start with plain text + line breaks)
- Per-announcement “don’t show banner again” vs “mark read” split if dismiss ≠ read becomes confusing
- Rehearse-mode deep-links with query params (if product tours need a specific scene)
- Multi-language
- Announcement templates (“Off-book reminder”, “Costume fitting”)

---

## Open questions (decide before build)

| # | Question | Recommendation | Alternatives |
| - | -------- | -------------- | ------------ |
| **Q1** | Keep Overview spotlight `announcement` separate? | **Yes** for v1 — two concepts, clear labels (“Spotlight” vs “Announcements”). | Merge / migrate spotlight announcements into this system immediately. |
| **Q2** | Does every announcement enter the inbox? | **Yes** — inbox is the parity backbone; banners/modals are optional amplifiers. | Allow “banner-only ambient” with no inbox (risk: infrequent users miss it). |
| **Q3** | Who can author org-wide product news? | **Admin only.** Directors author production-scoped only. | Directors can also post org-wide. |
| **Q4** | Banner dismiss = mark read? | **Yes** for v1 (one mental model). | Separate dismiss vs read (more flexible, more confusing). |
| **Q5** | Multiple banners at once? | **Max one** visible; rest inbox-only until current dismissed. | Stack two; or severity-based replace. |
| **Q6** | Modal on every login until ack, or first matching session only? | **Until ack** (per user), regardless of how many sessions — critical for infrequent users. | Once per browser session (too weak). |
| **Q7** | Body format? | **Plain text** (+ optional short title). | Markdown later if needed. |
| **Q8** | Internal CTA validation? | Allowlist of known route patterns; reject arbitrary strings that look like `javascript:` etc. | Free-text path with runtime 404 risk. |
| **Q9** | Actor-only production targeting — cast-wide or also by group? | **Cast-wide** (everyone with access) for MVP. | Groups / principals in Slice E. |
| **Q10** | Show bell badge count of unread only, or unread + “active banners”? | **Unread count only.** | Include undismissed banners even if read (noisy). |
| **Q11** | Retention of read history? | Keep read rows; list “recent” (e.g. last 50 or 90 days). | Delete on read (hurts catch-up narrative). |
| **Q12** | Ship Slice A alone first? | **Yes** — bell + CRUD + CTAs prove value before banner/modal chrome. | A+B together if reminders-without-inbox feel incomplete. |

None of these block writing the plan; **Q1–Q6 and Q12** should be locked before implementation.

---

## Proposed work packages (if authorized)

### WP0 — Decisions + naming

- Lock Q1–Q6, Q12.
- Name the feature in UI: **Announcements** (composer) vs **Notifications** (bell) — pick one user-facing vocabulary and stick to it.
- Record Decision log; write 3 acceptance sketches.

**Done when:** Owner sign-off in this doc.

### WP1 — Schema + CRUD + audience resolution (Slice A backend)

- Migrations for announcements, CTAs, reads (and simple role audience).
- Admin org-wide CRUD; Director production CRUD.
- Inbox + mark-read endpoints; enforce production access on read path.
- Tests: actor cannot see other productions’ items; external/internal CTA round-trip; schedule window hides item.

**Done when:** API supports create → inbox fetch → mark read for a cast fixture user.

### WP2 — Bell UI + CTA behavior (Slice A frontend)

- Header bell, badge, panel, mark read / mark all.
- Render CTAs (internal `navigate`, external new tab).
- Composer MVP (can be a simple Admin/Director form page — polish in WP4).

**Done when:** Motivating UX #2 works end-to-end in the running app.

### WP3 — Banners (Slice B)

- Placement engine + single-banner policy + severity styles.
- Dismiss → read.
- Manual checks: org-wide on `/productions`; production-only on show routes; route-filtered banner.

**Done when:** Motivating UX #1 works.

### WP4 — Blocking modals (Slice C)

- Pending-ack fetch; queue; ack persistence.
- Don’t fight other dialogs (defer modal if confirm dialog open — edge case).

**Done when:** Motivating UX #3 works once per user.

### WP5 — Authoring polish (Slice D) + docs closeout

- Route picker, help text distinguishing spotlight vs announcements.
- Update PHASE / scratch / README as appropriate when scheduled.

---

## Explicitly out of scope (this proposal)

- Two-way messaging, DMs, @-mentions, threaded comments
- Real-time chat, presence, or WebSocket fanout (polling / fetch-on-navigation is enough)
- Email or push delivery (Slice E)
- Replacing Overview scripture / encouragement
- Staff/PM/SM role expansion (use Admin/Director until those roles exist)
- Mobile native apps / OS notification centers
- Guaranteed delivery to users who never log in

---

## Risks / tradeoffs

| Risk | Mitigation |
| ---- | ---------- |
| Confused with Overview spotlight announcements | Separate UI + copy; Q1 keep both; help text |
| Banner / modal fatigue | Priority + single banner; modals only for critical; inbox for the rest |
| Infrequent users still miss email-only people | Be honest: parity is among app openers; optional email digest later |
| Deep links to pages actors can’t access | Allowlist + server-side audience; CTAs respect `ProtectedRoute` |
| External links / phishing | External icon + “Opens in new tab”; Admin/Director-only authorship |
| Bookmarks-panel UX debt repeats on bell | Prefer compact dropdown/sheet, not full-width banner |
| Scope creep into chat / analytics / rich text | Ship A → B → C; park E |
| Read table growth | Indexed `(user_id, read_at)`; prune or “recent only” list later if needed |

**Recommendation:** Ship **Slice A** first (inbox + CTAs + composer). Add **Banners (B)** next for the off-book reminder. Add **Modals (C)** when there is a concrete product-tour or first-login story to tell.

**Why this fits now:** Usage is growing beyond rehearsal-only; spotlight is the wrong primitive for unread parity and CTAs; header shell and deep-link patterns already exist.

**Deferring:** Email/push, group targeting, spotlight cross-post, analytics, markdown, chat.

---

## Suggested sequence

1. Answer open questions (especially Q1–Q6, Q12).
2. Authorize Slice A (WP0–WP2) as its own small phase or feature branch.
3. Dogfood with one real production reminder + one external form CTA.
4. Add Slice B when banner placement is the missing piece for “can’t miss while in the show.”
5. Add Slice C when shipping a noteworthy product change or critical onboarding note.
6. Only then consider email digest if non-openers remain a real ops problem.

---

## Other considerations & design notes

### Information parity vs interruption

The bell is the **system of record for “what did I miss?”**  
Banners and modals are **attention amplifiers** for people already in flow. Designing amplifiers without the inbox fails infrequent users; designing inbox without amplifiers fails to interrupt people who ignore the bell.

### First-login / cold start

Optional “welcome” modal for brand-new users (product tour) can be a normal announcement with audience = all roles and `requires_ack`, published once — no special-case onboarding framework required in v1.

### Accessibility

- Bell: `aria-label` with unread count; panel focus trap; Esc closes.
- Modals: existing dialog patterns; don’t auto-open over an open confirm.
- Don’t rely on color alone for severity (icon + text).

### Performance

- Fetch inbox on shell mount + light poll or refetch on focus/navigation (no WebSocket required).
- Banner/modal eligibility can be the same payload (`active_surfaces`) to avoid N+1.

### Security

- HTML-escape / no raw HTML in bodies.
- External URLs: `https:` (and maybe `http:` for local) only.
- CSRF/auth same as rest of API; writes require Director/Admin.

### Naming sketch (UI)

| Surface | Copy |
| ------- | ---- |
| Bell empty | “No announcements” |
| Badge | Unread count |
| Composer | “Announcements” |
| Spotlight editor | Keep calling those “Overview messages” / spotlight — not “notifications” |

---

## Decision log

| Date | Topic | Decision |
| ---- | ----- | -------- |
| 2026-07-28 | Bell / feed shape | **One multi-kind notifications feed** (one bell). Announcements are a `kind`; future mentions / task assignments plug into the same inbox — do not ship an announcements-only table that forces a second inbox later. See [tasks-and-mentions.md](../feature_plans/tasks-and-mentions.md). |
| 2026-07-28 | Sequencing with related plans | In-app announcements/inbox → optional email blast ([email-notifications.md](../feature_plans/email-notifications.md)) → Tasks CRUD → comments/@-mentions → mention email → digest. |
| 2026-07-29 | Q1 spotlight vs this system | **Keep separate.** Spotlight stays ambient (scripture / encouragement); Announcements are productive broadcasts. |
| 2026-07-29 | Q2 all items in inbox? | **Yes.** Every announcement enters the bell. DB retains all rows for posterity; UI shows unread + last ~100. |
| 2026-07-29 | Q3 org-wide author = Admin only? | **Yes.** Directors author production-scoped only. |
| 2026-07-29 | Modal authorship | **Admin only** for blocking modals (release notes / app-related). Directors may use inbox + banner for production announcements. |
| 2026-07-29 | Q4 dismiss = read? | **Yes** for v1. |
| 2026-07-29 | Q5 max one banner? | **Max one** visible; overflow stays in the bell. |
| 2026-07-29 | Q6 modal until ack? | **Until user closes / Got it**, across sessions. |
| 2026-07-29 | Q12 Slice A first? | **No — ship A+B+C together** as a simple prototype. Email / Tasks / @-mentions remain out of scope. |
| 2026-07-29 | Auto notifications | **New production created** → notify all Admins. Expand later as needed. |
| 2026-07-29 | UI vocabulary | Bell = **Notifications**; composer = **Announcements**. |
| 2026-07-29 | Composer locations | Org-wide section on Admin Settings; production **Announcements** section (separate from Overview spotlight editor). |
| 2026-07-29 | Timeline CTAs | Prefer human `?act=&scene=&moment=` for announcement deep links; legacy PK still consumed. |

---

## Acceptance sketches (draft — refine after open questions)

1. **Inbox + external CTA:** Director posts “Fill out audition availability” for Production A, audience Actors, CTA → Google Form. Actor in A sees badge `1`, opens bell, clicks CTA → form in new tab; mark read → badge clears. Actor not in A sees nothing.
2. **Internal CTA:** Admin posts “Try the new Rehearse tools,” CTA → `/productions/12/rehearse`. Click navigates same tab to Rehearse for production 12 (if user can access it; otherwise hide CTA or show disabled + explanation).
3. **Banner reminder:** Production-scoped warning banner on all pages under `/productions/12/*`: “Off-book next rehearsal.” Dismiss removes banner and marks read; item remains in bell history as read.
4. **Blocking modal:** Org-wide modal “What’s new.” User must click Got it (or primary CTA). Second login: no modal; bell shows item as read.
5. **Parity after absence:** Three announcements posted over two weeks while actor away. On return, badge `3`, list newest-first unread; no dependence on having visited Overview spotlight.

---

## References

- Feature plans index: [README.md](README.md)
- Overview messages / spotlight: [PHASE_8.md](../PHASE_8.md), [PREP_READINESS.md](../PREP_READINESS.md)
- Roles: [ROLES.md](../ROLES.md)
- Scratch (spotlight vs future notifications): [SCRATCH_NOTES.md](../SCRATCH_NOTES.md)
- App shell: `frontend/src/components/AppShell.tsx`
- Overview message model: `backend/app/models/production_overview_message.py`
- Routes: `frontend/src/App.tsx`
- Timeline deep-link precedent: [in-play-moment-deep-links.md](in-play-moment-deep-links.md)
