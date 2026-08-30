# Feature plan — Production membership & casting workspace

**Status:** Ready for manual validation — membership workspace, scoped authorization, and downstream hardening implemented
**Created:** 2026-08-28  
**Updated:** 2026-08-30
**Related:** [ROLES.md](../ROLES.md), [PROJECT.md](../PROJECT.md), [DATABASE.md](../DATABASE.md), [crew-roles.md](crew-roles.md), [understudies-and-cast-overrides.md](understudies-and-cast-overrides.md), [production-home-and-modes.md](production-home-and-modes.md)

---

## Goal

Give each production an explicit roster and a durable people/casting workspace.

The feature should let an Admin or an authorized production lead:

- Add an existing organization user to a production before casting.
- Assign one or more production roles to that person.
- Assign actors to characters independently of production membership.
- Assign one person different roles in different productions.
- Show the active production roster and contact information to production members.
- Let Admins configure the permission matrix for production roles in App Settings.

The data model should support future roles such as Stage Manager without making every
organization user automatically part of every production.

This is an authorization and domain-model change, not only a new casting page.

---

## Current baseline

The current system has three separate limitations:

1. `User.app_roles` is organization-wide. Admin, Director, and Actor are stored through
   `user_app_roles`.
2. Admins and Directors can generally access every production in their organization.
   Actors gain access indirectly through `user_character_assignments`.
3. Casting is character-centric: one character has at most one assigned actor, and an
   actor cannot be added to a production without assigning a character.

Relevant current surfaces include:

- `backend/app/api/deps.py` — production access decisions
- `backend/app/api/productions.py` — production listing and Overview payload
- `backend/app/api/characters.py` — character casting and castable-user lookup
- `backend/app/models/user.py` and `backend/app/models/app_role.py` — current user roles
- `backend/app/models/user_character_assignment.py` — current casting relationship
- `frontend/src/pages/CharactersPage.tsx` — current character-to-actor editor
- `frontend/src/pages/ProductionOverviewPage.tsx` — current Overview and quick links
- `frontend/src/pages/UsersPage.tsx` — organization-wide account administration

No standalone plan currently covers explicit production membership or production-scoped
role assignments. `crew-roles.md` identifies the need, but leaves the migration from
global roles unresolved.

---

## Proposed product model

Keep these concepts distinct:

### Organization account

The existing `User` remains the account and identity record. Admins continue to create
accounts, reset passwords, and deactivate accounts at the organization level.

An organization user may exist without belonging to any production.

`Admin` is the only organization-wide role for now. `Director` and `Actor` are
production-scoped roles and do not grant access to every production in the organization.
Future organization-wide staff roles such as Production Manager or Marketing Manager
are deferred.

### Production membership

A membership answers:

> Is this user an active participant in this production?

Membership is independent of casting. It enables future production-level features such
as audition forms, conflict calendars, production announcements, and other self-service
workflows without requiring a character assignment.

Membership should be explicitly deactivatable. Deactivation revokes current production
access while preserving the historical relationship for later audit and reporting.

### Production role

A production role answers:

> What capacity does this user have in this production?

The first role set should be deliberately small:

- `Member`
- `Director`
- `Actor`

The role registry should make later additions such as `Stage Manager` possible without
reintroducing organization-wide access. A person may hold multiple roles in one
production; roles are additive rather than mutually exclusive.

`production_roles` stores reusable role definitions such as `Director`, `Actor`, and
future `Stage Manager`. `production_membership_roles` is the join table that assigns
one or more of those role definitions to one user's membership in one production. The
role definition is not the assignment: the definition describes what a role means, and
the join row says that this particular person has that role here.

### Production-role permission matrix

App Settings should expose an Admin-only matrix of production role permissions. The
matrix is global to the app and applies to every production, so an Admin can change
what a role may do without editing each production separately. A change applies to all
active memberships carrying that role.

