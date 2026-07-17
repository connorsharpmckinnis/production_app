# Theater App

## Project Vision & Architecture

**Version:** 0.1 (Pre-Development Draft)

Companion documents:

- [DATABASE.md](DATABASE.md) — PostgreSQL schema and data-model decisions
- [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) — standard script format for import
- [IMPORT_SPEC.md](IMPORT_SPEC.md) — importer line classification and error policy
- [PHASE_0.md](PHASE_0.md) — Phase 0 tasks (complete)
- [PHASE_1.md](PHASE_1.md) — Phase 1 execution plan (complete)
- [PHASE_2.md](PHASE_2.md) — Phase 2 execution plan
- [PHASE_3.md](PHASE_3.md) — Phase 3 execution plan (complete)
- [PHASE_4.md](PHASE_4.md) — Phase 4 execution plan (complete)
- [PHASE_5.md](PHASE_5.md) — Phase 5 execution plan (complete)
- [PHASE_6.md](PHASE_6.md) — Phase 6 execution plan (rehearsal UX & timeline polish)
- [PHASE_7.md](PHASE_7.md) — Phase 7 execution plan (import hardening & DOCX)
- [PHASE_8.md](PHASE_8.md) — Phase 8 execution plan (prep readiness & catalog CSV)
- [ROLES.md](ROLES.md) — MVP role permissions
- [.agents/skills/DEVELOPMENT_GUIDE/SKILL.md](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md) — coding standards for humans and AI

---



# Vision

Theater App is a production preparation and management platform for community and educational theater organizations.

Unlike a digital script reader, Theater App treats the script as the foundation of an entire theatrical production. Every production decision—casting, blocking, props, costumes, lighting, sound, rehearsal planning, and technical preparation—is attached to the script through a structured production timeline.

The long-term goal is to create a single source of truth for every aspect of a theatrical production while remaining intuitive enough for community theater volunteers.

The application should always prioritize reliability, transparency, and structured data over automation or AI.

---



# Guiding Philosophy



## The Script Is Sacred

The imported script is never modified.

The original imported text always remains available.

All production information is layered on top of the script rather than replacing it.

---



## Progressive Enrichment

Productions become more complete over time.

Importing a script should create an editable draft rather than a finished production.

Preparation is expected to happen incrementally.

Example progression:

Import Script

↓

Review Import

↓

Verify Structure

↓

Cast Characters

↓

Add Blocking

↓

Add Props

↓

Add Technical Cues

↓

Ready for Rehearsal

---



## One Source of Truth

Every real-world object should exist exactly once.

Examples:

- Character
- User
- Song
- Prop
- Costume
- Lav Microphone
- Cue Category

Everything else references those objects.

Relationships should be derived whenever practical instead of duplicated.

---



## Timeline-Centered Design

The Timeline is the center of the application.

Everything else is simply another way of viewing the Timeline.

Examples:

Actor View

↓

Timeline filtered by Character

Lighting View

↓

Timeline filtered by Lighting Cues

Prop View

↓

Timeline filtered by Prop Events

Song View

↓

Timeline filtered by Songs

Reports are generated from Timeline data.

---



## Structured Data Over Free Text

Whenever the software needs to reason about information, store structured data rather than prose.

Dialogue remains free text.

Blocking, cues, assignments, entrances, exits, and production metadata should become structured objects whenever possible.

---



## Humans Make Decisions

Automation assists.

Humans decide.

The importer should never permanently infer production decisions.

Instead, it should generate a faithful first draft that Directors and Admins refine.

---



# Long-Term Product Vision

The application begins as a production preparation platform centered around script digitization.

Future phases may expand into a complete production management platform including:

- Rehearsal scheduling
- Attendance
- Reports
- Technical management
- Inventory
- Production archives
- Organization-wide management
- AI-assisted querying (very low priority)

---



# Initial Technology Stack

Backend

- Python
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL

Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

Infrastructure

- Docker
- uv
- Git

Authentication

Initial MVP:

- Local username/password authentication only
- Role-based permissions: Admin, Director, Actor (see [ROLES.md](ROLES.md))
- Admins create user accounts and manage passwords (including resets) for easy dev and testing

Future:

- Additional auth providers if needed
- Additional roles (Stage Manager, Lighting, Sound, etc.)

---



# Core Domain Model



## Organization

