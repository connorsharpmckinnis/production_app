# Phase 15 — Rehearsal slots foundation

**Status:** Complete (2026-08-21)  
**Goal:** Org locations + production rehearsal reserved slots (CRUD + list). Ad-hoc create supported.

**Program:** [feature_plans/rehearsal-management.md](feature_plans/rehearsal-management.md)

## Scope

- Tables: `locations`, `rehearsals`; `scenes.times_rehearsed` / `last_rehearsed_at` (for later phases)
- Block/notes tables may land here for forward compatibility
- Seed default STP rooms per org
- API: list/create/update/delete rehearsals; list locations
- UI: `/productions/:id/rehearsals` list + create/edit dialog; nav **Rehearsals**
- Roles: Director/Admin write; authenticated cast can list (detail gated in Phase 17)

## Done when

Staff can enter a season’s reserved nights and create an ad-hoc extra rehearsal.
