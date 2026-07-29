# Phase 12 — Lav Chart (Wires & Packs)

**Status:** Complete (2026-07-26) — owner authorized build; WP1–WP5 shipped

**Goal:** Give the tech director a production-scoped, editable **lav chart**: scene columns × actor rows, separate **wire** and **pack** sheets, a button (or equivalent) to run rule-based **proposed** assignments, visible rules + feasibility flags, and browser print. Timeline mic attachments stay untouched; event-driven “get pack on” Moments come later.

Tracks pre-August STP prep P1 (lav / mic change chart) and follows Phase 11 singer attribution as the data foundation for “who needs a lav when.”

---

## Owner Decisions (confirmed 2026-07-26)

| Topic | Decision |
| ----- | -------- |
| **Artifact shape** | **Assignment matrix first** (scene columns × actor/character rows). Change-list / swap chart later. |
| **Row identity** | Prefer **actor** as the row: `Connor McKinnis (SHACKLETON, PENGUIN #2)`. Uncast speaking characters get their own row until cast. |
| **Columns** | **One column per Scene** (act+scene order), not act-only. |
| **Inventory** | Track **wires and packs separately**. Two sheets (Wire chart + Pack chart). Production-scoped catalogs; org-wide inventory later. |
| **Wire vs pack semantics** | **Wires:** typically on from top of show for everyone who needs a lav. **Packs:** not everyone has a pack yet; assign when speaking/singing requires it; minimize changes (prefer act-break / intermission). |
| **Who needs a lav** | Any Character with **dialogue or lyrics** (Phase 11 `lyric_lines`). Exclude builtins `ALL` / `ENSEMBLE`. |
| **Propose rules** | Prefer one assignment for the whole show; if inventory is short, allow **Act 1 ↔ Act 2 (intermission) only** in the auto-proposer; never auto-suggest mid-act changes. Prefer highest speaking+singing load when rationing. TD overrides always win. |
| **Infeasibility** | If rules cannot be satisfied, **flag** the production/setup so the TD knows **manual mid-act** pack/wire changes are required. |
| **Timeline** | **Separate** from `moment_microphones` for now. Future: approved lav chart → derived Timeline actions (“get pack on”). |
| **Editing / home** | Editable where calculations live. Dedicated page OK; Reports link + print OK. |
| **Print / export** | Browser `window.print()` only for v1. |
| **Naming** | **Lav chart** in UI; subtitles “Wires” / “Packs”. |
| **Success (v1)** | Manually editable charts + run **Propose chart** + see rules in-app + rule-fail / conflict highlights. Rule *configuration* UI deferred (document rules; hard-code for now). |
| **Existing `microphones` catalog** | **Leave as-is** for Timeline moment attachments. Lav chart uses new **`wires`** + **`packs`** catalogs so we do not overload mic-attachment semantics. |

### Defaults to confirm (small)

| Topic | Proposed default | Why |
| ----- | ---------------- | --- |
| **Page location** | New **Lav chart** page under Preparation + TOC entry / link from Reports | Editable grid + propose + alerts is heavier than other read-only sheets |
| **Cell storage** | Persist **per (wearer row × scene)** wire_id / pack_id (nullable = none) | Matches scene columns; simple edit/save; compression can wait |
| **Propose behavior** | Button writes into the **working chart** (overwrites after confirm if chart already edited) | Avoid silent dual “draft vs live” until we need versions |
| **Dual-cast actor** | One row; cells are that actor’s wear for the scene (not per-character cells) | Matches booth “who is wearing the gear” |
| **Shared character (should not happen)** | Casting is 1:1 today; ignore multi-actor per character | Existing `user_character_assignments` uniqueness |

---

## Where We Are


### Shipped and useful

| Area | Status |
| ---- | ------ |
| Reports page (prop / cue / costume / entrance-exit / blocking) + print CSS | Done |
| Characters + casting (`user_character_assignments`) | Done |
| Dialogue → speakers; Phase 11 `lyric_lines` / song attribution | Done |
| Production mic catalog + `moment_microphones` | Done — **not** the lav-chart source of truth |
| Acts → Scenes → Moments hierarchy | Done |


### Gaps this phase addresses

| Item | Notes |
| ---- | ----- |
| No wire/pack lav assignment UX | Booth still tribal / spreadsheet |
| No production wire vs pack inventory | Only generic `microphones` |
| No auto-propose / feasibility | — |
| No printable lav matrix | — |


