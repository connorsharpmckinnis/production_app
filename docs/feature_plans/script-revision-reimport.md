# Feature plan — Script revision / re-import loop

**Status:** Roadmap (curiosity / far-field shape OK to change; approved as eventual candidate)  
**Created:** 2026-07-29  
**Related:** [IMPORT_SPEC.md](../IMPORT_SPEC.md), [PHASE_9.md](../PHASE_9.md), [STP_PRODUCT_OVERVIEW.md](../STP_PRODUCT_OVERVIEW.md) idea #6, [PRE_AUGUST_STP_PREP.md](../PRE_AUGUST_STP_PREP.md) park/design-notes

---

## Goal

Allow a **writer revision mid-process** without destroying Timeline prep: re-import an updated script and **merge** sacred text changes while preserving production layers (casting, events, notes, E/E) where Moments still match.

**Honest August line:** not fully there yet; design carefully before promising.

---

## Problem

Import today is effectively a beginning-of-life operation. Real STP shows revise acts after prep starts. Blind re-import risks wiping or orphaning layered data. Avoiding re-import forces painful manual Timeline edits for writer changes.

---

## Proposed direction (not committed algorithm)

1. Re-import produces a **candidate Timeline**.
2. Diff against existing Moments (stable IDs? fingerprint by act/scene/order/text?).
3. Classify: unchanged / text-updated / inserted / deleted / moved.
4. Apply text updates to sacred fields; keep production layers on matched IDs.
5. Surface a **review UI** for conflicts (deleted Moment with notes, etc.).

---

## Open questions

- Stable Moment identity across exports (writers don’t have our UUIDs).
- Who may re-import (Admin only today — keep?).
- Songs/lyric blocks and singer attribution survival.

**Recommendation:** design-notes + spike on one revised STP export before any phase commit.

---

## Explicitly out of scope until designed

- Silent auto-merge with no review UI
- Bidirectional export that Round-trips Google Docs perfectly

---

## Done when

Directors can apply a writer revision with a reviewable diff and no unexplained data loss on matched content.