Owns:

- Productions
- Users

**MVP:** One organization per deployment. Multi-tenant org switching is out of scope.

---



## User

Represents an application user.

Belongs to:

- Organization

Relationships:

- App Roles (permissions)
- Characters
- Groups
- Notes
- Tasks
- Bookmarks

---



## App Role

Application permission level.

MVP roles: Admin, Director, Actor.

Many-to-many with Users. See [DATABASE.md](DATABASE.md) for the full role list and future additions.

---



## Production

Owns:

- Performances
- Acts
- Characters
- Groups
- Songs
- Props
- Costumes
- Microphones
- Cue Categories
- Set Pieces
- Notes
- Tasks

---



## Performance

Represents an individual performance date and time.

Fields include date, time, and status. Performance-specific annotations belong in the Notes table (not a free-text field on the performance record).

Future support:

- Understudy or cast overrides (not currently planned)

---



## Act

Contains:

- Scenes

---



## Scene

Contains:

- Moments

Derived:

- Characters
- Songs
- Props

---



## Moment

The atomic unit of the production timeline.

A Moment represents the smallest practical point where the production changes. Each Moment has a type from the `moment_types` lookup table (see [DATABASE.md](DATABASE.md) and [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md)).

Examples:

- Dialogue
- Stage Direction
- Song lyric
- Technical cue
- Blocking
- Prop movement

Everything in the production ultimately connects back to Moments.

Moments are ordered by `sequence_number` within each Scene. A display-only production sequence (e.g., `1.4.115`) may be derived later from act, scene, and moment numbers.

---



## Character

Represents a theatrical role.

Relationships:

- User(s)
- Groups
- Songs (derived)
- Scenes (derived)
- Props (derived)
- Notes

---



## Group

General-purpose grouping system.

May contain:

- Characters
- Users

Examples:

Ensemble

Poor Family

Dance Team

Crew

---



## Song

Belongs to:

- Production

Lyrics appear as Moment records on the Timeline.

Appears in:

- Scenes (derived)

---



## Prop

Belongs to:

- Production

Relationships derived from Timeline events.

---



## Costume

Belongs to:

- Production
- Character

Assigned to:

- Scene (Phase 4 MVP: one scene per costume via `scene_id`; see [PHASE_4.md](PHASE_4.md))

Future: event-driven add/remove of costume pieces on the timeline, with derived current state (like props). Deferred to post-MVP wish list.

---



## Microphone

Belongs to:

- Production

Assignments occur through Timeline events.

---



## Set Piece

Belongs to:

- Production

Participation determined by Timeline events.

---



## Cue Category

Examples:

- Lighting
- Sound
- Music
- Projection
- FX
- Pyrotechnics
- Fly Rail

Extensible.

---



## Cue

Belongs to:

- Moment

References:

- Cue Category

Structured cue data (fade times, file paths, channel levels, etc.) is stored in a JSON `payload` field. Human-readable `title` and `notes` fields are for display.

---



## Note

Attachable to nearly every object.

Visibility:

- Public
- Private

Permissions determine who may create each type.

---



## Task

Assigned work item.

May optionally reference:

- Scene
- Moment
- Prop
- Character

---



## Bookmark

Private user bookmark.

Points to:

- Moment

---



## Rehearsal (Future)

Planned for post-MVP.

---



# Event Philosophy (Future — Phase 3+)

Today (MVP), production data is stored directly on Moments and related tables — a cue is a row on `cues`, dialogue is a row on `dialogue`, and so on.

In a future event-driven model, many of these would become **events** on the Timeline (entrance, exit, prop transfer, costume change, cue execution). The app would **derive** current state from the event history rather than storing "current state" as the primary record.

Example: instead of recording "Character X is on stage at Scene 3," the system stores `Entrance(X)` and `Exit(X)` events and computes who is on stage at any Moment.

This migration is planned for Phase 3+ and is not required for MVP. The current schema is designed to remain compatible when events are introduced.

---



# Import Philosophy

The importer creates a Timeline from a Markdown (`.md`) or Word (`.docx`) script file — typically exported from Google Docs via **File → Download → Markdown** or **Microsoft Word (.docx)**.

It does not create a finished production.

