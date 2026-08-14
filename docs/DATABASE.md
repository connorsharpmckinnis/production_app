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

    ├── Wire

    ├── Pack

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
* author (nullable — set from script import when present)
* message_rotation_seconds (nullable — Overview spotlight interval; `null` inherits `app_settings.default_message_rotation_seconds`; `0` = rotation off; otherwise 5–300)
* created_at
* updated_at

Relationships

One → Many Performances

One → Many Acts

One → Many Characters

One → Many Songs

One → Many Props

One → Many Costumes

One → Many Wires

One → Many Packs

One → Many CueCategories

One → Many SetPieces

One → Many ProductionOverviewMessages

One → Many Notes

One → Many Tasks

---

# APP_SETTINGS

Purpose

Singleton application settings row (`id = 1`). Display flags and global Overview message defaults that productions may override.

Fields

* id (always `1`)
* show_original_text
* show_parsed_text
* default_message_rotation_seconds (integer; `0` = rotation off; otherwise 5–300; default `20`)

---

# APP_OVERVIEW_MESSAGE_DEFAULTS

Purpose

Global default Overview rotating messages (quotes/encouragement). Legacy `band` column may still be present on rows but is not used for spotlight filtering.

Fields

* id
* band (`0`, `1-24`, `25-49`, `50-74`, `75-89`, `90-99`, `100`)
* title (nullable)
* body
* sort_order
* active
* created_at
* updated_at

**Decision (Phase 8, revised 2026-07-17):** Global defaults are encouragement/quotes only; scripture and announcements are production-scoped. The `band` column is retained for compatibility but the spotlight no longer filters by it — defaults display as a flat rotating list, and Settings saves edited rows with `band: "0"`.

Seeded default copy (migration + startup seed when empty; historically one row per band):

| Band | Default body |
| ---- | ------------ |
| `0` | Blank stage — import a script and let's get rolling. |
| `1-24` | Good start — the bones are there. |
| `25-49` | You're building something real. Keep layering prep. |
| `50-74` | Solid progress — the show is taking shape. |
| `75-89` | You got it — almost at the finish line! |
| `90-99` | So close — knock out the last gaps. |
| `100` | Prep looks complete. Time to rehearse. |

---

# PRODUCTION_OVERVIEW_MESSAGES

Purpose

Production-scoped Overview spotlight messages (encouragement, scripture, announcement).

Fields

* id
* production_id
* kind (`encouragement` \| `scripture` \| `announcement`)
* band (nullable — legacy; optional for `encouragement`, **must be null** for other kinds; no longer used for spotlight filtering)
* title (nullable — e.g. scripture citation)
* body
* sort_order
* active
* created_at
* updated_at

Relationships

Many → One Production

**Spotlight resolve order (Overview API):** active production announcements (by `sort_order`), then active production scripture, then active production encouragement/quotes if any exist, otherwise all active global default messages. Rotation interval comes from the production override or the global default. Empty production / readiness `0` / no script still reports readiness band `0` on the Overview payload for display, but that band no longer filters messages.

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

**Decision:** Unique `(production_id, number)` — one Act N per production (supports human Timeline links `?act=&scene=`).

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

**Decision:** Unique `(act_id, number)` — one Scene N per Act.

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
* song_id (optional — set for `song_header`, `song_attribution`, and `lyric` Moments)
* sequence_number
* original_text
* parsed_text (optional)
* created_at
* updated_at

Relationships

Many → One MomentType

Many → One Song (optional)

One → Many Dialogue

One → Many LyricLine

One → Many SongAttributionCharacter

One → Many StageDirections

One → Many Cues

One → Many Notes

One → Many Tasks

Future

One → Many Events

**Decision:** `sequence_number` restarts within each Scene (not globally across the Production). Unique `(scene_id, sequence_number)`.

**Human Timeline deep links (soft):** resolve by show position — `/productions/:id/timeline?act=1&scene=2&moment=115` uses Act/Scene `number` and per-scene `sequence_number`. Omitting `moment` opens the first moment of that scene. These links can drift after insert/delete/reorder. Legacy PK links `?scene=<sceneId>&moment=<momentId>` remain supported for older shares. Prefer human URLs for new CTAs (announcements, bookmarks, reports). Timeline clears the query string only after the target moment is resolved (or after a failed resolve once the scene is ready). Display form `1.4.115` is derived the same way; do not store it as a primary ordering key.

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