### Explicitly not Phase 12

| Item | Target |
| ---- | ------ |
| Change-list / “swap at this moment” chart | After matrix MVP |
| Event-driven Timeline “get pack on / off” from lav chart | Later (parked with other event-driven assets) |
| Org-wide / theater inventory UI | Post-MVP; CSV bridge remains the story |
| Configurable rules settings UI | After hard-coded rules prove useful |
| PDF / CSV export of lav chart | After print |
| Character packets | After lav chart (agreed sequencing) |
| Sync lav chart ↔ `moment_microphones` | With event-driven work |

---

## Read First

| Document | Why |
| -------- | --- |
| [PRE_AUGUST_STP_PREP.md](PRE_AUGUST_STP_PREP.md) | Lav chart as P1 sheet |
| [STP_PRODUCT_OVERVIEW.md](STP_PRODUCT_OVERVIEW.md) | Idea #2 lav / mic change charts |
| [PHASE_11.md](PHASE_11.md) | Singer data foundation |
| [DATABASE.md](DATABASE.md) | Catalog + junction patterns; `microphones` stay separate |
| [ROLES.md](ROLES.md) | Director/Admin edit; print likely same |

**Code anchors:** `frontend/src/pages/ReportsPage.tsx`, `backend/app/api/reports.py`, `backend/app/models/microphone.py`, dialogue + `lyric_line` models, Characters casting API.

---

## Problem Statement

Community-theater booths need a clear answer: **who wears which wire and which pack in each scene**, with as few mid-show changes as possible because packs/wires are delicate and require trained staff.

Today the app can attach microphones to Moments, but that is not a planning chart, does not split wire vs pack, and does not help ration a finite inventory across a cast.

Directors need:

1. Inventory of wires and packs for **this** production  
2. A matrix they can **edit**  
3. A **Propose** action that fills a best-effort chart from speaking/singing load + stability rules  
4. Clear **flags** when inventory forces mid-act manual work  
5. A **printable** booth copy  

---

## Product shape (v1)

### Sheets

Two sibling matrices (same rows/columns):

1. **Wires** — cell = wire identifier (or empty)  
2. **Packs** — cell = pack identifier (or empty)

**Rows:** one per wearer group  

- Cast actor: `Display Name (CHAR A, CHAR B)` sorted character names  
- Uncast speaking/singing character: `Uncast (CHAR NAME)` (or character name only)

**Columns:** every Scene in act/scene order (`1-1`, `1-2`, … / titles in header tooltip or subtitle)

**Sticky first column** + horizontal scroll on screen; print uses landscape-friendly CSS (condensed headers OK).

### Inventory

New production catalogs (mirror existing CRUD patterns):

- **Wires** — `identifier`, optional `notes`  
- **Packs** — `identifier`, optional `notes`  

CSV import templates optional in this phase if cheap after CRUD; otherwise manual create is enough for MVP.

### Working chart persistence

Store TD-edited assignments separately from catalogs:

- Wire assignment: `(production_id, wearer_key, scene_id) → wire_id | null`  
- Pack assignment: `(production_id, wearer_key, scene_id) → pack_id | null`  

`wearer_key` recommendation: `user_id` when the row is an actor; else `character_id` for uncast rows. Enforce uniqueness so a character does not appear in both an actor row and an uncast row.

Empty cell = no wire/pack in that scene.

### Propose chart

Director/Admin clicks **Propose chart** (wires, packs, or both):

1. Build wearer rows from Characters with any `dialogue` or `lyric_lines`, excluding `ALL` / `ENSEMBLE`.  
2. Compute per-character (then per-row) **need scenes**: scenes where that character speaks or sings.  
3. **Wires:** assign a wire for all scenes from first appearance through end of show when possible (or full show if they ever speak); prefer stable whole-show assignment; ration by load; only suggest intermission changes if inventory requires it.  
4. **Packs:** assign pack only on scenes in the need-set (and optionally contiguous blocks to reduce on/off thrash — prefer hold pack across non-speaking scenes within an act if inventory allows; if not, pack only on need scenes). Prefer whole-show then act-stable; never auto mid-act reassignment between two wearers.  
5. If still impossible under “no mid-act auto changes,” return assignments **plus** feasibility issues (see below) and leave gaps / mark cells that need manual mid-act work.  
6. Write result into working chart after confirm if overwriting edits.

