# Feature plan — Casting workspace, auditions & availability

**Status:** Proposal (not scheduled)  
**Created:** 2026-08-29  
**Updated:** 2026-08-29  
**Related:** [production-membership-and-casting-workspace.md](production-membership-and-casting-workspace.md), [ROLES.md](../ROLES.md), [DATABASE.md](../DATABASE.md), [rehearsal-management.md](rehearsal-management.md), [tasks-and-mentions.md](tasks-and-mentions.md), [app-announcements.md](../shipped_features/app-announcements.md)

---

## Goal

Create a production-scoped **Casting** workspace for audition preparation and casting
decisions without replacing the existing character-centric casting editor.

The first useful version should let authorized casting staff:

- See the active people assigned to a production in one actor/candidate-oriented view.
- Record private casting notes against a production person.
- See those notes as a chronological feed that identifies the author and timestamp.
- Collect and review each person's per-production unavailable rehearsal dates.
- Surface those dates as warnings while planning rehearsals.

Later slices can add a digital audition/intake form, audition sessions, candidate
statuses, and structured casting decisions. The same production membership, notes,
and availability records should be reusable by those forms rather than replaced by
a second identity system.

This is a production workflow. It must not expose private casting notes or individual
conflict dates to ordinary production members or actors.

---

## Current baseline

### Already implemented

- Organization users are separate from production participation.
- `production_memberships` gives a user explicit, active/inactive participation in a
  production.
- `production_roles` and the Admin-managed permission matrix provide production-scoped
  capabilities.
- `/productions/:id/people` lists active members, roles, contact email, and current
  character assignments.
- Character casting remains in `CharactersPage` and uses
  `user_character_assignments`: one current actor per character, many characters per
  actor.
- Rehearsals, call planning, soft publishing, and rehearsal notes are shipped.
- The `casting` permission resource already exists, so the future nav item can be
  capability-gated instead of hard-coded to a global role.

### Not implemented

- No `/productions/:id/casting` route or Casting page exists.
- No audition/candidate record, audition session, casting status, decision, or
  casting-specific notes model exists.
- General Notes are currently attached to Moments or Characters and use only
  `public` / `private` visibility. They are not a production-wide private casting
  feed.
- No per-production availability or unavailable-date model exists.
- Rehearsal responses currently treat availability as `True`; the planner only warns
  about overlapping calls within a rehearsal.
- The existing announcement route allowlists and modal selection need hardening before
  Casting CTAs are added.

### Membership/People hardening required first

The current branch has a strong membership foundation, but the following issues should
be fixed and tested before depending on it for casting operations:

1. `validate_optional_person` in `backend/app/api/deps.py` verifies only an active
   same-organization user. Props, set-piece, and blocking person references can
   therefore point at a user who is not an active member of the production.
2. Manual rehearsal calls in `backend/app/api/rehearsals.py` have the same
   organization-only validation and can call a non-member.
3. Deactivated memberships preserve cast rows by design, but readiness, overview
   counts, character/casting responses, and lav-chart wearer derivation do not
   consistently treat those retained assignments as inactive.
4. Production-scoped notification modals are added to the modal pool without the
   same production filter used for banners. A modal from Production A can appear
   while viewing Production B or the production list.
5. Announcement CTA route filtering does not consistently match the frontend route
   behavior. The `announcements` route is allowlisted without a corresponding route,
   and `/rehearse` redirects to Timeline while route-key filtering can still use
   `rehearse`.
6. Existing organization Admin assignment is supported during account creation but
   lacks an edit endpoint/UI for promoting or demoting an existing user.
7. `backend/tests/scoped_test_helpers.py` can lose membership setup across a client
   request because it only flushes shared SQLite data. The focused run reached
   38 passing tests and one setup-related failure; the helper or test transaction
   boundary needs correction.
8. The People role selector is hard-coded to the three seeded roles. This is
   acceptable for the seeded MVP only if documented; otherwise it should load the
   role registry before adding future casting-specific roles.

These are WP0, not optional cleanup. Casting privacy and availability correctness
depend on production membership being the authoritative boundary.

