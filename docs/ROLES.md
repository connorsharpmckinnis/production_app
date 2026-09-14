# Role Permissions (MVP)

**Version:** 0.3 (custom production roles 2026-09-13)

Defines organization-level and production-level access. Schema: [DATABASE.md](DATABASE.md)
(`app_roles`, `user_app_roles`, and production membership tables).

The only organization-wide role is **Admin**. **Director**, **Actor**, **Member**, and
any Admin-created custom roles (for example Stage Manager) are production-scoped roles
assigned through an active production membership.

---

## Organization role

| Action | Admin |
| --- | --- |
| Create/delete production | Yes |
| Import script | Yes |
| Create/edit/deactivate organization users | Yes |
| Reset user passwords | Yes |
| Assign organization-level Admin | Yes |
| Create/edit/deactivate production role definitions | Yes |
| Change the production-role permission matrix | Yes |

Admin access bypasses production membership and production-role permission checks.
The Admin role is the only global bypass in V1.

## Production role defaults

Production roles are reusable **org-wide** definitions with immutable codes and editable
labels/descriptions. System codes (`member`, `director`, `actor`) are seeded and cannot
be deactivated. Admins may create additional custom roles in App Settings; new roles
receive a full resource/action matrix copied from an existing role (often Director).

A membership may have more than one role. Effective permissions are the union of enabled
permissions on all **active** roles. Inactive custom roles cannot be newly assigned and
do not contribute capabilities.

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

The exact rows remain Admin-editable in App Settings (select a role, then edit grouped
resources). Admin changes apply on the next authorization check to every matching
active membership. V1 has no per-member overrides.

`casting` is intentionally a staff-facing capability. It is reserved for the
future production Casting workspace and is not granted to Member or Actor by
the seeded defaults. Future casting-specific roles can receive it through the
same matrix.

### Recommended custom role: Stage Manager

Do **not** seed Stage Manager. Create it in App Settings as a pilot of the role
builder:

1. **Create role** → name `Stage Manager`, code `stage_manager` (optional; auto-slugged
   from the name if omitted).
2. **Copy permissions from** `Director`.
3. Leave Admin-only operations alone (import, user admin, production create/delete stay
   outside the matrix / Admin-only).
4. Optionally tighten later if Emmy’s SMs should not manage casting or people.

Recommended starting point (same as Director’s current matrix): full prep/catalog/lav/
rehearsal/people/casting CRUD; `production.update`; read elsewhere. That lets an SM run
Scrooge day-to-day without sharing the Director login or receiving Admin.

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

## Existing MVP behavior (matrix-governed)

Seeded defaults for production capabilities (Admin always bypasses):

| Capability | Admin | Active production Director | Active production Actor |
| --- | --- | --- | --- |
| Edit timeline preparation data (props, cues, blocking, catalogs) | Yes | Matrix-controlled | No by default |
| Correct script content on Moments (type, parsed text, attributions) | Yes | No | No |
| View general production content | Yes | Matrix-controlled | Yes, including before casting |
| Cast actors to characters | Yes | Matrix-controlled | No |
| Actor-filtered / “My lines” views | Yes | Available when relevant | Only after character assignment |
| Manage users and passwords | Yes | No | No |
| Act as another user | Yes | No | No |
| View published call / My call | Yes | Matrix-controlled | Matrix-controlled |

An active, uncast Actor can access a production when their membership and
permissions allow it. Older Phase 2 cast-only production-list filtering is
historical.


---



## Rules

- **Import is Admin-only.** Directors prepare productions but cannot upload or re-import scripts.
- **Script content correction is Admin-only.** Moment type, parsed text, stage-direction text, and dialogue / lyric / song-attribution subjects are Admin-gated (import imperfections are fixed in Moment Detail without re-import). Directors still edit preparation overlays (props, cues, blocking, costumes, set pieces, notes) and structural insert/delete/reorder.
- **Actors are view-only on the Timeline** except for Notes and Bookmarks.
- **User management is Admin-only.** Includes account creation, password resets, role assignment, and deactivation.
- **Production role definitions are Admin-only.** Directors assign existing roles on People; they do not create custom roles.
- **Act as user is Admin-only.** An Admin may switch their session to another active org user to verify that account’s view. The JWT carries an impersonator claim; nested act-as is blocked; a banner + **Return to admin** restores the original Admin session. Not a separate SuperAdmin role.
- **Directors** can edit timeline preparation work on existing productions. They cannot create, delete, or import productions, cannot correct script content fields, and cannot manage users.
- **Casting data is private by capability.** Future casting notes and individual
  availability dates are visible only to Admins and active production members
  with the relevant Casting capability; being the subject of a note does not
  grant visibility.
- **Inactive memberships are not effective.** Deactivation preserves historical
  membership, role, and cast rows, but those rows do not grant access or count as
  current actor behavior.
- **Inactive custom roles are not assignable.** Soft-deactivated roles remain in
  Settings for reactivation but are hidden from People role pickers and do not
  contribute capabilities.

## Current implementation gaps

- The future Casting workspace, casting notes, and availability records are
  planned in [casting-and-auditions.md](feature_plans/casting-and-auditions.md);
  they are not current permissions-backed features.
- Announcement audience targeting still uses the fixed Title Case set
  (`Admin` / `Director` / `Actor` / `Member`). Custom roles such as Stage Manager
  are not announcement targets yet.

---
