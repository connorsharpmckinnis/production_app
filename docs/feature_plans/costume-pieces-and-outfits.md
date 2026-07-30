# Feature plan — Costume pieces & outfits

**Status:** Roadmap (curiosity / far-field; approved as eventual candidate)  
**Created:** 2026-07-29  
**Related:** [PHASE_14.md](../PHASE_14.md) (whole-costume on/off shipped), [PROJECT.md](../PROJECT.md) costume pieces wish, [org-catalog-and-shop.md](org-catalog-and-shop.md)

---

## Goal

Track **individual costume pieces** and **outfit combinations**, not only whole costume on/off events — e.g. hat added mid-scene while base look persists.

---

## Baseline

Phase 14 WP5: whole costumes via `moment_costume_events`. Pieces/outfits explicitly deferred.

---

## Proposed direction

- Piece entities belong to a costume or character wardrobe.
- Events: wear/clear piece (or swap outfit).
- Derived “what are they wearing now?” = outfit resolution.
- Packs/charts consume derived look.

---

## Non-goals

- Full wardrobe inventory ERP
- Photo-based lookbooks as v1 requirement

---

## Recommendation

Only after whole-costume events feel solid in a real show and costumers ask for piece-level truth.
