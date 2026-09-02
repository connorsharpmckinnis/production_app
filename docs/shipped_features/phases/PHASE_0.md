# Phase 0 — Foundation & Standards

**Status:** Complete

Working home for Phase 0 tasks. Phase 1 work: [PHASE_1.md](PHASE_1.md).

---

## Goals

- [x] Define project architecture
- [x] Finalize domain model
- [x] Finalize terminology
- [x] Design PostgreSQL schema (draft)
- [x] Design UI navigation and interaction standards (Slice 1)
- [x] Create coding standards
- [x] Create AI development standards
- [x] Define standard script format
- [x] Add production script fixture
- [x] Produce importer specification

---

## Deliverables

| Deliverable | Status | Location |
|---|---|---|
| Project vision & architecture | Done | [PROJECT.md](PROJECT.md) |
| Database schema (draft) | Done | [DATABASE.md](DATABASE.md) |
| Script format | Done | [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) |
| Development standards | Done | [DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) |
| Import specification | Done | [IMPORT_SPEC.md](IMPORT_SPEC.md) |
| ERD | Done | [ERD.md](ERD.md) |
| UI standards (Slice 1) | Done | [UI_STANDARDS.md](UI_STANDARDS.md) |
| Role permissions matrix | Done | [ROLES.md](ROLES.md) |
| Seed data spec | Done | [SEED_DATA.md](SEED_DATA.md) |
| Sample script fixtures | Done | [fixtures/scripts/](../fixtures/scripts/) |
| Phase 0 exit review | Done | 2026-07-08 |

---

## Decisions Log

| Date | Decision |
|---|---|
| 2026-07-08 | MVP imports `.md` from Google Docs export |
| 2026-07-08 | Importer uses line-by-line regex; full fail on error with line number |
| 2026-07-08 | `moment_types` lookup table with 6 seed types |
| 2026-07-08 | MVP roles: Admin, Director, Actor |
| 2026-07-08 | Admin-only: import, user management, create/delete production |
| 2026-07-08 | Actors view-only on timeline; may add Notes |
| 2026-07-08 | One organization per deployment |
| 2026-07-08 | Dropped `productions.published` and `productions.status` |
| 2026-07-08 | Preparation progress deferred to post-MVP |
| 2026-07-08 | Phase 1 test fixture: `endurance-scene1.md` only |
| 2026-07-08 | Ignore Google Drive URLs on song headers |
| 2026-07-08 | Importer must repair UTF-8 mojibake (`â€™`, `â€"`) |

---

## Notes

Google Docs export format differs from ideal plain-text SCRIPT_FORMAT. Full script cleanup is deferred; see [IMPORT_SPEC.md](IMPORT_SPEC.md).
