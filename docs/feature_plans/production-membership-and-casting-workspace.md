# Feature plan — Production membership & casting workspace

**Status:** Proposal  
**Created:** 2026-08-28  
**Related:** [ROLES.md](../ROLES.md), [PROJECT.md](../PROJECT.md), [DATABASE.md](../DATABASE.md), [crew-roles.md](crew-roles.md), [understudies-and-cast-overrides.md](understudies-and-cast-overrides.md), [production-home-and-modes.md](production-home-and-modes.md)

---

## Goal

Give each production an explicit roster and a durable people/casting workspace.

The feature should let an Admin or an authorized production lead:

- Add an existing organization user to a production before casting.
- Assign one or more production roles to that person.
- Assign actors to characters independently of production membership.
- Assign one person different roles in different productions.
- Show the people responsible for a production on its Overview page.

The data model should support future roles such as Stage Manager without making every
organization-wide Director or Actor account automatically part of every production.

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

- `Director`
- `Actor`

The role registry should make later additions such as `Stage Manager` possible without
reintroducing organization-wide access. Role-specific permission flags and a large
crew-role taxonomy remain later work.

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

Constraints and invariants:

- Unique `(production_id, user_id)` membership.
- Unique `(membership_id, production_role_id)` assignment.
- Foreign keys with production/member deletion behavior documented.
- Only active organization users can receive a new active membership.
- A membership and its user must belong to the production's organization.
- A cast user must be an active member with the `Actor` production role.
- Existing one-actor-per-character uniqueness remains in place.

The separate membership row is intentional. It allows a future access-only or
administrative production participant without forcing every person into a role, while
the role join allows one person to hold multiple capacities in the same production.

---

## Open questions

These decisions should be resolved before implementation is authorized.

1. **Which organization-wide roles remain after the migration?**  
   **Recommendation:** retain `Admin` as the organization-level administrative role;
   move the operational meaning of `Director` and `Actor` to production roles. Keep
   legacy role data readable during migration, but stop using a global Director role as
   an automatic production-access bypass.

2. **How should existing Directors be migrated?**  
   **Recommendation:** backfill each current Director as a Director member of every
   existing production, preserving today's access while making the relationship
   explicit and removable. Backfill Actor membership from existing character casts.
   Actors with no cast remain organization users with no production membership.

   Alternative: require Admins to assign every Director manually. This produces the
   cleanest end state but risks unexpectedly locking out existing production leads.

3. **Who may manage a production roster?**  
   **Recommendation:** Admins and active production Directors may add or remove
   existing organization users and assign production roles. Account creation,
   password resets, and organization-level deactivation remain Admin-only.

4. **What may an uncast Actor member see?**  
   **Recommendation:** membership grants access to production-level member workflows,
   but not automatically to the script, Timeline, or other cast-specific content until
   the user has a character assignment. This matches the stated need to prepare users
   for future audition/conflict workflows while avoiding accidental script exposure.

   Simpler alternative: any active Actor member receives the same read access as a cast
   Actor. This is easier but should be chosen deliberately because it broadens current
   actor data access.

5. **Who can see production contacts and which fields are public?**  
   **Recommendation:** all active production members can see assigned Directors'
   display names and optional email addresses on Overview. Do not add phone numbers or
   a full contact-directory feature in this slice; the current User model has no phone
   field.

6. **Can a person hold multiple roles in one production?**  
   **Recommendation:** yes. The membership-role join supports combinations such as
   Director + Actor and avoids encoding role precedence into the schema. The first UI
   should allow multiple roles even if the common workflow only uses one.

7. **Should production role assignment carry dates or history now?**  
   **Recommendation:** start with active/inactive membership and timestamps. Defer
   effective dates, assignment history, invitations, and audit logs until a real
   scheduling or archival workflow requires them.

8. **What should the durable UI name and route be?**  
   **Recommendation:** use a production-scoped `People` or `People & casting` workspace,
   with a route such as `/productions/:id/people`. Keep `Characters` as the
   character-catalog/editor surface and link both from Overview and the production nav.

---

