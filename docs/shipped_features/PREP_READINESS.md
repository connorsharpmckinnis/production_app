# Prep Readiness and Overview Messages

Phase 8 adds a derived preparation snapshot to each production Overview. It is a practical heuristic for finding likely prep gaps; it is not the post-MVP “reviewed / intentionally blank” progress system and does not claim that every scene has been deliberately reviewed.

Catalog bulk loading is documented separately in [CATALOG_CSV.md](CATALOG_CSV.md). Sample files and pilot loading steps are in [fixtures/catalogs/](../fixtures/catalogs/README.md).

## Readiness calculation

Scores are computed by the backend when `GET /api/productions/{production_id}/overview` is requested. They are not stored.

Latency / query-cost ideas for this path (Neon, caching, splitting the payload) live in [PERFORMANCE.md](../PERFORMANCE.md).

All division results and the overall average use Python's `round()` behavior and return whole-number percentages.

### Soft catalog dimensions

Cues, props, lav chart (wires/packs), and set pieces reward both creating inventory and using it in prep:

```text
seeded_credit = 40 if the production has at least one catalog row, otherwise 0
use_credit    = 60 × (scenes with at least one use / total scenes)
score         = round(seeded_credit + use_credit)
```

“Use” means:

- **Cues:** a scene has at least one cue attached to one of its Moments. The seeded catalog is cue categories.
- **Props:** a scene has at least one Moment prop attachment.
- **Lav chart:** a scene has at least one wire or pack assignment on the lav chart. Seeded inventory is wires + packs (`key=lav_chart`, Overview link → Lav chart).
- **Set pieces:** a scene has at least one Moment set-piece attachment.

A seeded catalog with no Timeline use scores `40`. Full scene coverage with a seeded catalog scores `100`. Timeline use can exist while the catalog count is zero only with inconsistent data; the formula still reports the 60% use portion and identifies the catalog as empty.

### Hard dimensions

```text
casting =
  round(100 × cast non-builtin characters / all non-builtin characters)

costumes =
  round(100 × covered speaking character-scene pairs
              / all speaking character-scene pairs)

entrances_exits =
  round(100 × scenes with at least one entrance AND at least one exit
              / total scenes)

blocking =
  round(100 × scenes with at least one blocking note / total scenes)
```

For costumes, a speaking character-scene pair is distinct: multiple dialogue lines by the same character in one scene count once. A pair is covered only when a costume row has that exact `character_id` and `scene_id`. A costume elsewhere in the show does not cover the pair.

The current importer builtin character set is exactly `ALL` and `ENSEMBLE`; both are excluded from the casting and costume denominators, and from the Characters / casting catalog APIs so they do not appear as castable roles. Any future additions to that shared builtin set will be excluded by the same rule.

### N/A and overall behavior

- A dimension with no applicable denominator has `score: null`, displays as “—”, and is excluded from the overall average.
- Casting is N/A when there are no non-builtin characters.
- Costumes are N/A when there are no non-builtin speaking character-scene pairs.
- All four soft dimensions, entrances/exits, and blocking are N/A when there are no scenes.
- Otherwise, `readiness_percent = round(sum(applicable dimension scores) / applicable dimension count)`.
- If an imported structure somehow has no applicable dimensions, overall readiness is `null`.
- If the production has no acts, the endpoint deliberately returns overall readiness `0` and an empty dimension list. The Overview keeps Import Script as the primary action and uses readiness band `0`; catalog rows alone do not create fake readiness.

## Gap semantics

Gaps are evidence behind a heuristic score, not tasks or proof that a director reviewed a scene.

- **Casting:** names of uncast, non-builtin characters.
- **Costumes:** `Character in Act N / Scene Title — no costume` for uncovered speaking character-scene pairs.
- **Cues, props, lav chart, set pieces:** scenes with no corresponding prep use (Timeline attachment or lav assignment).
- **Entrances / exits:** scenes with neither, no entrances, or no exits. A scene is complete only when both kinds exist.
- **Blocking:** scenes with no blocking note.

Each dimension returns at most 25 gap strings. A score of `100` returns no gaps. The Overview links each dimension to its existing preparation page or the Timeline; links do not mark a gap resolved.

## Role visibility

- **Admin and Director:** see overall readiness, all dimension cards and gaps, and can edit production Overview messages and rotation.
- **Actor:** sees the spotlight, assigned roles, Rehearse action, and honest future placeholders. The Overview API hides `readiness_percent` and returns no dimensions for an Actor-only account.
- A user who also has Admin or Director permission receives the staff readiness view.
- All authenticated roles may read the production message list and global encouragement defaults.
- Only Admin may edit global defaults and global rotation. Admin and Director may edit production messages and production rotation. Actors cannot edit either.