The implementation should store the matrix as normalized role/resource/action rows
rather than hard-coding a checkbox table into the frontend. The initial resource list
should cover every user-facing production object and workflow, not every internal
database table. At minimum this includes production/Overview, Script/Timeline
structure, Characters/casting, Groups, Songs, Props, Costumes, Set Pieces, the lav
chart (Wires/Packs), Cue Categories/Cues, Notes, Tasks, Rehearse, Rehearsals/Calls,
Reports, Announcements/Notifications, and People/membership. The matrix should use
explicit CRUD-style capabilities (`read`, `create`, `update`, `delete`) rather than
treating “write” as an ambiguous catch-all; individual resources may leave actions
disabled by default.

For a membership with multiple roles, effective role permissions are the union of the
permissions granted by its active roles. V1 has no per-user deny or allow overrides.

`Member` is the baseline production role for an active participant who needs general
production access but no preparation-management permissions. It should receive the
minimum general-read capabilities, including People roster visibility, while Director
and Actor receive the additional defaults documented in WP0. An active membership must
have at least one production role.

### Future per-member permission overrides

Later, an Admin should be able to grant or restrict a specific member's permission
without inventing a new production role. For example, Greg could be an Actor and
Costume Staff member while also receiving Set `read` and `update` access but not
`delete` access.

The likely shape is a membership-scoped override table keyed by
`production_membership_id`, resource, and action, with an explicit allow/deny value.
Effective access would start with the union of role permissions and then apply the
member-specific override. This needs a defined deny-precedence rule, Admin-only
management, and at least a basic last-modified timestamp when it is scheduled. It is
intentionally deferred until the role matrix has been exercised in real workflows.

### Character casting

Casting answers:

> Which character(s) does this production actor perform?

It remains a separate relationship from membership and production roles:

- An Actor member may have no character yet.
- An Actor may perform multiple characters.
- A character may have one primary actor in the current MVP.
- Removing a character assignment does not automatically remove production membership.

This separation also leaves room for understudies and effective cast overrides later.

### Recommended relational shape

Use an explicit membership plus a many-to-many membership-role join:

```text
User
  └── ProductionMembership
        ├── Production
        └── ProductionMembershipRole ── ProductionRole

ProductionMembership
  └── UserCharacterAssignment ── Character
```

Suggested tables:

- `production_memberships`
  - `id`
  - `production_id`
  - `user_id`
  - `is_active`
  - `created_at`
  - `updated_at`
- `production_roles`
  - `id`
  - stable role name/code
  - description
- `production_membership_roles`
  - `membership_id`
  - `production_role_id`
  - `created_at`
  - `updated_at`
- `production_role_permissions`
  - `production_role_id`
  - resource key
  - action/capability
  - enabled

Constraints and invariants:

- Unique `(production_id, user_id)` membership.
- Unique `(membership_id, production_role_id)` assignment.
- Foreign keys with production/member deletion behavior documented.
- Only active organization users can receive a new active membership.
- A membership and its user must belong to the production's organization.
- Every active membership must have at least one active production role; enforce this
  in membership/role service operations and API validation.
- A cast user must be an active member with the `Actor` production role.
- Existing one-actor-per-character uniqueness remains in place.
- Only Admins may change `production_role_permissions`.
- Multiple active roles grant the union of their enabled permissions.
- Role permission changes apply to all matching memberships without per-production
  permission copies.

The separate membership row is intentional. It keeps participation independent from
casting, while the role join allows one person to hold multiple capacities in the same
production. In V1, every active membership has at least one role, normally `Member`,
`Director`, `Actor`, or a combination.

---

## Resolved decisions

1. `Admin` remains the only organization-wide role. Global `Director` and `Actor`
   roles are not part of the target authorization model; production assignments use
   production roles instead. Future organization-wide staff roles are deferred.
2. Do not backfill existing users or casts. The schema and seeded role definitions may
   be added, but an Admin will manually add users to productions and assign `Member`,
   `Director`, `Actor`, and other roles. This is acceptable because the data is still
   test data.
3. Admins and active production Directors may add existing organization users, assign
   or remove production roles, and deactivate production memberships. Account
   creation, password resets, organization-level deactivation, and role-permission
   changes remain Admin-only.
4. An active uncast Actor can see general production content, including the Script,
   Timeline, production notifications, and the other normal production views. Anything
   that depends on a character or group assignment remains unavailable or inactive
   until the relevant assignment exists. This includes My Lines, actor-filtered
   views, character-specific Rehearse behavior, and scene-derived cast suggestions.