---

## Product model and recommended defaults

### Casting access

The Casting nav and API use `hasCapability("casting", "read")` and the corresponding
backend capability dependency. Admins retain their organization-wide bypass. Other
users see Casting only when an active production role grants the capability.

“Casting-based people” means users with active access to the Casting resource, not
everyone with an Actor role. This leaves room for a future Casting Director or Casting
Staff role without exposing notes to actors.

Recommended defaults:

- Admin: read and manage all production casting data.
- Director: read and manage casting data through the seeded Director matrix.
- Actor/Member: no Casting access by default.
- Inactive production members: excluded from ordinary Casting lists and all new writes.

### Casting roster

The first Casting page should use active `ProductionMembership` records as its
candidate/people source. It may show assigned characters as context, but it should not
duplicate or replace the current character assignment editor.

The initial page can include:

- Name, email, production roles, assigned characters, and membership state.
- Casting note count and latest note timestamp.
- Number of unavailable dates and the next unavailable date.
- Links to Characters for current cast assignment and to the availability view.

Do not create a second per-production user table. Do not introduce external applicants
or public account creation in the first slice.

### Casting notes

**Recommendation:** use a dedicated `casting_notes` table rather than overloading the
universal Moment/Character Notes table.

Suggested fields:

- `id`
- `production_id`
- `subject_user_id`
- `author_user_id`
- `content`
- `created_at`
- `updated_at` only if editing is approved

The feed is ordered newest-first or oldest-first consistently, with an explicit
timestamp and author display name on every entry. Notes are readable only to users
with active Casting read capability (plus Admin), and the subject user is not granted
visibility merely because they are the subject. API checks must enforce this even when
the frontend is bypassed.

Recommended MVP behavior is append-first: authors may add notes; authors and authorized
casting managers may edit/delete their own or managed notes only if that is needed.
An immutable append-only feed is safer for audition evaluation and can be the default
until editing requirements are known.

### Unavailable dates

**Recommendation:** store one normalized date row per user and production, and treat
CSV as an import/export format rather than the database format.

Suggested table:

- `production_user_unavailable_dates`
  - `id`
  - `production_id`
  - `user_id`
  - `unavailable_date` (`DATE`, not a timestamp)
  - `created_at`
  - optional `updated_at`
  - unique `(production_id, user_id, unavailable_date)`

For the pre-form MVP, the simplest CSV contract is a one-column file for a selected
production person:

```csv
date
2026-09-03
2026-09-10
2026-10-01
```

The same replace-list API can later receive dates from a digital intake form. This
avoids ambiguous matching by email/name and makes duplicate handling deterministic.
Date values use ISO `YYYY-MM-DD`, with no time-of-day or timezone. Individual dates are
private casting data; they are not shown on the general People roster.

Recommended import behavior:

- Validate every row before replacing the selected person's list.
- Ignore duplicate dates within the file after reporting them as warnings.
- Reject malformed dates and return row-level errors.
- Replace the selected person's existing set only after the whole file validates.
- Require the selected user to be an active member of the production.
- Permit past dates for historical audition records, but show only relevant dates in
  the default calendar.

### Rehearsal conflict behavior

Date-only availability cannot decide whether a person is free for a particular block.
The first integration should therefore be advisory:

- A rehearsal on an unavailable date produces a visible conflict warning.
- The planner does not silently remove the person from suggested calls.
- Directors may still call or override the warning.
- The call sheet identifies the conflict when a called person has one.
- Time-of-day availability, partial-day conflicts, attendance, and hard blocking are
  deferred until the intake model supplies better data.

---

## Proposed work packages

### WP0 — Membership and People hardening

**Scope**

- Require active production membership for optional user subjects in props, set pieces,
  and blocking.
- Require active production membership for manual rehearsal calls.
- Make inactive retained casts inert in readiness, overview counts, casting responses,
  actor-specific views, and lav-chart wearer derivation.
- Scope notification modals and normalize announcement CTA route behavior.
- Add Admin editing for existing organization-level Admin assignments, or explicitly
  document that account creation is the only supported path.