# LYRIC_LINES

Purpose

Structured sung text — the song counterpart to Dialogue.

Each lyric Moment has one row per active performer (from the latest
`song_attribution` in that song block).

Fields

* id
* moment_id
* character_id
* lyric_text

Relationships

Many → One Moment

Many → One Character

---

# SONG_ATTRIBUTION_CHARACTERS

Purpose

Characters named on a `song_attribution` Moment (for example `VERA & MOM` or
`SHACKLETON (WILD)`).

Fields

* id
* moment_id
* character_id

Relationships

Many → One Moment

Many → One Character

**Decision:** Parenthetical splits link all named Characters to following lyrics
for filtering; segment-accurate ownership inside a single lyric line is future work.

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

**Decision:** Song lyrics are Moment records with `lyric_lines` Character links,
mirroring dialogue→`dialogue` rows. Performer context comes from the latest
`song_attribution` in the song block. Revisit post-MVP if song blocks need
different treatment (for example segment-accurate parenthetical ownership).

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

# MOMENT_PROP_EVENTS

Purpose

Prop **on/off** events on moments (Phase 14 WP2) — replaces the Phase 3 `moment_props` presence junction.

Fields

* id
* moment_id
* prop_id
* kind (`on` \| `off`)
* character_id (nullable — person affiliation)
* user_id (nullable — person affiliation)
* notes (nullable — free text: location when `on`, exit/stow detail when `off`)

**Decision (Phase 14):** Exactly one of `character_id` / `user_id` may be set — `CHECK (character_id IS NULL OR user_id IS NULL)` — or neither. Unique `(moment_id, prop_id)`: at most one event per prop per Moment (a Moment can still change many different props).

**Derivation (not stored):** Walk Moments in Act → Scene → `sequence_number` order, whole production. Each asset starts **off**. An `on` event puts it in play and sets current person/notes from that event; state (in-play, person, notes) **persists across scenes and acts** until the next event for that asset — no scene/act reset. A repeat `on` while already on **updates** person/notes in place (covers move/handoff without a new event kind). An `off` event takes it out of play and clears current person. Derived in-play API rows also expose the **source** Moment (last event that set current state) and optional **next-change** Moment (first later event for that asset) as human `act.scene.sequence` triples for Timeline deep links — still derived, not stored. OFF event rows on Moment detail additionally expose optional **prior-on** triples (last ON before this OFF) so the END moment can link back to START. See [PHASE_14.md](PHASE_14.md) and [in-play-moment-deep-links.md](feature_plans/in-play-moment-deep-links.md).

**Deprecated:** `moment_props` (Phase 3 presence junction) — dropped; no data migration, owner re-enters.

---

# MOMENT_SET_PIECE_EVENTS

Purpose

Set piece **on/off** events on moments (Phase 14 WP2) — replaces the Phase 4 `moment_set_pieces` presence junction.

Fields

* id
* moment_id
* set_piece_id
* kind (`on` \| `off`)
* character_id (nullable — person affiliation)
* user_id (nullable — person affiliation)
* notes (nullable)

**Decision (Phase 14):** Same rules as `moment_prop_events` — `character_id` XOR `user_id` (or neither) via `CHECK (character_id IS NULL OR user_id IS NULL)`; unique `(moment_id, set_piece_id)`; same show-order derivation walk (persist across scenes/acts, re-`on` updates person/notes, `off` clears in-play). See [PHASE_14.md](PHASE_14.md).

**Deprecated:** `moment_set_pieces` (Phase 4 presence junction) — dropped; no data migration, owner re-enters.

---

# MOMENT_ENTRANCES

Purpose

Record structured character entrances on moments (Phase 5).

Fields

* id
* moment_id
* character_id
* notes (nullable)

**Decision:** Unique `(moment_id, character_id)` — one entrance row per character per moment.

---

# MOMENT_EXITS

Purpose

Record structured character exits on moments (Phase 5).

Fields

* id
* moment_id
* character_id
* notes (nullable)

