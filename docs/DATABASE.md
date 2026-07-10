# Theater App — Database Design

**Version:** 0.1 (Draft)

Companion to [PROJECT.md](PROJECT.md). Script import rules: [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) (authoring), [IMPORT_SPEC.md](IMPORT_SPEC.md) (implementation). Roles: [ROLES.md](ROLES.md). Seeds: [SEED_DATA.md](SEED_DATA.md).

---

# Design Philosophy

The database should model the real-world structure of a theatrical production rather than the application's user interface.

The imported script is the canonical source of production structure.

All production metadata is layered onto the imported script without modifying the original imported text.

The schema should favor normalization, extensibility, and derived relationships over duplicated data.

---

# Database Engine

PostgreSQL

ORM:

* SQLAlchemy

Migration Tool:

* Alembic

---

# Naming Conventions

Primary Keys

```text
id
```

Foreign Keys

```text
production_id
scene_id
character_id
```

Timestamps

```text
created_at
updated_at
```

Soft Delete (future)

```text
deleted_at
```

---

# Core Hierarchy

```text
Organization

└── Production

    ├── Performance

    ├── Act

    │     └── Scene

    │            └── Moment

    ├── Character

    ├── Group

    ├── Song

    ├── Prop

    ├── Costume

    ├── Microphone

    ├── CueCategory

    ├── SetPiece

    ├── Task

    └── Note

MomentType (lookup — referenced by Moment.moment_type_id)
```

---

# ORGANIZATIONS

Purpose

Owns users and productions.

**Decision (MVP):** One organization per deployment. Multi-tenant org switching is out of scope until explicitly needed.

Fields

* id
* name
* created_at
* updated_at

Relationships

1 → Many Users

1 → Many Productions

---

# USERS

Purpose

Application users. Admins create accounts and manage credentials (including password resets) for dev, testing, and production use.

Fields

* id
* organization_id
* username
* password_hash
* first_name
* last_name
* email (optional)
* is_active
* created_at
* updated_at

Relationships

Many → One Organization

Many ↔ Many Characters

Many ↔ Many Groups

One → Many Notes

One → Many Tasks

One → Many Bookmarks

---

# APP_ROLES

Purpose

Application permissions.

MVP roles (seed data):

* Admin
* Director
* Actor

Future roles (not seeded for MVP):

* Production Manager
* Stage Manager
* Lighting
* Sound

Fields

* id
* name
* description

Relationship

Many ↔ Many Users

**Decision:** Store fine-grained permissions separately in a future release.

---

# PRODUCTIONS

Purpose

Represents a theatrical production.

Fields

* id
* organization_id
* title
* season
* created_at
* updated_at

Relationships

One → Many Performances

One → Many Acts

One → Many Characters

One → Many Songs

One → Many Props

One → Many Costumes

One → Many Microphones

One → Many CueCategories

One → Many SetPieces

One → Many Notes

One → Many Tasks

---

# PERFORMANCES

Purpose

Represents an individual performance.

Fields

* id
* production_id
* performance_date
* performance_time
* status
* notes (legacy/import only — use Notes table for annotations)

Relationships

Many → One Production

**Decision:** Performance-specific annotations use the Notes table. The `notes` text field on this table is reserved for import/bootstrap only and should not be used for new features.

---

# ACTS

Purpose

Structural division of a production (e.g., Act I, Act II).

Fields

* id
* production_id
* number
* title
* sort_order

Relationships

One → Many Scenes

---

# SCENES

Purpose

A continuous unit of action within an Act.

Fields

* id
* act_id
* number
* title
* sort_order

Relationships

One → Many Moments

Derived

Characters

Songs

Props

---

# MOMENT_TYPES

Purpose

Lookup table for Moment classification. Extensible without schema migrations.

MVP seed types (keep this list minimal):

* `stage_direction`
* `dialogue`
* `song_header`
* `song_attribution`
* `lyric`
* `author_note`

See [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) for how each maps from the script file.

Fields

* id
* name (unique)
* description

---

# MOMENTS

Purpose

The central table of the application.

A Moment represents one practical point in the production timeline.

Fields

* id
* scene_id
* moment_type_id
* sequence_number
* original_text
* parsed_text (optional)
* created_at
* updated_at

Relationships

Many → One MomentType

One → Many Dialogue

One → Many StageDirections

One → Many Cues

One → Many Notes

One → Many Tasks

Future

One → Many Events

**Decision:** `sequence_number` restarts within each Scene (not globally across the Production).

**Future:** Derive a display-only production sequence (e.g., `1.4.115` = Act 1, Scene 4, Moment 115) from act number, scene number, and `sequence_number`. Do not store this as a primary ordering key in MVP.

---

# DIALOGUE

Purpose

Structured dialogue.

Fields

* id
* moment_id
* character_id
* dialogue_text

Relationships

Many → One Moment

Many → One Character

---

# STAGE_DIRECTIONS

Purpose

Original stage direction text.

Fields

* id
* moment_id
* direction_text

Relationships

Many → One Moment

Future

May become partially structured.

---