Exact pack “hold across silent scenes” heuristic can be tuned in implementation; document the chosen rule in-app.

### Rules panel (read-only in v1)

In-app copy listing the hard-coded rules, e.g.:

- Anyone with lines or lyrics needs a lav when they speak/sing  
- Prefer whole-show stability; next preference is change only at intermission  
- Auto-propose never inserts mid-act wearer swaps  
- Wires and packs are separate inventories  
- Insufficient inventory → feasibility alert; TD adds mid-act changes manually  

Future: production or org settings to tweak weights / allow mid-act in proposer.

### Feasibility & highlights

Surface issues such as:

- More concurrent pack needs in a scene than packs available  
- Propose could not cover all need-scenes without mid-act changes  
- Same wire/pack assigned to two wearers in the same scene (conflict)  
- Speaking/singing scene with empty pack (and/or wire) cell  

UI: banner summary + cell/row highlights (conflict = strongest).

### Print

Same pattern as Reports: hide chrome, keep matrices readable, `break-inside: avoid` where practical. Print both sheets or current tab.

---

## Data model (proposed)

```text
wires          (id, production_id, identifier, notes?)
packs          (id, production_id, identifier, notes?)

lav_wire_assignments
  (id, production_id, scene_id,
   user_id?, character_id?,   -- exactly one set for wearer_key
   wire_id?)                  -- null = cleared

lav_pack_assignments
  (id, production_id, scene_id,
   user_id?, character_id?,
   pack_id?)
```

Constraints:

- Unique wearer identity per row semantics (check: one of `user_id` / `character_id`)  
- Unique `(production_id, scene_id, user_id)` / `(production_id, scene_id, character_id)` as appropriate  
- Optional unique `(production_id, scene_id, wire_id)` where `wire_id` not null — **or** enforce only in validation API so TD can temporarily save conflicts while fixing (recommend: **validate on propose + soft-warn on save**, hard-block optional later)

Keep `microphones` / `moment_microphones` unchanged.

Document in [DATABASE.md](DATABASE.md). Migration number: next after Phase 11.

---

## Work packages

### WP0 — Owner confirms phase defaults

- Confirm page location, overwrite-on-propose, and dual-sheet UX.  
- Edit this doc’s “Defaults to confirm” if anything differs.

**Done when:** Build authorized against this doc. ✅ 2026-07-26

---

### WP1 — Docs lock-in

- Update DATABASE.md for `wires`, `packs`, assignment tables.  
- Note Phase 12 in PROJECT.md companion / phase summary.  
- Scratch / PRE_AUGUST: lav chart in progress.  
- ERD touch if cheap.

**Done when:** Docs describe target schema and product shape. ✅

---

### WP2 — Schema + models + migration

- Alembic: `wires`, `packs`, `lav_wire_assignments`, `lav_pack_assignments`.  
- SQLAlchemy models + Production relationships.  
- Catalog CRUD APIs (mirror microphones).  

**Done when:** Migration applies; catalogs creatable via API. ✅ (`016_wires_packs_lav_chart.py`)

---

### WP3 — Lav chart API (read / write / propose / validate)

- `GET` chart payload: rows (label, user_id?, character_ids[], need_scene_ids[]), scenes[], wire grid, pack grid, issues[].  
- `PUT`/`PATCH` cell or bulk save for wires and packs.  
- `POST .../lav-chart/propose` with options `{ sheets: ["wires","packs"] }` → proposed grids + issues; persist after confirm (or propose+apply query flag).  
- Server-side rule evaluation for conflicts / uncovered need scenes / inventory shortfall.  

**Done when:** API tests cover propose on a small fixture (few characters, tight pack count → feasibility flag). ✅ `test_phase12_lav_chart.py`

---

### WP4 — Lav chart UI

- Preparation nav: **Lav chart**.  
- Inventory quick-add or link to Wires / Packs catalog pages (minimal CRUD pages).  
- Matrix UI: wire tab + pack tab; sticky row labels; editable cells (select from catalog / clear).  
- **Propose chart** button + confirm overwrite.  
- Rules panel (collapsible).  
- Issue banner + cell highlights.  
- Print button + print CSS.  
- Reports page: link/TOC entry to Lav chart (do not dump full editor into Reports unless it stays thin).  
- **Follow-up 2026-07-27:** collapsible **Manage wires & packs** list with edit (identifier + notes) and delete-with-confirm (clears chart cells).  