**Decision:** Unique `(moment_id, character_id)` — one exit row per character per moment.

---

# MOMENT_BLOCKING

Purpose

Attach blocking notes to moments for specific characters (Phase 5).

Fields

* id
* moment_id
* character_id
* notes (required)

**Decision:** Unique `(moment_id, character_id)` — one blocking row per character per moment. On-stage presence within a scene is derived from entrance/exit sequence, not stored.

---

# COSTUMES

Purpose

Costume/look catalog, scoped to a production and a default owning character. Timing (when a look is worn) lives on the Timeline via `moment_costume_events`, not on this table.

Fields

* id
* production_id
* character_id — catalog default owner
* name
* description

**Decision (Phase 14 WP5):** `scene_id` dropped — costumes are no longer assigned to a single scene. `character_id` stays as the catalog's default owner (who this look is normally for), but any production costume can be worn by any character via `moment_costume_events.costume_id` (catalog owner is a hint, not an enforced match). No data migration: existing scene assignments are gone; the owner re-enters wear/clear timing on the Timeline.

---

# MOMENT_COSTUME_EVENTS

Purpose

Costume **wear/clear** events on moments (Phase 14 WP5) — thin sibling of `moment_prop_events` / `moment_set_piece_events`, replacing the dropped `costumes.scene_id` assignment.

Fields

* id
* moment_id
* character_id (required — the wearer; no user option, unlike prop/set piece events)
* kind (`on` \| `off` — UI labels these Wear/Clear)
* costume_id (nullable — required when `kind = on`; `CHECK (kind = 'off') OR (costume_id IS NOT NULL)`)
* notes (nullable)

**Decision (Phase 14 WP5):** Unlike prop/set piece events, the wearer is always a `character_id` (no `user_id` option), and unique `(moment_id, character_id)` — a character can only make one costume change per Moment (as opposed to `(moment_id, prop_id)` for props, where one Moment can change many different props). `CHECK (kind IN ('on', 'off'))`.

**Derivation (not stored):** Same show-order walk as `asset_state.py` (Act → Scene → `sequence_number`, whole production), keyed by `character_id` instead of asset id. Each character starts with nothing on. An `on` event sets that character's current costume + notes; state **persists across scenes and acts** until the next event for that character. A repeat `on` updates the costume/notes in place (handles an outfit change without a new event kind). An `off` event clears what they're wearing. Derived wearing API rows also expose the **source** Moment (last Wear / re-Wear) and optional **next-change** Moment (first later Wear or Clear for that character) as human `act.scene.sequence` triples for Timeline deep links — still derived, not stored. OFF/Clear event rows on Moment detail additionally expose optional **prior-on** triples (last Wear before this Clear). See `compute_costume_state_by_moment` / `costume_states_at_moment` in `app/services/asset_state.py` and [in-play-moment-deep-links.md](shipped_features/in-play-moment-deep-links.md).

**Deprecated:** `costumes.scene_id` (dropped, see COSTUMES above) — no data migration, owner re-enters.

---

# WIRES

Purpose

Production-scoped lav **wire** inventory for the lav chart (face/body mic element). Timeline moment attachments for mics were retired in Phase 13; planning lives on the lav chart. Future Timeline **change** Moments will be derived from this chart (see [PHASE_13.md](PHASE_13.md)).

Fields

* id
* production_id
* identifier
* notes (nullable)

---

# PACKS

Purpose

Production-scoped lav **pack** (transceiver) inventory for the lav chart.

Fields

* id
* production_id
* identifier
* notes (nullable)

---

# LAV_WIRE_ASSIGNMENTS

Purpose

Per-scene wire wear on the lav chart. Wearer is either a cast **user** (actor row) or an uncast **character**.

Fields

* id
* production_id
* scene_id
* user_id (nullable — set for actor rows)
* character_id (nullable — set for uncast character rows)
* wire_id (nullable — SET NULL on wire delete)

**Decision:** Exactly one of `user_id` / `character_id` is set. Unique per `(production_id, scene_id, user_id)` and `(production_id, scene_id, character_id)`. Editable source of truth for lav wear; Timeline display of changes is a Phase 13 follow-on.

---

# LAV_PACK_ASSIGNMENTS

Purpose

