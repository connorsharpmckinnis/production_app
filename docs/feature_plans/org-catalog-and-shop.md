# Feature plan — Org catalog & shop (check-out to shows)

**Status:** Roadmap (approved intent — build eventually; not yet phased)  
**Created:** 2026-07-29  
**Related:** [CATALOG_CSV.md](../CATALOG_CSV.md), [PRE_AUGUST_STP_PREP.md](../PRE_AUGUST_STP_PREP.md) org inventory bridge, [SCRATCH_NOTES.md](../SCRATCH_NOTES.md) permanent theater inventory note, [PROJECT.md](../PROJECT.md) (one org per deployment), [PHASE_14.md](../PHASE_14.md)

---

## Goal

Give the **theater (organization)** a durable **org-wide asset catalog** — mics/wires/packs, standard set pieces, reusable props, optionally costumes — that directors can **check out / copy into a production** instead of re-typing inventory every show.

**Primary motivating UX:** Admin maintains “STP House Inventory” (30 mic packs, stair units, platforms). For a new musical, Director opens **Shop from org catalog**, multi-selects items, and they appear as production catalog rows (ready for Timeline events / lav chart), without CSV gymnastics.

**Secondary motivating UX:** Admin bulk-loads or refreshes the org catalog via **CSV import** (same mental model as today’s production CSV imports).

**Tertiary motivating UX:** Remount next season: “check out the same core set package” so multi-show investment is visible (Emmy’s Stage Write concern).

---

## Problem

Today every production owns its own catalogs. CSV import is a workable bridge, but:

- There is no **theater-owned source of truth** inside the app.
- Directors re-import or re-key the same platforms / packs every show.
- Emmy’s multi-show story needs something more durable than “keep Excel files forever.”

We are **not** building full inventory SaaS (purchase orders, condition tracking, rental billing). We are building **org library → production checkout**.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Org model | One organization per deployment (`organization_id` on productions/users) |
| Catalogs | Production-scoped props, set pieces, costumes, songs, cue categories |
| CSV import | Production-level only ([CATALOG_CSV.md](../CATALOG_CSV.md)) |
| Lav wires/packs | Production lav chart lists (manual); not org-shared |
| Timeline usage | Phase 14 events reference **production** catalog rows |

---

## Product model (proposed)

### Org catalog item

A reusable definition owned by the organization:

| Field | Notes |
| ----- | ----- |
| `organization_id` | Required |
| `asset_kind` | `prop` \| `set_piece` \| `costume` \| `lav_wire` \| `lav_pack` (v1 set — expand later) |
| `name` / identifier | Required; unique per kind within org |
| `description`, `notes` | Optional |
| Kind-specific fields | e.g. set `mobile`; lav identifier patterns; costume size notes — keep thin |
| `active` | Soft-hide retired items without deleting history |

**Songs / cue categories:** optional later; less “physical inventory,” lower priority.

### Checkout (shop)

**Checkout** creates **production-local copies** (or links — see open questions) of selected org items into the production catalog.

| Approach | Pros | Cons |
| -------- | ---- | ---- |
| **A. Copy on checkout (recommended v1)** | Production can rename/annotate freely; org catalog stays clean; matches current production-owned rows | Drift from org definitions over time |
| B. Live link / reference | Single source of truth | Harder edits; delete/cascade rules; Phase 14 FKs more complex |
| C. Copy once + “refresh from org” | Best of both later | Extra UX |

**Recommendation:** **Copy on checkout** for v1. Store optional `sourced_from_org_item_id` for traceability / future refresh.

### Conflict / availability

True “checked out exclusive” (only one show may use the physical staircase) is **optional and later**. Community theater often remounts overlapping rehearsals with shared stock.

**v1 recommendation:** no exclusivity locking. Checkout is “add to my show’s catalog,” not inventory reservation. Document that clearly so nobody expects warehouse software.

### CSV

- Org catalog: import/export CSV per `asset_kind` (Admin).
- Keep production CSV import as-is for show-specific one-offs.
- Document the August story: “STP spreadsheet → org catalog → shop into show.”

---

## Proposed UX

1. **Admin → Org catalog** (settings or top-level nav): list by kind, add/edit, CSV import, deactivate.
2. **Production → Shop**: filter org items not yet sourced into this show → multi-select → **Add to production**.
3. After checkout, items behave like normal production catalog rows (Timeline events, lav chart, reports).

Permissions:

| Action | Who |
| --- | --- |
| Manage org catalog | Admin |
| Shop into a production | Admin, Director |
| Actors | No |

---

## Explicitly out of scope (v1)

- Barcode / QR scanning
- Condition / repair / purchase workflows
- Cross-production exclusivity calendars
- Automatic sync from Google Sheets (manual CSV is the bridge)
- Multi-tenant multi-org switching
- Costume piece-level wardrobe ([costume-pieces-and-outfits.md](costume-pieces-and-outfits.md))

---

## Open questions

1. **Costumes in org catalog?** Huge volume; many show-specific.  
   **Recommendation:** support the kind but don’t push STP to dump the whole closet on day one — start with props, set pieces, lav gear.
2. **Copy vs link** — confirm Copy + `sourced_from_org_item_id`.
3. **Where does lav chart read from?** Today wires/packs are lav-specific tables. Checkout should create those production rows, not a third parallel list.
4. **Naming on copy** — allow rename at checkout or only after?  
   **Recommendation:** copy name as-is; edit on production catalog afterward.

---

## Done when

- Admin can maintain an org catalog (CRUD + CSV) for at least props, set pieces, and lav wires/packs.
- Director can shop selected items into a production and use them in Timeline / lav flows.
- Production-specific items still work without org catalog.
- Docs explain CSV bridge → org catalog → shop path for STP.

---

## Suggested build sequence

1. Schema: `org_catalog_items` (+ kind-specific columns or JSON for thin extras).
2. Admin CRUD + CSV import for 2–3 kinds.
3. Production Shop UI + copy-into-production.
4. Wire lav kinds into lav chart lists.
5. Optional: “already in this show” badges; sourced-from traceability in UI.

---

## Risks / tradeoffs

- Building inventory theater people won’t maintain — keep CSV import excellent.
- Over-promising “checked out” exclusivity — name UI **Shop / Add from theater catalog**, not “Reserve.”
- Costume sprawl — phase costumes in last.
