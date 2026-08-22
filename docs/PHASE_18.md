# Phase 18 — Open rehearsal, notes, complete

**Status:** Complete (2026-08-21)  
**Goal:** Live session notes workspace; complete increments `times_rehearsed`.

**Program:** [feature_plans/rehearsal-management.md](feature_plans/rehearsal-management.md)

## Scope

- Table: `rehearsal_notes`
- Open → `in_progress`; complete → `completed` + idempotent scene count bump
- Director notes CRUD (own notes)
- Planning locked when completed (Admin reopen optional / simple unlock)

## Done when

Director leaves notes, completes, and next plan recommendations shift.