## Overview message resolution

The spotlight supports production-scoped `announcement`, `scripture`, and `encouragement` messages. Encouragement/quotes rotate as a flat list (readiness bands are no longer used for filtering). Global Settings stores one message per line with a shared rotation interval.

The backend builds one queue in this order:

1. Active production announcements.
2. Active production scripture.
3. Active production encouragement, if the production has any.
4. Otherwise, active global encouragement defaults.

Within each kind, rows are ordered by `sort_order`, then database ID. Every active encouragement row is included regardless of its `band` value. Production encouragement replaces the entire global pool when the production has at least one encouragement row; otherwise the global defaults are used. Announcements and scripture have no global fallback.

Inactive messages are omitted. If every applicable pool is empty, the spotlight queue is empty and no spotlight card is shown.

### Readiness band (display only)

The overview endpoint still computes and returns a `readiness_band` string derived from the overall readiness percent. It is used only for Overview display and API compatibility — it no longer selects or filters spotlight messages.

| Overall readiness | Band |
| --- | --- |
| `null` or `0` | `0` |
| `1`–`24` | `1-24` |
| `25`–`49` | `25-49` |
| `50`–`74` | `50-74` |
| `75`–`89` | `75-89` |
| `90`–`99` | `90-99` |
| `100` | `100` |

The application still seeds several friendly global encouragement messages (historically one per band). They now display as a flat rotating pool, and Settings saves edited messages as a plain list (all with `band: "0"`). Admins can edit, disable, add, or replace those defaults in Settings.

### Rotation behavior

- Global rotation defaults to 20 seconds.
- A production setting of `null` inherits the global value.
- A production setting of `0` disables automatic switching.
- Positive values must be 5–300 seconds.
- Automatic rotation runs only when the queue has more than one message.
- The first item is selected deterministically from production ID plus the viewer's local calendar date, so reloads on the same day start consistently.
- Rotation then advances through the resolved queue and wraps to the beginning.
- Previous and Next work whenever the queue has multiple items. Pause/Resume is available when rotation is enabled.
- With one message, the card remains still. With no messages, the card is omitted.

## Setup and migrations

Run the application through Docker:

```text
docker compose up --build
```

The backend startup path applies Alembic migrations and seeds missing application defaults. Phase 8 migrations are:

- `013_microphone_notes.py` — historical (Timeline microphones retired in Phase 13 / migration `017`).
- `016_wires_packs_lav_chart.py` — lav chart inventory + assignments.
- `017_drop_timeline_microphones.py` — drops `moment_microphones` and `microphones`.
- `014_overview_messages.py` — adds rotation settings, global encouragement defaults, and production Overview messages.

For an existing development database, rebuild/restart the backend so migrations run. Schema details are in [DATABASE.md](DATABASE.md).

## Usage

1. Create a production and import a script.
2. Open its Overview as Director or Admin to inspect overall readiness and dimension gaps.
3. Follow a dimension action to casting, a catalog page, or the Timeline and add the missing preparation data.
4. Return to Overview to see the newly derived score.
5. Use the Overview message editor to add show-specific scripture, announcements, or encouragement and set the production rotation.
6. As Admin, use Settings to edit the global rotating messages (one per line) and the inherited rotation default.
7. To seed production catalogs in bulk, use each catalog page's import control and follow [CATALOG_CSV.md](CATALOG_CSV.md).

## Testing

Backend Phase 8 readiness and message tests:

```text
cd backend
uv run pytest tests/test_phase8.py
```

Catalog CSV tests:

```text
cd backend
uv run pytest tests/test_catalog_csv.py
```

Frontend spotlight and CSV helper tests:

```text
cd frontend
npm test
```

Frontend type-check and production build:

```text
cd frontend
npm run build
```

## Known limitations

- Readiness is heuristic coverage, not an explicit review/completion record. It cannot distinguish “not needed” or “reviewed and intentionally blank.”
- A cue, attachment, entrance, exit, or blocking note anywhere in a scene satisfies that scene-level part of the formula; quantity, quality, timing, and completeness are not assessed.
- Catalog seeding earns 40% in soft dimensions even before Timeline use. The weights may need tuning after a full-show trial.
- Gaps are capped at 25 per dimension.
- Costume readiness follows speaking dialogue only and excludes non-speaking appearances.
- Builtin exclusion is name-based using the importer's builtin set.
- Spotlight messages are plain text with no scheduling, audience targeting, or rich HTML.
- Rotation is client-side and per viewer; viewers are not synchronized.
- Full-show/multi-scene manual validation remains pending because the owner's fixture is not yet available.
- CSV imports create catalog rows only. They do not create Moment attachments; see [CATALOG_CSV.md](CATALOG_CSV.md) for duplicate and resolution rules.
