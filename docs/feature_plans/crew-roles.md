# Feature plan — Crew roles (beyond Admin / Director / Actor)

**Status:** Roadmap (approved intent — build eventually; not yet phased)  
**Created:** 2026-07-29  
**Related:** [ROLES.md](../ROLES.md), [PROJECT.md](../PROJECT.md) future roles, [DATABASE.md](../DATABASE.md) `app_roles`, [soft-pilot-ops.md](soft-pilot-ops.md), [print-and-call-sheets.md](print-and-call-sheets.md)

---

## Goal

Add **crew-shaped roles** so Stage Managers, lighting, sound, costumes, etc. get **appropriate access** without sharing the Director login or granting full Admin.

**Primary motivating UX:** SM account can edit entrances/blocking, run call sheets, manage lav chart — but cannot import scripts or manage users.

**Secondary motivating UX:** Sound can edit lav assignments; Costume can edit costumes/events; Lighting can edit cues — without full Timeline structure rights if you choose a narrow matrix.

**Tertiary motivating UX:** Soft pilot stops relying on “everyone trusted is a Director.”

---

## Problem

MVP roles are coarse:

| Role | Gap |
| ---- | --- |
| Admin | Too powerful for day-to-day crew |
| Director | Catch-all for all prep — over-shares |
| Actor | Too weak for crew |

STP reality includes people who should touch **one domain** hard and others lightly.

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

**Alternative (recommended if unsure):** don’t add many named roles yet — add **Director-equivalent** vs **domain permissions** flags:

- `can_edit_lavs`, `can_edit_cues`, `can_edit_costumes`, `can_edit_props_sets`, `can_edit_timeline_structure`

Assigned per user per production (or org-wide defaults).

**Recommendation:** start with **one new role: Stage Manager** (copy Director minus import/user/production delete), plus optional domain toggles later for sound/lighting/costumes. Avoid six thin roles until a pilot asks for them.

---

## Permission matrix sketch (SM)

| Action | SM |
| ------ | --- |
| View timeline / reports / packs / charts | Yes |
| Edit moments content / structure (add/delete/reorder) | Yes (same as Director) **or** No — open question |
| E/E, blocking, notes | Yes |
| Catalogs + Phase 14 events | Yes |
| Lav chart | Yes |
| Casting / groups | Yes (helpful for SM) or Director-only |
| Import script / create production / users | No |
| Org catalog manage | No |

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Roles | Admin, Director, Actor via `app_roles` / `user_app_roles` |
| Production-scoped roles | Not really — app roles are global; Actor production access via casting |
| Docs | ROLES.md MVP matrix |

---

## Explicitly out of scope (v1)

- Fine-grained per-moment ACLs
- External SSO role sync
- “Guest designer” time-boxed accounts (can be later)
- Replacing Planning Center people directory

---

## Open questions

1. **Named roles vs permission flags?**  
   **Recommendation:** Stage Manager named role first; flags if a second crew type appears during pilot.
2. **Can SM import?**  
   **Recommendation:** No — keep sacred script import Admin-only unless STP demands otherwise.
3. **Production-scoped role assignment?**  
   **Recommendation:** eventually yes (SM on Show A, Actor on Show B). v1 may keep global roles if that’s how auth works today — call out migration need.
4. **Lighting/Sound as roles or just Director?**  
   **Recommendation:** defer named roles; use shared SM/Director until pain is real.

---

## Done when

- At least one crew-shaped role (SM) exists with a written matrix in ROLES.md.
- Soft pilot can avoid shared Director passwords for SM work.
- Actor permissions unchanged.
- Admin-only operations remain Admin-only.

---

## Suggested build sequence

1. Decide SM matrix with owner; update ROLES.md.
2. Backend permission checks + role seed.
3. UI: hide forbidden actions; role labels in user admin.
4. Production-scoped roles if global roles prove wrong.
5. Domain toggles only after a real request.

---

## Risks / tradeoffs

- Role explosion — resist until STP names the seats.
- Half-hidden buttons vs hard API denials — **API must enforce**.
- Production-scoped needs may force auth refactor — design flags early even if UI is global at first.