- Fix the scoped test helper transaction boundary and migrate the focused/full test
  fixtures away from global Director/Actor assumptions.
- Decide whether People loads the production role registry dynamically.

**Done when**

- Cross-production users cannot be selected as person subjects or manual calls.
- Deactivation consistently removes access and effective actor behavior while
  preserving historical rows.
- The focused membership/access suite is green, and the legacy-test status in the
  docs is accurate.

### WP1 — Casting navigation and roster

**Scope**

- Add `/productions/:id/casting`.
- Add a capability-gated Casting nav item and Overview link.
- Build an actor/candidate-oriented roster using active production memberships.
- Link each row to current Characters casting and to availability.
- Keep unauthorized users out of both the route and its API.

**Done when**

- An Admin or authorized Director can open Casting and see only active members of the
  current production.
- An Actor or Member without Casting read cannot discover or fetch the workspace.
- The page does not duplicate character assignment logic.

### WP2 — Private casting note feed

**Scope**

- Add the dedicated casting-note schema, migration, model, service, API, and tests.
- Add create/list/detail behavior scoped to a production person.
- Add a chronological feed layout showing author, timestamp, and content.
- Add the smallest approved edit/delete behavior, or explicitly ship append-only.
- Add privacy tests for actors, ordinary members, inactive members, and other
  productions.

**Done when**

- A casting-authorized user can add a note to a production person.
- Another casting-authorized user can see the note and its author.
- The subject and ordinary production members cannot see it unless a future policy
  explicitly grants that access.

### WP3 — Unavailable dates and conflict calendar

**Scope**

- Add the normalized per-production, per-user date table and replacement API.
- Add one-column ISO CSV import/export for a selected active production person.
- Add row-level validation, duplicate warnings, and atomic replacement.
- Add a Casting calendar/list view for a person and a production-level conflict view
  for authorized casting users.
- Keep date privacy within Casting access.

**Done when**

- A casting user can replace a person's unavailable dates with a valid CSV.
- Invalid input leaves the previous set unchanged.
- The calendar shows exact date values and identifies the affected person.
- Dates from Production A never appear in Production B.

### WP4 — Rehearsal planner awareness

**Scope**

- Join unavailable dates into rehearsal planning and call-sheet responses.
- Mark date conflicts clearly on suggested and manually called people.
- Preserve director override behavior.
- Add tests for all-call, called, published, and cross-production cases.

**Done when**

- A rehearsal date matching an actor's unavailable date is visible as a warning before
  publishing.
- The warning does not change the existing call plan without a director decision.
- Actor-facing call information does not expose unrelated people's private dates.

### WP5 — Digital audition intake

**Scope**

- Reuse production membership and the unavailable-date replacement API as the storage
  target for a future intake form.
- Decide whether intake is authenticated-only, invite-based, or supports a limited
  public link.
- Collect only the minimum audition/contact/availability data needed for the chosen
  workflow.
- Associate a submission with an existing organization user when possible; define a
  deliberate path for a new person rather than creating duplicate accounts.

**Done when**

- A participant can submit audition availability without exposing casting notes.
- Casting staff can review the submission in the Casting workspace.
- Validation and privacy rules are documented before any external/public form is
  implemented.

### WP6 — Audition sessions and casting decisions

**Scope**

- Model optional audition sessions/slots and candidate status transitions.
- Support internal notes per audition or candidate while retaining the person-level
  feed.
- Record a deliberate casting decision that can later drive the existing
  `user_character_assignments` editor.
- Keep understudies, temporary overrides, and effective-date casting separate per
  [understudies-and-cast-overrides.md](understudies-and-cast-overrides.md).

**Done when**

- Casting staff can move a candidate through a documented status flow.
- A final decision can be handed off to current character casting without silently
  changing the one-actor-per-character rule.
- Audition history remains understandable after a candidate is cast, declined, or
  withdrawn.

### WP7 — Documentation and closeout

**Scope**

