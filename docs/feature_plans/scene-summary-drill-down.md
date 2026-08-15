# Feature plan — Scene summary drill-down

**Status:** Roadmap (curiosity / far-field; approved as eventual candidate)  
**Created:** 2026-07-29  
**Related:** [PROJECT.md](../PROJECT.md) wish list, [SCRATCH_NOTES.md](../SCRATCH_NOTES.md) scene-level stats, Phase 6 read-only chips, [PHASE_14.md](../PHASE_14.md), [in-play-moment-deep-links.md](../shipped_features/in-play-moment-deep-links.md), [character-nightly-packs.md](character-nightly-packs.md)

---

## Goal

Make **scene-level summaries** visible on the Timeline (who’s involved, props, songs, etc.) with **clickable drill-down**: e.g. tap Crean → modal with entrance/exit moments, costume, props, set pieces for that scene.

---

## Baseline

Phase 6 shipped read-only scene summary chips. Full modal drill-down remains wish-list. Phase 14 plus in-play deep links (props, set pieces, costumes) make derived state available for accurate modals.

---

## Proposed direction

- Scene header / strip shows derived summary chips outside Moment Detail.
- Click character chip → detail modal (E/E moments, assets via `asset_state` at scene bounds).
- Click prop/set chip → moments where it changes in scene; deep-link ([in-play-moment-deep-links.md](../shipped_features/in-play-moment-deep-links.md)). Costume wearing source/next-change links already exist on Moment Detail (Slice C).
- Clarify “in this scene” vs “on stage at this moment” labeling (scratch pain point).

---

## Recommendation

Natural follow-on after packs/call-sheet derivation helpers exist (reuse APIs). Prioritize clear **on-stage vs in-scene** copy to avoid lying chips.