**Importer approach:** Format adapters extract lines; a shared classifier reads line by line with regex pattern matching. Full fail on first unrecognized line with line number and reason. Production title is admin-owned (create-time name is not overwritten by the script title page). See [IMPORT_SPEC.md](IMPORT_SPEC.md) and [PHASE_7.md](PHASE_7.md).

Imported information should remain intact while allowing structured production data to be layered on top.

Original text should never be discarded.

---



# Production Preparation Workflow

1. Create Production
2. Upload Script
3. Verify Import Detection
  - Acts
  - Scenes
  - Characters
  - Songs
  - Other detected structures
4. Verify Acts and Scenes
5. Verify Characters
6. Verify Songs
7. Assign Actors to Characters
8. Configure Groups
9. Add Entrances and Exits
10. Add Blocking
11. Add Props
12. Add Notes

---



# Production Readiness (Post-MVP)

Preparation progress tracking is deferred until after MVP, when the full set of per-moment requirements is better understood.

**Planned approach:** A separate progress table that derives completion from the number and types of items on each Moment (or "reviewed and intentionally blank" for Moments that do not need a given item type).

Future dashboards may surface milestones such as:

- Import reviewed
- Characters verified
- Songs verified
- Casting complete
- Blocking complete
- Props complete
- Cue review complete
- Ready for rehearsal

---



# UI Philosophy

The Timeline remains visible whenever practical.

Editing other objects should occur through side panels or dialogs rather than navigating away from the Timeline.

The application should feel like users are editing one living production rather than moving between disconnected pages.

---



# Initial Navigation

Production Dashboard

- Overview

Timeline

- Script
- Moments
- Search

Preparation

- Characters
- Groups
- Songs
- Props
- Costumes
- Microphones
- Cue Categories

Reports (future)

Settings

---



# Development Strategy

Build complete vertical slices.

Avoid building entire subsystems before they are usable.

Preferred approach:

Slice 1

- Create Production
- Upload Script
- Import Timeline
- Timeline Viewer

Slice 2

- Character detection
- Casting
- Actor highlighting
- Character search

Slice 3

- Songs
- Song editing
- Song navigation

Continue adding complete workflows.

---



# Project Phases



## Phase 0 — Foundation & Standards

See [PHASE_0.md](PHASE_0.md) for phase-specific details

Goals:

- Define project architecture
- Finalize domain model
- Finalize terminology
- Design PostgreSQL schema
- Design UI navigation
- Create coding standards
- Create AI development standards
- Define standard script format
- Convert an existing production script into the standard format
- Produce importer specification

Deliverables:

- PROJECT.md (this document)
- [DATABASE.md](DATABASE.md)
- [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md)
- [IMPORT_SPEC.md](IMPORT_SPEC.md)
- [ERD.md](ERD.md)
- [UI_STANDARDS.md](UI_STANDARDS.md)
- [ROLES.md](ROLES.md)
- [SEED_DATA.md](SEED_DATA.md)
- Development standards ([DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md))

---



## Phase 1 — Script Import MVP

See [PHASE_1.md](PHASE_1.md) for the execution plan.

Summary:

- Create Productions (Admin only)
- Upload `.md` / `.docx` scripts (Google Docs Markdown or Word export; Admin only)
- Parse standard script format (line-by-line regex classification)
- Detect:
  - Acts
  - Scenes
  - Characters
  - Songs
  - Stage directions
- Build Timeline
- Timeline review UI (read-only in Phase 1)
- Admin user management (create accounts, reset passwords)

---



## Phase 2 — Character Workflow

See [PHASE_2.md](PHASE_2.md) for the execution plan.

Summary:

- Casting (one actor per character)
- Groups (late Phase 2 — API shipped; UI partial)
- Actor-filtered timeline view and line highlighting (includes stage directions referencing filtered characters)
- Timeline search
- Cue-only rehearsal mode
- Notes and bookmarks
- Production list filtering by casting (Actors see only cast productions)
- Manual add character (Director+)

Import review (marking characters/songs as "verified") is **deferred** — directors will comb through imported timeline data directly once editing ships.

---



## Phase 3 — Production Preparation

See [PHASE_3.md](PHASE_3.md) for the execution plan.

Summary:

- Timeline import-review editing (Director/Admin; `original_text` immutable)
- Songs page and timeline song filter
- Props catalog and moment attachments
- Cue categories and technical cues on moments
- Extended timeline filters (prop, cue category; upgraded cue-only mode)