## Proposed work packages

### WP0 — Confirm the domain and permission contract

**Scope**

- Resolve the open questions above.
- Write the initial production-role permission matrix.
- Define the difference between:
  - organization Admin access,
  - active production membership,
  - production Director capability,
  - production Actor access,
  - character casting.
- Decide whether an uncast member can view script/Timeline data.

**Files / systems touched**

- `docs/ROLES.md`
- `docs/PROJECT.md`
- `docs/DATABASE.md`
- This plan

**Done when**

- The role and access matrix is explicit enough to implement without inferring
  permissions from UI labels.
- Migration behavior for existing users is approved.

### WP1 — Add production membership and role data

**Scope**

- Add SQLAlchemy models and relationships for memberships, production roles, and the
  membership-role join.
- Add an Alembic migration with indexes and uniqueness constraints.
- Seed `Director` and `Actor` production roles.
- Add service functions for creating, updating, deactivating, and loading memberships.
- Validate organization boundaries and active-user requirements.
- Backfill existing data according to the approved migration policy.

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

### WP2 — Replace global production access with centralized scoped authorization

**Scope**

- Extend `backend/app/api/deps.py` with explicit production membership and capability
  helpers.
- Keep Admin's organization-wide bypass where appropriate.
- Remove the global Director automatic-access bypass after the migration compatibility
  window.
- Make production listing return productions the user can actually access:
  - Admin: all organization productions.
  - Active production member: assigned productions according to the approved
    pre-cast visibility policy.
  - Other organization user: no production access.
- Separate “can view production” from “can edit preparation” and “can manage members”
  so future roles do not require scattered role-name checks.
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
- Return the production's Director contacts for Overview.
- Return actor-centric casting rows while preserving the existing character-centric
  cast endpoint during transition.

Responses should include only useful contact and identity fields, such as:

- user ID
- display name
- optional email
- active state
- production roles
- assigned character names/IDs

Do not expose password, password hash, or unrelated organization data.

Casting validation should change from “any active org Actor” to “active production
member with the Actor production role.” `listCastableUsers` should use the same rule or
be retired in favor of the workspace response.

**Files / systems touched**

