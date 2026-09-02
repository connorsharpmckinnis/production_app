# Feature plan — Scene summary drill-down

**Status:** Roadmap (curiosity / far-field; Character scene context partially shipped)  
**Created:** 2026-07-29  
**Updated:** 2026-09-02  
**Related:** [PROJECT.md](../PROJECT.md) wish list, [SCRATCH_NOTES.md](../SCRATCH_NOTES.md) scene-level stats, Phase 6 read-only chips, [PHASE_14.md](../PHASE_14.md), [in-play-moment-deep-links.md](../shipped_features/in-play-moment-deep-links.md), [character-nightly-packs.md](character-nightly-packs.md), [object-detail-pages.md](../shipped_features/object-detail-pages.md)

---

## Goal

Make **scene-level summaries** visible on the Timeline (who’s involved, props, songs, etc.) with **clickable drill-down**: e.g. tap Crean → detail with entrance/exit moments, costume, props, set pieces for that scene.

---

## Shipped so far (via object detail)

See [object-detail-pages.md](../shipped_features/object-detail-pages.md):

- Scene summary **character** chips → Character detail with **In {scene}** (E/E, end-of-scene holdings, on-stage)
- Scene summary **song** chips → Song detail (as-is, not scene-filtered)

---

## Still open

- Named **prop chips** on the strip (today: count only) → Prop detail, ideally scene-filtered
- Scene-filtered sections for Prop / Group / other types
- Clearer on-stage vs in-scene copy polish if anything still misleads
- Optional: derive Character E/E without requiring `reports:read` (today E/E needs that capability)

---

## Baseline

Phase 6 shipped read-only scene summary chips. Phase 14 + in-play deep links made derived asset state available for accurate drill-down.