5. Any active member can see the name and optional email address of other members in
   that production. Do not add phone numbers or a separate contact-directory system.
6. Every active membership has at least one production role. `Member` is the default
   baseline role for participants who need general production access but no
   preparation-management permissions.
7. A person may hold multiple production roles in the same production. The effective
   permission set is the union of those roles; there is no role precedence in V1.
8. Store basic membership and role-assignment timestamps, such as `created_at` and
   `updated_at` / last modified. Do not build full assignment history, actor-attribution
   logs, effective dates, or audit trails now.
9. `People` is the production roster and membership/role-management surface.
   `Characters` remains the character catalog and current character-centric casting
   editor. Reserve a future `Casting` tab for auditions, casting forms, notes, and
   related workflows; it is not part of this slice.

## Implementation attention before WP1

The owner decisions above are complete. WP0 should still make these implementation
contracts explicit before schema and API work begins:

1. **Permission UI and defaults:** Use `read`, `create`, `update`, and `delete`
   checkbox columns. Seed rows for every user-facing production object/workflow listed
   above, with defaults derived from the current authorization behavior:
   `Member` gets minimum general read access, `Actor` gets broad production read plus
   actor-appropriate actions, and `Director` gets the current preparation capabilities.
2. **Admin behavior:** Keep Admin as an organization-wide bypass for production access
   and production actions in V1. The matrix controls production roles, not whether an
   Admin can administer the app or recover from a bad role configuration.
3. **Legacy test data:** Do not run a backfill. Existing global Director/Actor
   assignments can be manually removed or left inert, but they must not authorize
   production access after the cutover.
4. **Active-only People view:** People lists active members only. Deactivation keeps
   membership and role rows for data integrity, but inactive memberships are not shown
   to ordinary production members.
5. **Immediate enforcement:** Permission changes should take effect on the next
   authorization check for all matching active memberships; do not copy permissions
   into each production.

### WP0 implementation contract

The owner approved the following implementation choices on 2026-08-29:

- `Admin` remains the only organization-wide role. Existing global `Director` and
  `Actor` roles and assignments are removed from the seeded authorization model.
  Production `Director` and `Actor` capabilities come only from production
  memberships. The configured Admin account remains available for login.
- Production roles use an immutable, unique lowercase `code` plus editable `name`
  and `description`. V1 seeds `member`, `director`, and `actor`.
- Adding a user who already has an inactive membership reactivates that same row and
  replaces its role assignments. Duplicate `(production_id, user_id)` memberships
  are never created.
- Deactivation preserves the membership, role rows, and character-assignment rows.
  The inactive membership and its cast are treated as inactive by later access,
  casting, readiness, and actor-specific workflows. Reactivation may make retained
  casting effective again when the Actor role is restored.
- Active membership creation requires an active user in the production's
  organization. An active membership must always have at least one role; removing
  the final role is rejected rather than silently deactivating the membership.
- Admin-managed permissions are normalized rows for the following resource keys:
  `production`, `overview`, `timeline`, `characters`, `casting`, `groups`, `songs`,
  `props`, `costumes`, `set_pieces`, `lav_chart`, `cue_categories`, `cues`, `notes`,
  `tasks`, `rehearse`, `rehearsals`, `reports`, `announcements`, `notifications`,
  `people`, and `bookmarks`. Every role/resource pair receives one row for each
  action: `read`, `create`, `update`, and `delete`.
- Seed defaults are intentionally broad and editable: `Member` receives `read` on
  every seeded production resource; `Actor` receives the same reads plus CRUD for
  notes and bookmarks; `Director` receives read access everywhere, CRUD for
  preparation, catalog, rehearsal, announcement, and membership resources, and
  `production.update` for production-scoped settings. Admin access bypasses this
  matrix. The matrix controls production capabilities, not organization-level
  administration.

The original WP1 build-out pause has been passed. The schema, seed path, lifecycle
service, scoped authorization core, People APIs/UI, casting validation, and the
highest-risk actor, rehearsal, notification, and group consumers are now
implemented. Remaining work is test migration/cleanup and any additional
downstream consumer verification.