---



## Phase 4 — Timeline Polish, Structural Editing & Prep Objects

See [PHASE_4.md](PHASE_4.md) for the execution plan.

Summary:

- Timeline editing UX completion (auto-save, unified detail panel, global App Settings)
- Structural timeline editing (add, delete, reorder — split/merge deferred)
- Costumes (scene-level), microphones, and set pieces — after structural editing is stable
- Minimal reports (prop sheet, cue sheet, one simple third view) by phase exit
- Admin navigation restructure (production prep vs administration)

---



## Phase 5 — MVP Completion & Demo Readiness

See [PHASE_5.md](PHASE_5.md) for the execution plan.

Summary:

- Entrances, exits, and blocking (moment-attached; on-stage derivation within scenes)
- Minimal production overview page (counts and navigation — not a progress dashboard)
- Extended minimal reports (entrance/exit sheet, blocking sheet)
- Demo package (multi-scene script validation, staff/director walkthrough doc)

**Explicitly deferred past MVP:** rehearsals, attendance, tasks, performances, re-import, production status, event engine, UX polish (live search, multi-select filters, bookmarks redesign).

---



## Phase 6 — Rehearsal UX & Timeline Polish

See [PHASE_6.md](PHASE_6.md) for the execution plan.

Summary:

- **Rehearse** page for all roles — client-side practice presets (Scene run-through, My lines, Line cues); no new API endpoints
- Cue-only checkbox removed from Timeline; rehearsal display modes live only on Rehearse
- Moment detail panel refinement (add-menu pattern, hide irrelevant fields, remove on-stage once scene strip ships)
- Timeline click-target and filter-bar polish
- Scene summary strip (read-only chips, client-side derived)
- Phase 5 P2 carryover: on-stage row badges, blocking-by-character filter
- P2: blur own lines until click/hover reveal

**Explicitly out of Phase 6:** demo walkthrough, importer changes, deployment hardening, bookmarks redesign, event engine, new Rehearse backend APIs.

---



## Phase 7 — Import Hardening & Multi-Format Foundation

See [PHASE_7.md](PHASE_7.md) for the execution plan.

Summary:

- Admin-chosen production title survives import (script title page does not rename)
- Format adapters for `.md` and `.docx` → shared preprocess → shared classifier
- Preprocessing: mojibake (including smart quotes), Markdown unescape, clear UTF-8 errors
- Plain SCRIPT_FORMAT aliases (`Title:`, `Author:`, `Act 1`, `Scene 1 - …`) and plain `### SONG TITLE` (no hyperlink required)
- Overview “needs script” based on acts only (not author)

**Explicitly out of Phase 7:** re-import, admin field-mapping UI, warn-and-continue, ODT/RTF/PDF/Drive API.

---



## Phase 8 — Prep Readiness Dashboard & Catalog CSV Import (Implemented; Full-Show Validation Pending)

See [PHASE_8.md](PHASE_8.md) for the execution plan.

Summary:

- Implemented 2026-07-16; full-show / multi-scene manual validation remains pending until the owner fixture is available
- Richer production Overview: heuristic prep readiness %, dimension breakdown, gap CTAs
- Costume readiness = speaking characters in a scene who have a costume for that scene
- Editable Overview messages (encouragement/quotes, scripture, announcements) with configurable rotation — production-level primary, global defaults secondary. Simplified 2026-07-17: encouragement rotates as a flat list (readiness bands no longer filter the spotlight)
- Lightweight Actor Overview (messages, roles, Rehearse, placeholders)
- CSV import for props, microphones, set pieces, costumes, songs, and cue categories (skip duplicates; v1 bridge to STP digital catalogs)
- Microphone catalog gains optional `notes`
- Implementation references: [PREP_READINESS.md](PREP_READINESS.md) and [CATALOG_CSV.md](CATALOG_CSV.md)

**Explicitly out of Phase 8:** event engine, org-wide inventory, CSV upsert modes, explicit “reviewed / intentionally blank” progress table, deployment hardening.

---



# Pre-Coding Tasks

Before writing application code, complete the following foundational work.

## Domain Standards

- Finalize all domain terminology.
- Identify derived versus stored relationships.
- Define naming conventions.

---



## Script Standards

See [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md). Remaining work:

- Convert an additional production script into the standard format (validation)
- Write the formal import specification (line-classification rules)