# CHARACTERS

Fields

* id
* production_id
* name
* description
* created_at

Relationships

Many ↔ Many Users (via `user_character_assignments`)

Many ↔ Many Groups

Derived

Scenes

Songs

Props

---

# USER_CHARACTER_ASSIGNMENTS

Purpose

Casting.

Fields

* id
* user_id
* character_id

Allows

Multiple characters per actor.

**Decision (Phase 2 MVP):** One actor per character — enforce `UNIQUE(character_id)`. Understudies deferred; Groups may provide ensemble casting later. See [PHASE_2.md](PHASE_2.md).

Relationships

Many ↔ Many Users (via this table; MVP: at most one user per character)

---

# GROUPS

Purpose

General grouping.

Examples

* Ensemble

* Crew

* Party Guests

Fields

* id
* production_id
* name
* description

Relationships

Many ↔ Many Characters

Many ↔ Many Users

---

# SONGS

Fields

* id
* production_id
* title
* composer
* lyricist
* description

Derived

Scenes

Moments

Characters

**Decision:** Song lyrics are Moment records handled the same way as dialogue — typically one lyric line per Moment. Revisit post-MVP if song blocks need different treatment.

---

# PROPS

Fields

* id
* production_id
* name
* description
* notes

Derived

Current carrier

Scenes

Characters

---

# MOMENT_PROPS

Purpose

Attach props to moments (Phase 3 junction table).

Fields

* id
* moment_id
* prop_id
* character_id (nullable — carrier)
* notes (nullable)

**Decision:** Unique `(moment_id, prop_id)` — one attachment row per prop per moment. See [PHASE_3.md](PHASE_3.md).

---

# COSTUMES

Fields

* id
* production_id
* character_id
* scene_id
* name
* description

**Decision:** MVP uses a single `scene_id` per costume. Post-MVP, support multiple scenes through a join table.

---

# MICROPHONES

Fields

* id
* production_id
* identifier

Examples

Lav 1

Lav 2

Lav 7

Assignments occur through Moments.

---

# SET_PIECES

Fields

* id
* production_id
* name
* mobile
* description

---

# CUE_CATEGORIES

Fields

* id
* production_id
* name
* description

Examples

Lighting

Sound

Music

Projection

FX

Pyrotechnics

Fly Rail

---

# CUES

Purpose

Technical cues attached to a Moment (lighting, sound, projection, etc.).

Fields

* id
* moment_id
* cue_category_id
* title
* payload (JSON)
* notes

The human-readable `title` and `notes` fields are for display. The `payload` field holds structured cue data the app can act on — for example, a lighting fade duration, a sound file path, or channel levels. Store `payload` as JSON from day one.

---

# NOTES

Purpose

Universal annotation system.

Fields

* id
* user_id
* visibility

Reference Fields (nullable)

* production_id
* performance_id
* act_id
* scene_id
* moment_id
* character_id
* song_id
* prop_id
* costume_id
* microphone_id
* cue_id
* task_id
* content
* created_at

**Decision (MVP):** Use nullable foreign keys (not a polymorphic association). Revisit after MVP if the reference list becomes unwieldy.

---

# TASKS

Fields

* id
* production_id
* assigned_user_id
* title
* description
* due_date
* completed

Optional references

* scene_id
* moment_id
* character_id
* prop_id

---

# BOOKMARKS

Fields

* id
* user_id
* moment_id
* label

Private to each user.

---

# FUTURE TABLES

Preparation progress (derived checklist per moment/production)

Rehearsals

Attendance

Timeline Events

Prop Assignments

Blocking

Entrances

Exits

Microphone Assignments

State Changes

AI Conversations

Audit Logs

Version History

---

# Derived Relationships

These should generally NOT be stored directly.

Character → Scene

Character → Song

Character → Prop

Song → Scene

Prop → Scene

User → Scene

Microphone → Scene

These should be computed from Timeline relationships whenever possible.

---

# Planned Event Model (Future)

Eventually Moments should own structured production events.

Possible event types:

Dialogue

Stage Direction

Entrance

Exit

Blocking

Cue

Music Start

Music Stop

Prop Assignment

Prop Transfer

Costume Change

Microphone Assignment

Set Change

This event system should eventually replace many specialized relationships while remaining backwards-compatible with the MVP schema.

---

# Indexing Strategy

Initial indexes:

* production_id
* act_id
* scene_id
* moment_id
* character_id
* user_id

Future

Full-text search

Dialogue search

Trigram indexes

JSON payload indexes

---

# Remaining Architecture Decisions

Most foundational decisions are captured above. Remaining work:

## Near Term

* Write the formal import specification (line-classification rules derived from [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md)).
* Produce an ERD and Alembic migration baseline.
* Design the post-MVP costume-to-scene join table.
* Design the post-MVP preparation-progress table (derive completion from moment content and review state).

## Low Priority

* Full event-sourcing architecture.
* Version history and undo/redo.
* Offline synchronization.
* Organization-wide resource sharing (reusable props, costumes, etc.).
* Multi-venue support.
* AI-assisted production analysis.