---

## Proposed work packages

### WP0 — Confirm the domain and permission contract

**Scope**

- Confirm the permission, role, roster, and authorization implementation contracts
  documented above.
- Write the initial production-role permission matrix, including defaults for
  `read`, `create`, `update`, and `delete`.
- Define the App Settings behavior for editing the matrix:
  Admin-only access, global app scope, immediate application to matching active
  memberships, and no per-production copies in V1.
- Define the difference between:
  - organization Admin access,
  - active production membership,
  - production Director capability,
  - production Actor access,
  - character casting.
- Define broad general production visibility for uncast Actors versus assignment-based
  character features.

**Files / systems touched**

- `docs/ROLES.md`
- `docs/PROJECT.md`
- `docs/DATABASE.md`
- This plan

**Done when**

- The role and access matrix is explicit enough to implement without inferring
  permissions from UI labels.
- The manual assignment cutover and inert legacy-role behavior are documented.
- The Settings matrix has an explicit first set of rows and default values.

### WP1 — Add production membership and role data

**Scope**

- Add SQLAlchemy models and relationships for memberships, production roles, and the
  membership-role join.
- Add normalized production-role permission rows and the Admin-managed seed defaults.
- Add an Alembic migration with indexes and uniqueness constraints.
- Seed `Member`, `Director`, and `Actor` production roles.
- Add service functions for creating, updating, deactivating, and loading memberships.
- Validate organization boundaries and active-user requirements.
- Do not backfill existing users, global roles, or character casts. Existing test data
  is updated manually by an Admin.

**Files / systems touched**

- `backend/app/models/`
- `backend/app/models/__init__.py`
- `backend/alembic/versions/`
- `backend/app/services/`
- `backend/app/db/seed.py` or the existing role-seed path
- `docs/DATABASE.md`

**Done when**

- A user can be a Director in Production A, an Actor in Production B, and absent from
  Production C without changing the user's account record.
- Existing character casts continue to resolve.
- Removing a membership does not silently delete the cast record.

**Earlier implementation pause:** WP1 schema, idempotent role/capability seed,
membership lifecycle service, and focused invariant tests were implemented before
the owner authorized continuation into the API, authorization, and frontend work.

**Implementation update:** WP2 production access, WP3 People/permission APIs,
production-scoped casting validation, and the WP4 People workspace are
implemented. The frontend now loads production capabilities and the backend
enforces them across production route families. WP5 has also been started for
actor-specific timeline/rehearsal behavior, announcement audiences, and group
membership validation.

**Verification:** The focused membership, access, People, casting, scoped-role,
notification, and group run reached 38 passing tests and one setup-related
failure in `scoped_test_helpers.py`; the helper transaction boundary is a
known hardening item below. Frontend build and utility tests pass (56 tests).
The complete legacy backend suite remains red because approximately 145 tests
still assume globally seeded `Director`/`Actor` users or pre-cutover cast-only
access; migrating those fixtures and assertions is follow-up work.

### Hardening completion and manual validation

The WP5/WP6 hardening pass is implemented:

- Optional person subjects in props, set pieces, and blocking require active
  production membership.
- Manually called rehearsal users require active production membership, and
  retained calls for inactive members are hidden from current call responses.
- Retained casts on inactive memberships are inactive in readiness, Overview
  counts, character/casting responses, and lav-chart rows/cells without deleting
  historical assignment data.
- Notification modals are production-scoped; announcement and notification
  surfaces honor effective read permissions; CTA targets are canonicalized and
  checked against real route families and target-role capabilities.
- Admins can grant/revoke existing users' Admin role, with self-demotion and
  last-active-Admin safeguards.
- The scoped SQLite test helper now commits membership setup across test-client
  session boundaries, and the People page loads the production role registry
  dynamically while preserving unknown assigned roles.

Automated verification is complete: backend `300 passed, 1 skipped`; frontend
`60 passed`; frontend production build succeeds. Remaining work is the owner's
manual two-production workflow walkthrough and any issues it uncovers before
promoting this plan to shipped status.

