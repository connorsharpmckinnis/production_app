# Feature plan — Show archives (institutional memory)

**Status:** Roadmap (approved intent — build eventually; not yet phased)  
**Created:** 2026-07-29  
**Related:** [STP_PRODUCT_OVERVIEW.md](../STP_PRODUCT_OVERVIEW.md) idea #5, [DATABASE.md](../DATABASE.md) production status sketches, [org-catalog-and-shop.md](org-catalog-and-shop.md), [soft-pilot-ops.md](soft-pilot-ops.md)

---

## Goal

Preserve **past STP productions** as readable institutional memory — so the next team can learn what was used, how it was structured, and what to remount — without keeping every old show in the active prep list forever.

**Primary motivating UX:** After closing night, Admin marks the production **Archived**. It leaves the default production picker but remains openable read-mostly: Timeline, catalogs, key reports, casting history.

**Secondary motivating UX:** “What mic plot did we use last year for the Christmas show?” → open archive → lav chart / catalogs.

**Tertiary motivating UX:** Seed a new show from an archive (copy catalogs / structure hints) — carefully, without cloning sacred script text incorrectly.

---

## Problem

Volunteer turnover loses show knowledge. Active production lists get noisy if old shows linger. Deleting productions destroys memory. Emmy’s multi-show investment story needs **history**, not only live prep.

---

## Product model (proposed)

### Production lifecycle status

| Status | Meaning |
| ------ | ------- |
| `active` | Default; editable per normal roles |
| `archived` | Hidden from default lists; openable; **mostly read-only** |
| (later) `draft` / `listed` | Only if needed |

### Archive behavior

| Area | Archived production |
| ---- | ------------------- |
| Visibility | Admin: always; Directors: optional; Actors: no (unless still cast and you allow — default no) |
| Edits | Block Timeline/catalog mutations; allow Admin “unarchive” |
| Script / moments | Retained fully |
| Users | Casting rows retained for history; login access optional |
| Reports / charts | Readable + printable |

### Remount helpers (phase 2 of this feature)

- **Copy org-relevant catalogs** into a new production (ties to org catalog).
- **Do not** blindly clone imported script as if it were a new sacred import — remount may need fresh writer export ([script-revision-reimport.md](script-revision-reimport.md)).
- Optional: “clone production as template” that copies structure/catalogs but expects new import.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Productions | Effectively all active; delete is destructive |
| Soft delete / archive flag | Not a user-facing lifecycle |
| Cross-production browse | Limited |

---

## Explicitly out of scope (v1)

- Public marketing archive site
- Video / photo asset DAM
- Cross-production analytics dashboards (later wish)
- Legal retention policy engine

---

## Open questions

1. **Who can open archives?**  
   **Recommendation:** Admin always; Directors of the org can browse archives; Actors no by default.
2. **Unarchive?**  
   **Recommendation:** Admin only; restores editability.
3. **Storage cost** — keep everything forever?  
   **Recommendation:** yes for STP-scale; revisit if DB bloat appears.
4. **Export bundle** — zip of CSV + script md for cold storage?  
   **Recommendation:** nice follow-on; not v1 blocker.

---

## Done when

- Productions can be archived / unarchived.
- Archived shows are hidden from default pickers but browsable by allowed roles.
- Timeline and key reports remain readable; accidental edits are blocked.
- Docs explain archive vs delete.

---

## Suggested build sequence

1. `status` (or `archived_at`) on productions + list filters.
2. Read-only enforcement in API for archived.
3. Archive UI affordances + confirmation copy.
4. Remount / copy-catalog helpers.
5. Optional export bundle.

---

## Risks / tradeoffs

- Read-only holes (some PATCH routes missed) — centralize a dependency check.
- Directors wanting to tweak an archive “just once” — unarchive is the escape hatch.
- Confusing archive with org catalog — catalogs are reusable inventory; archives are **show memory**.
