# Phase 16 — Call planner

**Status:** Complete (2026-08-21)  
**Goal:** Director plans blocks (time, location, scenes, people) on a rehearsal.

**Program:** [feature_plans/rehearsal-management.md](feature_plans/rehearsal-management.md)

## Scope

- Tables: `rehearsal_blocks`, `rehearsal_block_scenes`, `rehearsal_block_calls`
- Suggest cast from casting ∩ scene presence (dialogue/lyrics/E&E)
- Scene recommendations by `times_rehearsed`
- Save plan → status `planned`; warn on overlapping double-book (soft)
- UI: rehearsal detail planner

## Done when

Director can plan a called Thursday with multiple time/room blocks and edit who’s called.
