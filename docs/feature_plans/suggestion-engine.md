# Feature plan — Suggestion engine

**Status:** Roadmap (in progress — WP2/WP3 authorized 2026-11-11)  
**Created:** 2026-11-10  
**Related:** GitHub #191 (imminence / suggestion engine), #68 (Next Best Action — migrate later), [emmy-directors-feedback-sept-2026.md](emmy-directors-feedback-sept-2026.md), [rehearsal-capture-and-approvals.md](rehearsal-capture-and-approvals.md), [PREP_READINESS.md](../shipped_features/PREP_READINESS.md), [ai-assisted-querying.md](ai-assisted-querying.md), lav propose (`PHASE_12`), rehearsal suggest-calls (`PHASE_16`)

---

## Goal

Ship a **deterministic, non-AI suggestion system** that evaluates coded rules against production Timeline (and later rehearsal/lav) data, surfaces actionable suggestions in the right place in the app, and applies accepted suggestions through existing mutation APIs as **official** prep — leaving human rehearsal `suggested` → `official` provenance untouched.

This engine is the intended backbone of **Next Best Action (#68)** and similar nudges. First vertical slice is **entrance imminence** only. Existing recommenders (Overview readiness gaps, rehearsal call suggestions, lav propose/issues) stay as-is until a final migration work product folds them into this engine.

---

## Posture

- Humans decide; automation assists. Accept is explicit.
- No generative AI in core operations. A later optional `SuggestionSource` (`rules` | `mcp` | `ai`) can feed the same DTO/apply/dismiss path once the app’s workflows feel final.
- Sacred script text is never modified by suggestions.
- Prefer boring, readable Python rules over a user-facing rules DSL or visual builder (builder is a future consideration only).
- Do **not** reuse attachment `status="suggested"` for engine output. That status means human rehearsal capture awaiting approve and already affects derived on-stage state.

---

## Owner decisions (locked 2026-11-10)

| Topic | Decision |
| ----- | -------- |
| First rule | Entrance imminence only (trigger details tunable later) |
| On accept | Create attachments as **`official`** |
| Visibility | Anyone with Timeline **edit** capability (not actors in Rehearse-only) |
| Dismiss | Per **instance** (fingerprint), not “dismiss all of this rule type” |
| Look-ahead | **15** moments within the **same scene** (parametrized for later) |
| Placement | Prefer nearest prior `stage_direction`; else nearest prior moment; else the speaking moment / first moment of scene if at top — **never invent Moments** |
| Groups | **Included** for entrance imminence; rules may opt out of groups (e.g. future lav rules) |
| Docs | This feature plan; promote to `PHASE_*.md` when build is authorized |
| #68 / other recommenders | Same destination engine eventually; **leave current UIs**; end with a migration WP |
| Owner tooling | **pytest + dry-run API**; basic end-user UI in first pass; **no Suggestion Lab / visual builder** for now |

---

## Problem

Prep editors still type many entrances by hand even when the script already implies who must be on stage soon. Soft on-stage hints in Moment Detail help when adding subjects, but they do not proactively propose “add Muse entrance here.” Sibling heuristics (lav Propose, rehearsal suggest-calls, Overview gaps) each reinvent evaluate → show → act without a shared accept/dismiss spine.

---

## Architecture

```text
Rules library (Python)  →  Engine (context → evaluate → dedupe → filter dismissals)
                                 ↓
                        Suggestion DTOs (placement + actions)
                                 ↓
              UI (Timeline row / Moment Detail) — Accept / Dismiss
                                 ↓
            Accept → existing create APIs (official)
            Dismiss → suggestion_dismissals (fingerprint)
```

### Segment A — Engine + UX

A **Suggestion** is an ephemeral computed DTO (not a Moment attachment row):

| Field | Purpose |
| ----- | ------- |
| `fingerprint` | Stable id for dedupe/dismiss: `rule_id` + subject kind/id + placement `moment_id` (+ scene) |
| `rule_id` | e.g. `entrance_imminence` |
| `severity` | `info` / `warning` (advisory only in v1) |
| `title` / `rationale` | Short what + why |
| `placement` | `timeline_row` and/or `moment_detail` |
| `anchor_moment_id` | Where the UI surfaces the nudge |
| `subject` | `character_id` **or** `group_id` (XOR; walk-on `user_id` out of scope for v1 rule) |
| `actions[]` | Typed apply payloads (e.g. `create_entrance`) |

**Evaluation:** request-scoped on the backend for the current scene (and optional open moment). Do not depend on the client N+1 fetching `MomentDetail` for every row.

**Accept:** call existing `POST …/moments/{id}/entrances` (etc.) so provenance is normal **official** prep created by the accepting editor.

**Dismiss:** persist fingerprint per production (shared among editors). Only that instance stays dismissed; other subjects/placements from the same rule still appear. If underlying data changes enough that the fingerprint would differ (different placement moment), a new instance may appear — acceptable for v1; document it.

### Segment B — Rules library

Tiny protocol, explicit code:

- `RuleSpec`: `id`, title, domains, `supports_groups: bool`, params (e.g. `look_ahead=15`)
- `Rule.evaluate(ctx) -> list[SuggestionDraft]`
- Shared helpers: look-ahead speakers (characters + groups), on-stage tracks, nearest prior stage direction, fingerprinting

No in-app rule builder. Params are code constants (or a small config sidecar later if needed).

---

## First rule — Entrance imminence

### Trigger

Within one **scene**, from each candidate speaking/singing moment (and optionally when evaluating “from start of scene”):

1. Collect subjects that appear as dialogue / lyric / song-attribution speakers in the next **N=15** moments (**characters and groups**). Exclude builtin characters `ALL` / `ENSEMBLE`.
2. For each subject, find the **first** such moment in the window where they speak/sing.
3. Determine whether they are already considered on stage **immediately before** that moment (scene-scoped derivation, same family as `on_stage.py`).
4. If not on stage → emit a candidate.

### On-stage / group semantics (v1)

Timeline keeps **parallel tracks** (character / group / user). Theater often enters a group (“the five muses enter”) then gives individual lines.

| Subject that speaks | Treat as already covered when… | Suggest entrance of… |
| ------------------- | ------------------------------ | -------------------- |
| **Group** G | `G` is on the **group** on-stage track | Group G |
| **Character** C | `C` is on the **character** track, **or** any on-stage **group that includes C** | Character C (only if not covered) |

Do **not** require expanding a group entrance into per-member character entrances for this rule. Do **not** auto-suggest member entrances when only the group spoke.

Walk-on `user_id` subjects: out of scope for this rule.

Stage-direction **name mentions** as hard triggers: **out of scope for v1** (false-positive risk). May soft-signal later.

### Placement

For each candidate, choose `anchor_moment_id`:

1. Nearest **preceding** `stage_direction` in the same scene (strictly before the first speaking moment).
2. Else nearest preceding moment of any type.
3. If the speaking moment is the first moment of the scene (or there is no preceding moment): place on that **first / speaking** moment.
4. Never create a new Moment.

Surface on Timeline at the anchor row and in Moment Detail when the open moment is the anchor (or, if useful, the speaking moment — product polish during build; default = anchor).

### Action

One primary action: create an **official** entrance on the anchor moment for that subject (`character_id` or `group_id`).

If an identical entrance already exists, the engine must not suggest it (and Accept should no-op / 409-safe).

---

## APIs (proposed)

### Suggestions (dry-run + UI)

- `GET /api/productions/{id}/suggestions?scene_id=&moment_id=&rule_id=`
  - Requires Timeline edit capability.
  - Returns current non-dismissed suggestions for scope (scene required for v1).
  - `rule_id` optional filter (useful for pytest/debug and later multi-rule).
- `POST /api/productions/{id}/suggestions/dismiss` body `{ "fingerprint": "…" }`
- `POST /api/productions/{id}/suggestions/accept` body `{ "fingerprint": "…" }`  
  **or** client calls existing entrance create with action payload from the DTO — prefer **one accept endpoint** that applies the action server-side so fingerprints stay consistent and tests stay simple.

Dry-run for owners/devs is the same GET (no separate Lab). Optional query `include_dismissed=true` for debugging only if cheap.

### Dismissal persistence

New table (name flexible): `suggestion_dismissals`

- `id`, `production_id`, `fingerprint` (unique per production), `dismissed_by_user_id`, `created_at`
- No per-rule blanket dismiss in v1

### Multi-moment details (efficiency note)

Today:

- `GET …/scenes/{scene_id}/moments` → `MomentSummary[]` (includes `speaking_character_ids`, `speaking_group_ids`, `on_stage_character_ids`, type flags — **not** `on_stage_group_ids`)
- `GET …/moments/{moment_id}` → full `MomentDetailResponse` (includes on-stage groups)

**Recommendation:** suggestion evaluation runs **entirely in the backend** against ORM/context loaders (reuse `on_stage_*` helpers). The UI should not N+1 `getMoment` to compute suggestions.

A **batch moment detail** (or enriching `MomentSummary` with `on_stage_group_ids` and entrance/exit subject ids) remains a good follow-on for Timeline efficiency elsewhere; treat as optional WP if Accept/UI needs richer chips without opening Detail. Not a blocker for engine correctness.

---

## UI (first pass — basic)

- **Moment Detail:** surface suggestions inside **Add to moment** as a second row of tiles under the attachment-type picker (one-click accept; small dismiss). No separate Suggestions card stack.
- **Timeline row marker (quest-marker):** when a Moment is an `anchor_moment_id` for any non-dismissed suggestion, show a `CircleAlert` (`size-4`, stroke 2) **inside** the row (trailing, vertically centered). Timeline rows also get a light hover tint so the target row is obvious while scanning. Not the amber dashed human-`suggested` treatment.
- Accept refreshes moments list, suggestions, and detail (same `onChanged` pattern as attachment creates).
- Keep chrome simple; polish later on request.

No Suggestion Lab page. No end-user rules editor.

### Build checklist

| Item | Status |
| ---- | ------ |
| WP0 Owner authorize build | Done (2026-11-11) |
| WP1 Docs / decision log / DATABASE.md | Done |
| WP2 Model `suggestion_dismissals` + migration `036` | Done |
| WP2 Engine + entrance imminence rule + GET/accept/dismiss API | Done |
| WP2 Pytest (character, group, dismiss, accept, actor 403) | Done |
| WP3 Moment Detail suggestion list (Accept / Dismiss) | Done |
| WP3 Timeline row corner marker (`CircleAlert`) | Done |
| Analytics: accept/dismiss → `analytics_events` + summary API | Done (see [analytics-events.md](analytics-events.md)) |
| WP4 Closeout / #68 migration note / Issue #191 | Pending (after you dogfood) |

---

## Work packages

### WP0 — Owner reviews this plan / authorizes build

**Done when:** status moves to Roadmap or a `PHASE_19.md` (or next free phase number) is authorized.

### WP1 — Docs lock-in

- Keep this plan as source of product shape; link from Emmy #191 row / feature_plans README.
- Note in DATABASE.md under future/small tables when dismissal table is approved in the phase doc.

### WP2 — Core engine + dismissals + dry-run API

- Suggestion DTO, Rule protocol, context loader for one scene, fingerprinting, dismissal store + API, `GET/POST accept/dismiss`.
- Pytest with fixture spine (character + group speakers).

**Done when:** dry-run returns stable fingerprints for a fixture scene; dismiss hides that instance only.

### WP3 — Entrance imminence rule + basic UI

- Implement rule with group semantics above; Accept creates official entrance via existing service/API path.
- Timeline + Detail basic surfacing for editors.

**Done when:** on a real/fixture show, group and character entrance suggestions appear on sensible anchors; Accept writes official entrances; Dismiss sticks across refresh.

### WP4 — Closeout + migration backlog note

- Feature closeout: README / Emmy plan / Issues (#191 progress; #68 marked “migrate into suggestion engine”).
- Explicit **follow-on WP (not built now):** migrate Overview readiness gap CTAs, rehearsal suggest-calls/recommendations, and lav propose/issues into rules that emit the same Suggestion DTO (wrappers first, delete duplicate UX later).

---

## Explicitly out of scope (this proposal / first build)

- Generative AI / MCP in the hot path
- Visual rule builder / Suggestion Lab UI
- Exit imminence, lav, rehearsal rules (follow-ons after entrance slice)
- Persisting engine output as attachment `status="suggested"`
- Blanket “dismiss this rule forever” in product UI
- Inventing Moments for placement
- Changing global act-carry vs scene-reset on-stage product rules (this rule uses **scene-scoped** derivation)
- Stage-direction name-mention triggers
- Actor-facing Rehearse suggestions

---

## Risks / tradeoffs

| Risk | Mitigation |
| ---- | ---------- |
| Suggestion spam | Instance dismissals; scene scope; one rule family first; fingerprint dedupe |
| Confusion with human `suggested` prep | Different UX copy (“Suggestion” / Accept); official on accept; no amber dashed approve chrome |
| Group/character double nudges | Coverage rule: character covered if member of on-stage group |
| `MomentSummary` missing group on-stage | Backend-only evaluation; optional summary enrichment later |
| Over-abstract DSL | Keep Python rules + helpers |

**Recommendation:** smallest vertical slice = WP2 + WP3 only after authorization.

**Deferring:** Lab/builder, AI sources, migrating #68/readiness/lav/rehearsal recommenders until the entrance path feels good in real prep.

---

## Follow-on (not this build)

1. Exit imminence (mirror placement after last line).
2. Enrich `MomentSummary` / batch details API for Timeline efficiency.
3. Wrap rehearsal suggest-calls + lav validation/propose as rules.
4. Migrate Next Best Action (#68) / Overview gap CTAs onto the engine.
5. Optional owner Lab; optional visual rule editor.
6. Optional `SuggestionSource` for MCP/AI once core UX is trusted ([ai-assisted-querying.md](ai-assisted-querying.md)).

---

## Decision log

| Date | Decision |
| ---- | -------- |
| 2026-11-10 | Architecture: ephemeral suggestions + official on accept; separate from human `suggested` prep |
| 2026-11-10 | First rule: entrance imminence; look-ahead 15; scene-scoped; groups included with per-rule opt-out |
| 2026-11-10 | Dismiss instance fingerprints only; editors with Timeline edit; pytest + dry-run + basic UI; no Lab yet |
| 2026-11-10 | #68 / existing recommenders migrate later as an explicit end work product |
| 2026-11-11 | Build authorized: WP2+WP3; Detail = full suggestion copy; Timeline = small corner “quest marker” icon on anchor rows |
| 2026-11-11 | Status → Roadmap (in progress) |
| 2026-11-11 | Usefulness tracking via shared `analytics_events` (`suggestion.accepted` / `suggestion.dismissed`); suppress list unchanged |