- Update `PROJECT.md`, `DATABASE.md`, and `ROLES.md` when decisions become locked.
- Update the feature-plan index and promote this proposal only after scope/priority is
  approved.
- Add a short operator walkthrough for notes, availability CSVs, and conflict
  warnings.
- Keep `rehearsal-management.md` aligned with the actual availability behavior.

**Done when**

- A future implementer can find the access policy, data shape, CSV contract, privacy
  rules, and rehearsal-warning semantics without reconstructing them from code.

---

## Open questions

These do not block this proposal, but should be answered before the corresponding
work package is authorized.

| # | Question | Recommendation |
| --- | --- | --- |
| Q1 | Who qualifies as casting staff? | Use the `casting:read` / `casting:create` / `casting:update` capabilities; seed Director/Admin behavior now and allow a future casting-specific role. |
| Q2 | Should actors see their own casting notes? | No. Keep the feed private to Casting-capable users unless a distinct feedback workflow is designed. |
| Q3 | Should notes be editable? | Start append-only; add tightly scoped edit/delete only after real audition use shows the need. |
| Q4 | Should the date CSV identify the user in each row? | No. Upload for one selected production person; avoid fuzzy name/email matching. |
| Q5 | Should unavailable dates block calls? | No. Dates are warnings until time-of-day/partial-day data exists. |
| Q6 | Should inactive members remain visible to casting staff? | Hide them by default; add an explicit historical/inactive view later if audition history requires it. |
| Q7 | Is intake authenticated or public/invite-only? | Start with authenticated or invite-scoped intake; do not expose a public form until identity, spam, and privacy rules are decided. |
| Q8 | Does a casting decision automatically cast a character? | No. Keep the existing character-centric assignment as the explicit final action in the first version. |
| Q9 | Do conflicts need time ranges? | Not for the first date-only slice. Defer partial-day availability and timezone semantics. |

---

## Explicitly out of scope

- Replacing `CharactersPage` or the one-actor-per-character MVP rule.
- Understudies, temporary cast overrides, effective-date casting, or cast history.
- Public account creation, anonymous applicant records, or outbound invitations.
- Medical, HR, absence, or disciplinary information.
- Actor-visible evaluation notes or general production notes.
- Hard-blocking rehearsal calls based on date-only conflicts.
- Time-of-day availability, partial-day ranges, timezone conversion, attendance, or
  calendar-provider synchronization.
- Email/SMS delivery, push notifications, and public social-style messaging.
- Group/principal targeting until the basic Casting privacy model is proven.
- A generic polymorphic notes or workflow engine.

---

## Risks and tradeoffs

- **Privacy boundary:** casting notes and dates are more sensitive than ordinary
  production notes. Dedicated storage plus capability checks is clearer than extending
  the current public/private Moment Notes semantics.
- **Membership drift:** retained casts and inactive members can make historical data
  look current. WP0 must establish one active-membership rule before Casting relies on
  the roster.
- **Date-only limitations:** a date conflict cannot know whether a person is free for
  an evening block. Warnings are honest; automatic exclusion would be misleading.
- **Identity matching:** roster-wide CSVs keyed by email/name are convenient but fragile.
  A selected-person upload is less flexible and much safer for the MVP.
- **Scope growth:** auditions can become a full applicant-tracking system. Start with
  production members, private notes, and availability, then add intake only after the
  internal workflow is useful.
- **Relationship duplication:** the Casting page must link to current character
  assignments rather than storing a second “cast” relationship.

---

## Recommended sequence

1. Complete WP0 hardening and make the focused/full test status trustworthy.
2. Implement WP1 Casting navigation and the active production roster.
3. Implement WP2 private casting notes and dogfood the feed during audition prep.
4. Implement WP3 selected-person unavailable-date replacement plus CSV.
5. Implement WP4 advisory rehearsal conflict warnings.
6. Decide and authorize the identity/privacy model for WP5 digital intake.
7. Add WP6 audition sessions and decisions only after the first internal workflow has
   been used.
8. Promote this proposal to a numbered phase when the first slice and open questions
   are approved.

