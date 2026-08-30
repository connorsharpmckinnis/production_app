# Role Permissions (MVP)

**Version:** 0.1

Defines organization-level and production-level access. Schema: [DATABASE.md](DATABASE.md)
(`app_roles`, `user_app_roles`, and production membership tables).

The only organization-wide role is **Admin**. **Director** and **Actor** are
production-scoped roles assigned through an active production membership.

---

## Organization role

| Action | Admin |
| --- | --- |
| Create/delete production | Yes |
| Import script | Yes |
| Create/edit/deactivate organization users | Yes |
| Reset user passwords | Yes |
| Assign organization-level Admin | Yes |
| Change the production-role permission matrix | Yes |

Admin access bypasses production membership and production-role permission checks.
The Admin role is the only global bypass in V1.

## Production role defaults

Production roles are reusable definitions with immutable codes (`member`,
`director`, `actor`) and editable labels/descriptions. A membership may have more
than one role. Effective permissions are the union of enabled permissions on all
active roles.

The normalized matrix stores one row for every role/resource/action combination.
Actions are `read`, `create`, `update`, and `delete`. These are the seeded
resource keys:

`production`, `overview`, `timeline`, `characters`, `casting`, `groups`, `songs`,
`props`, `costumes`, `set_pieces`, `lav_chart`, `cue_categories`, `cues`, `notes`,
`tasks`, `rehearse`, `rehearsals`, `reports`, `announcements`, `notifications`,
`people`, and `bookmarks`.

| Production role | Seeded default |
| --- | --- |
| Member | `read` on every production resource; no create/update/delete |
| Actor | Member reads plus CRUD for `notes` and `bookmarks`; no other writes |
| Director | `read` everywhere; CRUD for preparation, catalog, rehearsal, announcement, casting, and `people` resources; `production.update`; no production create/delete |

The exact rows remain Admin-editable in App Settings. Admin changes apply on the
next authorization check to every matching active membership. V1 has no
per-member overrides.

`casting` is intentionally a staff-facing capability. It is reserved for the
future production Casting workspace and is not granted to Member or Actor by
the seeded defaults. Future casting-specific roles can receive it through the
same matrix.

## Legacy global roles

Existing global `Director` and `Actor` roles are not part of the target model and
must not grant production access. Fresh seeds create only the global `Admin` role;
the configured Admin account is ensured on every seed run. Production access for
former global Directors and Actors is restored by manually assigning production
memberships and roles. No automatic production or cast backfill is performed.

## Historical casting and membership

Membership and casting are separate. An Actor may be a member before receiving a
character, and removing a character assignment does not remove membership.
Deactivating a membership preserves its role and cast rows, but they are inactive
for access, casting eligibility, readiness, and actor-specific views. Re-adding the
same user reactivates the existing membership rather than creating a duplicate.

## Existing MVP behavior during transition

The following production capabilities are moving to the normalized matrix:

| Capability | Admin | Active production Director | Active production Actor |
| --- | --- | --- | --- |
| Edit timeline and preparation data | Yes | Matrix-controlled | No by default |
| View general production content | Yes | Matrix-controlled | Yes, including before casting |
| Cast actors to characters | Yes | Matrix-controlled | No |
| Actor-filtered / “My lines” views | Yes | Available when relevant | Only after character assignment |
| Manage users and passwords | Yes | No | No |
| Act as another user | Yes | No | No |
| View published call / My call | Yes | Matrix-controlled | Matrix-controlled |

The membership model is now the source of truth for production access. Older
Phase 2 behavior that filtered Actors' production lists from character casts is
historical; an active, uncast Actor can access a production when their
membership and permissions allow it.


---



## Rules

- **Import is Admin-only.** Directors prepare productions but cannot upload or re-import scripts.
- **Actors are view-only on the Timeline** except for Notes and Bookmarks.
- **User management is Admin-only.** Includes account creation, password resets, role assignment, and deactivation.
- **Act as user is Admin-only.** An Admin may switch their session to another active org user to verify that account’s view. The JWT carries an impersonator claim; nested act-as is blocked; a banner + **Return to admin** restores the original Admin session. Not a separate SuperAdmin role.
- **Directors** can edit timeline and perform preparation work on existing productions. They cannot create, delete, or import productions, and cannot manage users.
- **Casting data is private by capability.** Future casting notes and individual
  availability dates are visible only to Admins and active production members
  with the relevant Casting capability; being the subject of a note does not
  grant visibility.
- **Inactive memberships are not effective.** Deactivation preserves historical
  membership, role, and cast rows, but those rows do not grant access or count as
  current actor behavior.

## Current implementation gaps

- Editing an existing user's organization-level Admin assignment is not yet
  available in the current Users API/UI; assignment is supported during account
  creation. This is tracked in
  [production-membership-and-casting-workspace.md](feature_plans/production-membership-and-casting-workspace.md)
  WP0.
- The future Casting workspace, casting notes, and availability records are
  planned in [casting-and-auditions.md](feature_plans/casting-and-auditions.md);
  they are not current permissions-backed features.

---