**Done when:** Director can create inventory, propose, edit, see flags, print. ✅

---

### WP5 — Fixture smoke + closeout

- Use Endurance (or a small lav-specific fixture) after casting a few actors; verify rows, propose, print.  
- Feature closeout: PHASE_12 status, scratch, PRE_AUGUST checkbox, About copy if it claims lav sheets prematurely.  

**Done when:** Definition of Done below is true. ✅ (API tests + docs closeout; run `alembic upgrade head` when Postgres is up)

---

## Rollout order

```text
WP0 confirm defaults + authorize build
  ↓
WP1 docs
  ↓
WP2 schema + catalog APIs
  ↓
WP3 chart read/write/propose/validate
  ↓
WP4 UI + print + Reports link
  ↓
WP5 smoke + closeout
```

---

## Definition of Done

Phase 12 v1 is complete when:

1. Production has **Wires** and **Packs** catalogs (separate from Timeline microphones).  
2. Lav chart page shows **actor-centric rows** and **per-scene columns** for both sheets.  
3. TD can **manually edit** and **save** wire/pack cells.  
4. **Propose chart** fills assignments using the agreed rules and never auto-inserts mid-act wearer swaps.  
5. When inventory cannot satisfy rules without mid-act changes, the UI **flags** that clearly.  
6. Conflicts / uncovered speaking-or-singing scenes are **highlighted**.  
7. Rules are **visible in-app** (read-only copy).  
8. **Browser print** produces a usable booth copy.  
9. Timeline `moment_microphones` behavior is **unchanged**.  
10. DATABASE.md / this phase doc match shipped behavior.

---

## Risks / tradeoffs

| Risk | Mitigation |
| ---- | ---------- |
| Many scenes → very wide matrix | Sticky labels, horizontal scroll, condensed print headers; act-grouped headers |
| Propose heuristics feel “wrong” for STP | Keep rules visible; easy manual edit; tune after one real show |
| Dual catalogs confuse vs Microphones page | Clear nav labels; Microphones page copy: “Timeline attachments — lav planning is on Lav chart” |
| Overwrite destroys TD work | Confirm dialog before propose apply |
| Per-scene storage is verbose | Accept for MVP; range compression later if needed |
| Scope creep into Timeline events | Explicitly out of phase |

**Recommendation:** Ship the editable matrix + propose + flags + print before any Timeline integration.

**Deferring:** change-list sheet, event-driven Moments, org inventory, rule settings UI, PDF/CSV.

---

## Follow-on (not this phase)

1. **Change chart** derived from matrix diffs (who swaps at which scene/act break).  
2. **Timeline integration** — approved chart → “get pack on/off” (and wire) Moment actions.  
3. **Character packets** — include lav assignment for tonight.  
4. **Org catalog** shop-into-production for wires/packs.  
5. **Configurable rules** in settings.

---

## Decision Log

| Date | Decision |
| ---- | -------- |
| 2026-07-26 | Matrix first (scene × actor); change chart later |
| 2026-07-26 | Separate wire + pack sheets and catalogs; production-scoped |
| 2026-07-26 | Need = dialogue or lyrics; exclude ALL/ENSEMBLE |
| 2026-07-26 | Propose: whole-show > intermission-only changes; flag if mid-act manual needed; no auto mid-act swaps |
| 2026-07-26 | Separate from Timeline mic attachments for now |
| 2026-07-26 | Browser print only; rules visible; config UI later |
| 2026-07-26 | Proposed default: dedicated Lav chart page; new `wires`/`packs` tables; leave `microphones` alone |

---

## Open questions

None — defaults accepted; build authorized 2026-07-26.

---

## Decision Log (build)

| Date | Decision |
| ---- | -------- |
| 2026-07-26 | Built dedicated Lav chart page; new `wires`/`packs` + assignment tables; leave `microphones` alone |
| 2026-07-26 | **Superseded by Phase 13:** Timeline `microphones` / `moment_microphones` retired; lav chart is sole lav planning surface |
| 2026-07-26 | Propose overwrites after confirm; browser print; rules read-only in-app |