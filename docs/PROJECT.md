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

- Scene (MVP: one scene per costume; multiple scenes post-MVP)

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

The importer creates a Timeline from a Markdown (`.md`) script file — typically exported from Google Docs via **File → Download → Markdown**.

It does not create a finished production.

**Importer approach (MVP):** Read the file line by line. Classify each line with regex pattern matching. Full fail on first unrecognized line with line number and reason. See [IMPORT_SPEC.md](IMPORT_SPEC.md) for Google Docs export patterns.

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
- Upload `.md` scripts (Google Docs Markdown export; Admin only)
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

- Character and song verification (soft checklist, P1)
- Casting (one actor per character)
- Groups (late Phase 2)
- Actor-filtered timeline view and line highlighting
- Timeline search
- Cue-only rehearsal mode
- Notes and bookmarks
- Production list filtering by casting (Actors see only cast productions)

---



## Phase 3 — Production Preparation

- Blocking
- Entrances
- Exits
- Props
- Costumes
- Microphones
- Cue Categories
- Cue management

---



## Phase 4 — Reports & Management

- Production reports
- Prop sheets
- Cue sheets
- Character reports
- Scene reports
- Search improvements

---



## Phase 5 — Advanced Features

- Rehearsals
- Attendance
- Production archives
- Multi-production improvements
- Event-derived state engine
- Optional AI assistance

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



# Success Criteria (MVP)

A successful MVP should allow a Director or Admin to:

- Create a Production.
- Import a script in the Theater App standard format (`.md`).
- Review and edit the imported Timeline.
- Verify production structure.
- Assign actors to characters.
- Organize groups.
- Search the script.
- View actor-specific highlighted dialogue.
- Use cue-only rehearsal mode.
- Add notes and bookmarks.
- Create and manage user accounts (Admin).

At this point, the application should already provide meaningful value during rehearsal preparation while establishing the architectural foundation for future production management features.