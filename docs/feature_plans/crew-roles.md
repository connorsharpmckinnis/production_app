# Feature plan — Crew roles (beyond Member / Director / Actor)

**Status:** Partial ship — custom production role builder (2026-09-13); Stage Manager is created in-app, not seeded  
**Created:** 2026-07-29  
**Updated:** 2026-09-13  
**Related:** [ROLES.md](../ROLES.md), [PROJECT.md](../PROJECT.md) future roles, [DATABASE.md](../DATABASE.md) production roles, [production-membership-and-casting-workspace.md](production-membership-and-casting-workspace.md) (shipped), [soft-pilot-ops.md](soft-pilot-ops.md), [print-and-call-sheets.md](print-and-call-sheets.md)

---

## Goal

Add **crew-shaped roles** so Stage Managers, lighting, sound, costumes, etc. get **appropriate access** without sharing the Director login or granting full Admin.

**Primary motivating UX:** Admin creates a Stage Manager role in Settings; Emmy assigns it on Scrooge People; SM accounts edit entrances/blocking, run call sheets, manage lav chart — but cannot import scripts or manage users.

**Secondary motivating UX:** Sound can edit lav assignments; Costume can edit costumes/events; Lighting can edit cues — without full Timeline structure rights if you choose a narrow matrix.

**Tertiary motivating UX:** Soft pilot stops relying on “everyone trusted is a Director.”

---

## Problem

Organization Admin plus three production roles (`member`, `director`, `actor`)
are still coarse for specialized crew:

| Role | Gap |
| ---- | --- |
| Admin | Too powerful for day-to-day crew |
| Director | Catch-all for all prep — over-shares |
| Actor / Member | Too weak for crew |

STP reality includes people who should touch **one domain** hard and others lightly.
The shipped membership matrix already supports adding new production role codes;
this plan is about which crew roles to add and what defaults they get.

---

## Shipped (2026-09-13)

Admin App Settings now supports:

- Creating org-wide custom production roles (immutable `code`, editable name/description)
- Copying the current permission matrix from an existing role
- Editing one role’s matrix at a time with collapsible resource groups
- Soft-deactivating unused custom roles (system `member` / `director` / `actor` cannot be deactivated)
- Assigning any active custom role on the People roster (Directors keep People manage by default)

Stage Manager is **not** seeded. Create it in Settings as the pilot of the builder.
Recommended defaults: copy from Director (see [ROLES.md](../ROLES.md)).

---

## Product model (proposed)

### Role set (v1 candidates)

Keep global app roles simple; avoid exploding into 12 roles on day one.

| Role | Intent |
| ---- | ------ |
| **Admin** | Users, productions create/delete, import, org catalog (unchanged core) |
| **Director** | Full artistic/prep edit (today’s Director) |
| **Stage Manager** | Timeline prep edits that SM owns: E/E, blocking, notes, call sheets, maybe props/sets; no user admin; **no script import** (or import only if you explicitly want) |
| **Actor** | View + notes/bookmarks + Rehearse (unchanged) |
| **Crew** (generic) | View + edit **assigned domains** only |

**Recommendation (resolved):** Admin-created named production roles (Stage Manager first via Settings), not per-production role catalogs and not Director-created roles.

---

## Permission matrix sketch (SM)

| Action | SM |
| ------ | --- |
| View timeline / reports / packs / charts | Yes |
| Edit moments content / structure (add/delete/reorder) | Yes (same as Director for pilot) |
| E/E, blocking, notes | Yes |
| Catalogs + Phase 14 events | Yes |
| Lav chart | Yes |
| Casting / groups | Yes for pilot (copy Director); tighten later if needed |
| Import script / create production / users | No (Admin-only) |
| Org catalog manage | No |

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Organization role | Admin only via `app_roles` / `user_app_roles` |
| Production-scoped roles | Shipped — system `member` / `director` / `actor` plus Admin-created custom roles |
| Role builder | Shipped — App Settings create + per-role matrix editor |
| Docs | [ROLES.md](../ROLES.md); membership ship: [production-membership-and-casting-workspace.md](production-membership-and-casting-workspace.md) |

---

## Explicitly out of scope (still)

- Fine-grained per-moment ACLs
- External SSO role sync
- “Guest designer” time-boxed accounts (can be later)
- Replacing Planning Center people directory
- Per-production role definition catalogs
- Directors creating custom roles
- Announcement audience targeting for custom role names (still Admin/Director/Actor/Member only)
- Named Lighting/Sound seeded roles (create via Settings when needed)

---

## Open questions

1. **Named roles vs permission flags?**  
   **Resolved for now:** named custom roles via Settings; domain flags only after a second crew type appears during pilot.
2. **Can SM import?**  
   **Recommendation:** No — keep sacred script import Admin-only unless STP demands otherwise.
3. **Production-scoped role assignment?**  
   **Resolved:** production-scoped assignment; org-wide role definitions.
4. **Lighting/Sound as roles or just Director?**  
   **Recommendation:** defer named roles; create via Settings when pain is real.

---

## Done when

- [x] Admin can create a crew-shaped role (SM) in Settings with a written matrix in ROLES.md.
- Soft pilot can avoid shared Director passwords for SM work (once Emmy assigns the role).
- [x] Actor permissions unchanged.
- [x] Admin-only operations remain Admin-only.

---

## Remaining follow-ups

1. Emmy pilot: create Stage Manager in Settings (copy Director), add SM users, assign on Scrooge People.
2. Extend announcement audience targeting beyond the fixed Title Case role set.
3. Domain toggles / narrower SM matrix only after real pilot feedback.
4. Named Lighting/Sound only if Settings-created roles prove insufficient.

---

## Risks / tradeoffs

- Role explosion — resist until STP names the seats; prefer Settings-created roles over seed churn.
- Half-hidden buttons vs hard API denials — **API must enforce** (already capability-based).
- Announcement targeting lag — SM-only members will not match Director/Actor/Member audience checkboxes until that follow-up ships.