- `backend/app/api/`
- `backend/app/schemas/`
- `backend/app/services/`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/types.ts`

**Done when**

- Admin/authorized Director can add an existing account without selecting a character.
- The same user can be assigned multiple production roles.
- Cast, uncast, replace, and remove operations have clear API responses and errors.

### WP4 — Build the People & casting workspace

**Scope**

Add a production-scoped workspace, recommended as `/productions/:id/people`, with
separate but connected sections:

1. **Production people**
   - active members
   - production roles
   - cast status
   - optional email
   - add existing organization user
   - assign/remove production roles
   - deactivate production membership
2. **Casting**
   - actor-centric roster, including Actors with no character
   - character assignments, including unassigned characters
   - support one actor on multiple characters
   - preserve the current one-actor-per-character rule
3. **Contacts**
   - Director(s) shown as the initial production contact list
   - link or copy the existing optional email field without inventing a new contact
     system

Reuse existing table, select, dialog, loading, error, toast, and empty-state patterns.
Keep `CharactersPage` useful as the character-centric preparation editor; share
casting components or data contracts rather than duplicating assignment logic.

Update:

- production navigation
- Overview quick links
- Overview contact section
- readiness casting link if the new workspace becomes the canonical casting entry

**Files / systems touched**

- `frontend/src/App.tsx`
- `frontend/src/components/AppShell.tsx`
- new people/casting page and focused components
- `frontend/src/pages/CharactersPage.tsx`
- `frontend/src/pages/ProductionOverviewPage.tsx`
- `frontend/src/lib/overviewSpotlight.ts`

**Done when**

- A Director can add an Actor before choosing a character.
- A Director can assign a Director to the production and see that person on Overview.
- A user can be a Director in one production and an Actor in another.
- Actor/member views do not expose controls they cannot use, while the API remains the
  final enforcement point.

### WP5 — Reconcile downstream production consumers

**Scope**

Update consumers so they use the right relationship for the job:

- **Timeline and Rehearse:** use character casting for “my lines” and actor-specific
  filters; use the approved membership policy for general production access.
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
- **Announcements and notifications:** production-targeted audiences should eventually
  resolve from active membership rather than global role. Make this a required audit
  point; implement only the parts needed for the first vertical slice.
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
- Removing production membership revokes access consistently across all production
  routes.

### WP6 — Security, migration, and workflow verification

**Scope**

Add backend-first coverage for:

- Admin access to all organization productions.
- Assigned Director access only to assigned productions.
- Assigned Actor access according to the approved pre-cast visibility policy.
- A user with different roles in different productions.
- Multiple roles on one membership.
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
4. Actor receives the approved pre-cast view.
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
- Migration behavior is tested against representative existing users and casts.
- PostgreSQL migration/constraint behavior is checked before production rollout.

### WP7 — Documentation and closeout

**Scope**

After the first vertical slice ships:

- Update `PROJECT.md` core domain model and production preparation workflow.
- Update `DATABASE.md` with the final tables, constraints, and deletion semantics.
- Update `ROLES.md` with organization vs production permissions.
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

1. Production membership and production roles for `Director` and `Actor`.
2. Migration/backfill of current Directors and cast Actors.
3. Centralized production access based on Admin or active membership.
4. Add existing Actor to a production without a character.
5. Assign a Director to a production.
6. Character casting constrained to production Actor members.
7. People/casting page plus Director contact section on Overview.
8. Backend authorization and migration tests.

Do not begin with a generic permissions engine. The role registry and centralized
capability checks should leave room for one later Stage Manager role without building
fine-grained ACL infrastructure before a real workflow needs it.

---

## Explicitly out of scope

- Audition forms and conflict-calendar implementation.
- Email/SMS invitations or outbound notification delivery.
- Phone-number and full organization contact-directory work.
- Creating organization accounts from inside a production workspace.
- Understudies, temporary cast overrides, and effective-date casting.
- Attendance, scheduling policy, and HR/absence management.
- Fine-grained per-domain or per-moment permissions.
- Full Stage Manager implementation and permission matrix.
- Organization switching and full multi-tenant isolation.
- Assignment history, audit logs, effective dates, or approval workflows.
- Replacing the existing character catalog or one-actor-per-character MVP rule.

These are compatible follow-ons, but including them in the first slice would make it
harder to validate the core membership/access model.

---

## Risks and tradeoffs

- **Authorization blast radius:** changing `get_accessible_production` affects nearly
  every production route. Centralize the decision and test it before changing UI.
- **Migration surprise:** backfilling Directors to every current production preserves
  access but requires cleanup. Manual reassignment is cleaner but risks lockout.
- **Membership vs casting confusion:** the UI must make “in the production” and “cast
  as a character” visibly different states.
- **Pre-cast privacy:** membership is useful before casting, but it must not silently
  grant script or cast data. Resolve this before implementing actor visibility.
- **Role vocabulary drift:** `Director` and `Actor` currently mean both account role and
  production capability. Documentation, API fields, and frontend guards need a
  deliberate transition.
- **Future role explosion:** a normalized role join is useful; a large collection of
  role-specific permissions is intentionally deferred.
- **Existing downstream assumptions:** rehearsal, lav, groups, notifications, and
  user selectors currently use organization users or cast inference in different ways.
  Each needs an explicit membership policy rather than a blanket query replacement.

---

## Suggested sequence

1. Resolve WP0 decisions, especially migration and uncast-member visibility.
2. Implement WP1 schema, seeds, backfill, and service invariants.
3. Implement WP2 centralized access and update production listing.
4. Implement WP3 people/membership and casting API contracts.
5. Build WP4 People & casting workspace and Overview contacts.
6. Reconcile the highest-risk consumers in WP5, starting with Timeline, rehearsals,
   groups, lav chart, and notifications.
7. Run WP6 security and workflow verification.
8. Complete WP7 documentation closeout.
9. Only then promote this plan into a phased execution document if the slice is
   approved for build.