The proposed next feature is documented separately in
[casting-and-auditions.md](casting-and-auditions.md). It intentionally starts
after this hardening pass and reserves the Casting nav for a future
capability-gated workspace.

### WP2 — Replace global production access with centralized scoped authorization

**Scope**

- Extend `backend/app/api/deps.py` with explicit production membership and capability
  helpers.
- Keep Admin's organization-wide bypass where appropriate.
- After the manual cutover, remove global Director/Actor role checks as a production
  access source; active membership and its role permissions are authoritative.
- Make production listing return productions the user can actually access:
  - Admin: all organization productions.
  - Active production member: assigned productions, including an uncast Actor.
  - Other organization user: no production access.
- Evaluate production actions through centralized capability checks backed by the
  Admin-configured role matrix. Keep “can view production,” “can edit preparation,”
  and “can manage members” separate.
- Ensure default Director permissions include roster management, role assignment, and
  the current Director preparation workflow, while default Actor permissions include
  broad production read access and only the actor-specific actions allowed by the
  matrix.
- Audit every production-scoped API route for the new helper, including productions,
  characters/casting, Timeline, groups, reports, lav chart, announcements,
  rehearsals, notes, and catalog routes.

**Files / systems touched**

- `backend/app/api/deps.py`
- `backend/app/auth/dependencies.py`
- All production-scoped backend routers
- `frontend/src/context/AuthContext.tsx` and route guards as needed
- `docs/ROLES.md`

**Done when**

- A global Director account no longer sees unrelated productions unless assigned.
- A user assigned to two productions can access exactly the intended two.
- API authorization remains correct even when a caller bypasses the frontend.

### WP3 — Add production people and assignment APIs

**Scope**

Add a small, explicit API contract rather than making the frontend reconstruct
membership from casting. The exact paths can follow local naming conventions, but the
contract should cover:

- List active members for a production, including roles and cast characters.
- List eligible active organization users who are not active members.
- Add an existing user to a production with one or more production roles.
- Update roles or deactivate a membership.
- Return the active production roster for People and Overview, with every member's
  display name and optional email visible to other active members.
- Add Admin-only endpoints for reading and updating the global production-role
  permission matrix.

Responses should include only useful contact and identity fields, such as:

- user ID
- display name
- optional email
- active state
- production roles
- assigned character names/IDs

Do not expose password, password hash, or unrelated organization data.

Casting validation should change from “any active org Actor” to “active production
member with the Actor production role.” `listCastableUsers` should use the same rule.
The existing character-centric casting contract remains the source of truth for this
slice; a separate actor-centric casting API is deferred to the future Casting tab.

**Files / systems touched**