Per-scene pack wear on the lav chart (same wearer rules as wire assignments).

Fields

* id
* production_id
* scene_id
* user_id (nullable)
* character_id (nullable)
* pack_id (nullable — SET NULL on pack delete)

**Decision:** Same wearer check and uniqueness pattern as `lav_wire_assignments`.

---

# LAV_ROW_LOCKS

Purpose

Per-row locks on the lav chart so directors can freeze a wearer row against accidental cell edits (actor or uncast character rows). Propose still fully overwrites the active sheet, including locked rows.

Fields

* id
* production_id (CASCADE delete with production)
* row_key (e.g. `user:1`, `character:5`)

**Decision:** Unique per `(production_id, row_key)`. Replaced wholesale on chart save when `locked_row_keys` is sent; omitted on save leaves locks unchanged.

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

# ANNOUNCEMENTS

Authored one-way broadcasts (org-wide or production-scoped). Separate from Overview spotlight messages. See [feature_plans/app-announcements.md](feature_plans/app-announcements.md).

Fields

* id
* title
* body
* severity (`info` | `success` | `warning` | `urgent`)
* show_as_banner
* show_as_modal (Admin-authored only in product rules)
* production_id (nullable — null = org-wide)
* route_filter (optional path key for banner placement, e.g. `rehearse`)
* starts_at / ends_at (optional visibility window)
* active
* priority
* created_by_user_id
* created_at
* updated_at

Related

* `announcement_ctas` — label, kind (`internal` | `external`), target, style, sort_order
* `announcement_audience_roles` — role_name (`Admin` | `Director` | `Actor`)

---

# NOTIFICATIONS

Per-user multi-kind inbox rows (bell). Announcements fan out into this table; system events (e.g. new production) write directly. Future `mention` / `task_assigned` kinds reuse the same feed.

Fields

* id
* user_id
* kind (`announcement` | `system` | `mention` | `task_assigned`)
* title
* body
* production_id (nullable)
* announcement_id (nullable)
* actor_user_id (nullable — who caused the event)
* resource_type / resource_id (optional deep-link targets)
* deep_link
* severity
* read_at / dismissed_at
* created_at

UI shows unread + recent (~100); rows are retained indefinitely.

---

# FUTURE TABLES

Preparation progress (derived checklist per moment/production)

Rehearsals

Attendance

AI Conversations

Audit Logs

Version History

**Note:** Blocking, Entrances, Exits, and lav chart assignments (wires/packs) are no longer future work — see `MOMENT_BLOCKING`, `MOMENT_ENTRANCES`, `MOMENT_EXITS`, `LAV_WIRE_ASSIGNMENTS`, and `LAV_PACK_ASSIGNMENTS` above. Prop/set-piece/costume "state changes" shipped as `moment_prop_events`, `moment_set_piece_events`, and `moment_costume_events` (Phase 14) — see Planned Event Model below for what's still unscheduled.

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

# Planned Event Model

**Phase 14 (WP1–WP5 backend shipped 2026-07-27):** Props, set pieces, and costumes now ship as first-class **on/off** events (`moment_prop_events`, `moment_set_piece_events`, `moment_costume_events` — see above), with "currently in play" / "currently wearing" **derived** by walking the show in order rather than stored as presence rows (`app/services/asset_state.py`). This is a deliberately **scoped** slice — specialized event tables plus a shared derivation service — not the polymorphic event store sketched below. See [PHASE_14.md](PHASE_14.md).

**Broader future (unscheduled):** Other Moment-attached data could eventually follow the same on/off-and-derive pattern — entrance, exit, cue execution, microphone assignment, set change, and so on. Lav wire/pack Timeline markers are one documented candidate, deferred until the props/sets engine proves out (see [PHASE_13.md](PHASE_13.md)). There is no committed plan to convert every relationship into a single unified event store; each domain is evaluated on its own rather than as a big-bang event-sourcing rewrite.

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
* Design the post-MVP preparation-progress table (derive completion from moment content and review state).

## Low Priority

* Full event-sourcing architecture.
* Version history and undo/redo.
* Offline synchronization.
* Organization-wide resource sharing (reusable props, costumes, etc.).
* Multi-venue support.
* AI-assisted production analysis.