---



## Import Specification

Document exactly how each script construct maps into database entities. Use [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) as the source of truth for script rules.

Target entities:

- Act
- Scene
- Moment (with `moment_type_id` → `moment_types`)
- Character
- Song

Importer strategy: read the Markdown file line by line, classify each line with regex, build records incrementally. No implementation yet — specification only.

---



## Database Design

See [DATABASE.md](DATABASE.md). Remaining work:

- Entity Relationship Diagram (ERD)
- Alembic migration baseline
- Index verification against production query patterns

---



## UI Standards

Define:

- Navigation
- Component conventions
- Layout philosophy
- Timeline behavior
- Panel behavior

---



## AI Development Standards

See [.agents/skills/DEVELOPMENT_GUIDE/SKILL.md](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md). Future AI sessions should treat that document as authoritative for implementation.

---

---



## Wish List (post-MVP ideas)

These are not committed scope — captured here so good ideas are not lost:

- **Saved views** — save a timeline filter/search combination (character selection, search terms, Rehearse preset) as a named view for quick recall. May evolve into role-specific modes (rehearsal mode, tech night mode).
- **Scene summary drill-down** — clickable chips on the scene summary strip open a modal with per-character detail: entrance moment, exit moment, costume, props carried, set pieces, blocking notes. Derived from timeline data (see [SCRATCH_NOTES.md](SCRATCH_NOTES.md)). Phase 6 ships read-only chips only.
- **Rehearse line blur** — in Rehearse mode, actor's own lines stay in the list but text is blurred until click or hover reveal, so they can practice against visible context lines without seeing their line prematurely. Phase 6 P2; presets alone are sufficient for P0.
- **Production home page** — a dedicated landing page per production instead of opening straight into the timeline hub.
- **Bookmarks timeline view** — a dedicated timeline-like view for bookmarks with gaps (`…`) between non-adjacent moments; click through to the main timeline. Owner undecided on interaction design — leave as-is until settled.
- **Live search** — filter timeline results as you type (no Enter required).
- **Multi-select character filter** — show moments for any of several selected characters at once.
- **Character colors** — assign colors to characters for auto-highlighting (Actors and other roles).
- **Split / merge moments** — divide one moment into two or combine adjacent moments during structural editing.
- **Costume event-driven model** — track costume piece add/remove events on the timeline and derive current costume state (replacing scene-level assignment over time).
- **Rich reports** — PDF export, print layouts, cross-production analytics, preparation progress dashboards.
- **Production-level settings** — per-production overrides for display and workflow flags (if global App Settings prove insufficient).
- **Real-time note-flagging** -- A tool/ability for directors (or other roles too) to quickly flag or add a note to a moment without fulling disengaging from watching the scene play out. Possibly voice-transcribed, so the person could mumble into their phone while watching the rest of the scene. 
- **Mobile Interface** -- Some interface ability that's mobile-optimized, probably to support the director in quickly making notes in a mostly-finished show. The idea being that they could sit in the audience with their phone, click through moments of the show passively, and then bring their phone up to talk into it, dictating a brief note that's attached to that moment without disrupting the scene or taking their eyes off the action. 

See also [SCRATCH_NOTES.md](SCRATCH_NOTES.md) for transient owner notes.

---



# Success Criteria (MVP)

A successful MVP should allow a Director or Admin to:

- Create a Production.
- Import a script in the Theater App standard format (`.md`).
- Review and edit the imported Timeline (including structural fixes: add, delete, reorder moments).
- Assign actors to characters.
- Organize groups.
- Search the script.
- View actor-specific highlighted dialogue.
- Use Rehearse practice modes (Scene run-through, My lines, Line cues).
- Add notes and bookmarks.
- Manage songs, props, cues, costumes, microphones, and set pieces.
- Generate basic prop and cue sheet reports from timeline data.
- Configure global display settings (e.g. hide import-review fields after verification).
- Create and manage user accounts (Admin).
- Record structured entrances, exits, and blocking on moments (Phase 5).
- View a minimal production overview with key counts (Phase 5).
- Generate entrance/exit and blocking reports (Phase 5).

At this point, the application should provide meaningful value during rehearsal and technical preparation while establishing the architectural foundation for future production management features. Phase 5 adds the remaining prep workflow pieces and packages the app for a staff/director demo.