- `backend/app/api/`
- `backend/app/schemas/`
- `backend/app/services/`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/types.ts`

**Done when**

- Admin/authorized Director can add an existing account without selecting a character.
- The same user can be assigned multiple production roles.
- Admins can read and update the global role permission matrix.
- Cast, uncast, replace, and remove operations have clear API responses and errors.

### WP4 — Build the People roster and connect Characters

**Scope**

Add a production-scoped People workspace at `/productions/:id/people`. Keep the
existing Characters page as the character catalog and character-centric casting editor.
The two surfaces should link to each other without duplicating assignment logic:

1. **Production people**
   - active members
   - production roles
   - cast status
   - optional email
   - add existing organization user
   - assign/remove production roles
   - deactivate production membership
   - show every active member's name and optional email to other active members
2. **Characters link**
   - navigate to the character catalog/editor for character assignments
   - show whether a member has character assignments, without replacing the
     character-centric editor
3. **Future Casting reservation**
   - reserve a production navigation slot for auditions, forms, casting notes, and
     related workflows
   - do not implement the Casting tab in this slice

Reuse existing table, select, dialog, loading, error, toast, and empty-state patterns.
Keep `CharactersPage` useful as the character-centric preparation editor and share
data contracts rather than duplicating assignment logic.

Update:

- production navigation
- Overview quick links
- Overview roster/contact section
- readiness casting link to Characters, while People becomes the canonical membership
  entry

**Files / systems touched**

- `frontend/src/App.tsx`
- `frontend/src/components/AppShell.tsx`
- new People page and focused roster components
- `frontend/src/pages/CharactersPage.tsx`
- `frontend/src/pages/ProductionOverviewPage.tsx`
- `frontend/src/lib/overviewSpotlight.ts`

**Done when**

- A Director can add an Actor before choosing a character.
- A Director can assign a Director to the production and see that person on Overview.
- A user can be a Director in one production and an Actor in another.
- An uncast Actor can open the general Script, Timeline, notifications, and other
  permitted production views, while character-specific controls remain unavailable
  until assignment.
- Actor/member views do not expose controls they cannot use, while the API remains the
  final enforcement point.

### WP5 — Reconcile downstream production consumers

**Scope**

Update consumers so they use the right relationship for the job:

- **Timeline and Rehearse:** use character casting for “my lines” and actor-specific
  filters; use active membership and role permissions for general production access.
  An uncast Actor can read the general Script and Timeline but has no character-specific
  “my lines” or actor-filtered result until cast.
- **Rehearsal calls:** derive scene suggestions from cast characters, while allowing
  active production members to be called manually where the existing workflow supports
  it. An uncast Actor should not appear in scene-derived suggestions solely because they
  are a member.
- **Groups:** validate that user members belong to the production.
- **Lav chart:** retain cast-user and uncast-character row behavior; do not create a
  cast row merely because an Actor was pre-added.
- **Blocking and asset person selectors:** use active production members where the
  current feature allows user subjects.
- **Reports:** continue resolving names from the canonical user/character records.
- **Announcements and notifications:** production-targeted audiences should resolve
  from active membership and role permissions rather than global role. An uncast Actor
  remains eligible for normal production notifications.
- **Overview/readiness:** keep cast completeness based on character assignments, not
  membership count.

**Files / systems touched**

- `backend/app/api/`
- `backend/app/services/`
- `frontend/src/hooks/useTimelineScene.ts`
- `frontend/src/pages/RehearsalDetailPage.tsx`
- `frontend/src/pages/CallSheetPage.tsx`
- `frontend/src/pages/GroupsPage.tsx`
- `frontend/src/pages/ReportsPage.tsx`
- lav and asset-related consumers

**Done when**

- Pre-casting a user does not falsely mark a character cast.
- Pre-casting a user does not cause them to appear in scene-derived call suggestions.
- An uncast Actor can see general production content but not assignment-dependent
  character features.
- Removing production membership revokes access consistently across all production
  routes.

### WP6 — Security, migration, and workflow verification

**Scope**

Add backend-first coverage for:

- Admin access to all organization productions.
- Assigned Director access only to assigned productions.
- Assigned Actor access to general production content before casting, with
  assignment-dependent character features withheld.
- A user with different roles in different productions.
- Multiple roles on one membership.
- Union behavior when multiple roles grant different capabilities.
- Admin-only permission-matrix edits and immediate effect on matching memberships.
- Actor membership with no character.
- Character cast, reassign, uncast, and retained membership.
- Deactivated membership losing access immediately.
- Inactive organization users not being newly assigned.
- Foreign production/user IDs and cross-organization attempts.
- Production deletion cascading membership data safely.
- No cross-production leakage in member candidates, castable users, groups, calls,
  reports, notifications, or selectors.

Add at least one end-to-end workflow:

1. Admin creates two users.
2. Admin or authorized Director assigns one as Director in Production A and Actor in
   Production B.
3. Actor is added to Production B without a character.
4. Actor can read the general Script, Timeline, and production notifications but has
   no character-specific experience.
5. Director later assigns a character.
6. Actor sees the expected cast-specific experience.
7. Membership removal revokes access while preserving historical assignment data.

**Files / systems touched**

- `backend/tests/test_production_access.py`
- new `backend/tests/test_production_memberships.py`
- casting, rehearsal, groups, notification, and report test modules
- frontend smoke/build checks
- CI configuration only if the project chooses to add a browser test runner

**Done when**

- The authorization matrix is covered by API tests, not only hidden frontend controls.
- The no-backfill/manual-assignment behavior is tested against representative existing
  users and casts.
- PostgreSQL migration/constraint behavior is checked before production rollout.

### WP7 — Documentation and closeout

**Scope**

After the first vertical slice ships:

- Update `PROJECT.md` core domain model and production preparation workflow.
- Update `DATABASE.md` with the final tables, constraints, and deletion semantics.
- Update `ROLES.md` with organization vs production permissions and the Admin-managed
  role permission matrix.
- Update the feature-plan index and move this plan to shipped/promoted status according
  to the feature-plan lifecycle.
- Add a short operator walkthrough for:
  - creating an account,
  - adding a production member,
  - assigning production roles,
  - casting a character,
  - removing access.

**Done when**

- A future implementer can find the source of truth for both data shape and access
  decisions.
- The docs no longer describe global Director access as the intended long-term model.

---

## First vertical slice recommendation

The smallest complete slice should be:

1. Production membership and production roles for `Member`, `Director`, and `Actor`.
2. Membership/role schema and seeded defaults, with no automatic backfill.
3. Centralized production access based on Admin or active membership.
4. Add existing Actor to a production without a character.
5. Assign a Director to a production.
6. Character casting constrained to production Actor members.
7. People roster plus all-member contact visibility on Overview.
8. Admin-only App Settings editor for the global role permission matrix.
9. Backend authorization and schema/manual-assignment tests.

Build the smallest centralized role-capability layer needed for the matrix. Do not build
per-user ACLs, per-production permission copies, or a generic permission inheritance
engine before a real workflow needs them.

---

## Explicitly out of scope

- Audition forms, casting notes, and conflict-calendar implementation.
- Email/SMS invitations or outbound notification delivery.
- Phone-number and full organization contact-directory work.
- Creating organization accounts from inside a production workspace.
- Understudies, temporary cast overrides, and effective-date casting.
- Attendance, scheduling policy, and HR/absence management.
- Per-user permission overrides (for example, granting Greg Set read/update but not
  delete outside his assigned roles).
- Per-production permission overrides and per-moment permissions.
- Full Stage Manager implementation and role-specific workflow.
- Organization switching and full multi-tenant isolation.
- Assignment history, audit logs, effective dates, or approval workflows.
- Casting tab, audition forms, casting notes, and related workflows.
- Replacing the existing character catalog or one-actor-per-character MVP rule.

These are compatible follow-ons, but including them in the first slice would make it
harder to validate the core membership/access model.

---

## Risks and tradeoffs

- **Authorization blast radius:** changing `get_accessible_production` affects nearly
  every production route. Centralize the decision and test it before changing UI.
- **Manual cutover:** no automatic backfill keeps the data simple but means existing
  Directors and cast Actors must be assigned by an Admin before they regain
  production-scoped access.
- **Membership vs casting confusion:** the UI must make “in the production” and “cast
  as a character” visibly different states.
- **Broad pre-cast visibility:** uncast Actors intentionally receive general Script,
  Timeline, and notification access. Character-dependent endpoints must still require
  the relevant casting or group relationship.
- **Role vocabulary drift:** `Director` and `Actor` currently mean both account role and
  production capability. Documentation, API fields, and frontend guards need a
  deliberate transition.
- **Permission matrix complexity:** the matrix gives useful Admin control now, but
  resource/action naming can become difficult to maintain. Keep the first row set small
  and document each capability; defer per-user exceptions to a later phase.
- **Existing downstream assumptions:** rehearsal, lav, groups, notifications, and
  user selectors currently use organization users or cast inference in different ways.
  Each needs an explicit membership policy rather than a blanket query replacement.

---

## Suggested sequence

1. Resolve WP0 decisions, especially permission vocabulary/defaults, legacy role
   handling, roleless memberships, and inactive-roster visibility.
2. Implement WP1 schema, seeds, and service invariants without backfilling data.
3. Implement WP2 centralized access and update production listing.
4. Implement WP3 people/membership, permission-matrix, and casting API contracts.
5. Build WP4 People roster and Overview contacts.
6. Reconcile the highest-risk consumers in WP5, starting with Timeline, rehearsals,
   groups, lav chart, and notifications.
7. Run WP6 security and workflow verification.
8. Complete WP7 documentation closeout.
9. Only then promote this plan into a phased execution document if the slice is
   approved for build.
