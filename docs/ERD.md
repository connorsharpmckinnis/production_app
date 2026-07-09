# Entity Relationship Diagram (MVP)

**Version:** 0.1

Mermaid diagram of the MVP PostgreSQL schema. Details: [DATABASE.md](DATABASE.md).

```mermaid
erDiagram
    organizations ||--o{ users : has
    organizations ||--o{ productions : has

    users }o--o{ app_roles : "user_app_roles"
    users }o--o{ characters : "user_character_assignments"
    users }o--o{ groups : "user_groups"
    users ||--o{ notes : writes
    users ||--o{ tasks : "assigned_user_id"
    users ||--o{ bookmarks : has

    productions ||--o{ acts : has
    productions ||--o{ characters : has
    productions ||--o{ groups : has
    productions ||--o{ songs : has
    productions ||--o{ props : has
    productions ||--o{ costumes : has
    productions ||--o{ microphones : has
    productions ||--o{ cue_categories : has
    productions ||--o{ set_pieces : has
    productions ||--o{ performances : has
    productions ||--o{ notes : has
    productions ||--o{ tasks : has

    acts ||--o{ scenes : has

    scenes ||--o{ moments : has
    scenes ||--o{ costumes : "scene_id (MVP)"

    moment_types ||--o{ moments : classifies

    moments ||--o{ dialogue : has
    moments ||--o{ stage_directions : has
    moments ||--o{ cues : has
    moments ||--o{ notes : has
    moments ||--o{ tasks : has
    moments ||--o{ bookmarks : has

    characters ||--o{ dialogue : speaks
    characters }o--o{ groups : "group_characters"
    characters ||--o{ costumes : wears

    cue_categories ||--o{ cues : categorizes

    productions ||--o{ notes : "nullable FK"
    performances ||--o{ notes : "nullable FK"
    acts ||--o{ notes : "nullable FK"
    scenes ||--o{ notes : "nullable FK"
    moments ||--o{ notes : "nullable FK"
    characters ||--o{ notes : "nullable FK"
    songs ||--o{ notes : "nullable FK"
    props ||--o{ notes : "nullable FK"
    costumes ||--o{ notes : "nullable FK"
    microphones ||--o{ notes : "nullable FK"
    cues ||--o{ notes : "nullable FK"
    tasks ||--o{ notes : "nullable FK"
```

---

## Derived Relationships (not stored)

These are computed from Timeline data, not foreign keys:

* Character → Scene (via dialogue / stage direction references)
* Character → Song (via song attribution / lyric moments)
* Prop → Scene (via future prop events)
* Song → Scene (via moments linked to songs)

---

## Junction Tables

| Table | Joins |
|---|---|
| `user_app_roles` | users ↔ app_roles |
| `user_character_assignments` | users ↔ characters (casting) |
| `group_characters` | groups ↔ characters |
| `user_groups` | groups ↔ users |

---

## MVP Tables Not Shown in Detail

`performances`, `tasks`, `bookmarks`, `set_pieces`, `microphones`, `props` — see [DATABASE.md](DATABASE.md). Included in diagram where they have direct FK relationships.

---

## Post-MVP Additions

* `costume_scenes` join table (multi-scene costumes)
* `preparation_progress` (derived completion tracking)
* Event tables (Phase 3+)
