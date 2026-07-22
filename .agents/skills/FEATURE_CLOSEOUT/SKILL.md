---
name: feature-closeout
description: >-
  Sync planning and status docs after shipping work: update phase docs, scratch
  notes, UX backlog, README, and related status so finished items are not
  rediscovered. Use after completing a feature, polish pass, phase work package,
  or when the user asks to acknowledge changes in scratch notes / mark phase
  complete.
---

# Feature Closeout

After meaningful work lands, update the human-facing status trail so the owner does not re-fix finished items.

## When to run

Run at the end of:

* A phase work package or phase completion
* A scratch-notes polish pass
* A UX/UI backlog batch
* Any change that alters "what's done" vs "what's next"

Skip for tiny one-line fixes with no doc footprint, unless the owner asks.

## Closeout checklist

Copy and complete:

```text
Closeout:
- [ ] Code matches the authorized scope (no silent extras)
- [ ] Tests / manual checks for the touched workflow
- [ ] Relevant phase doc status updated
- [ ] Scratch notes acknowledged (fixed / deferred / wish)
- [ ] UX backlog or wish list updated if items moved
- [ ] README / deploy / seed docs updated if operator steps changed
- [ ] Open follow-ups listed for the owner
```

## What to update (pick the ones that apply)

| Doc | Update when |
| --- | --- |
| `docs/PHASE_*.md` | Work package or phase status changed |
| `docs/SCRATCH_NOTES.md` | Owner notes were fixed, deferred, or clarified |
| `docs/UX_UI_IMPROVEMENTS.md` | Backlog items shipped or re-tiered |
| `docs/PROJECT.md` | Wish list / roadmap intent changed |
| `docs/DATABASE.md` | Schema or naming decisions changed |
| `docs/UI_STANDARDS.md` | Interaction standards became normative |
| `README.md` / `docs/DEPLOY.md` | Setup, ports, or operator steps changed |
| `docs/DEMO_WALKTHROUGH.md` | Demo path changed |

## Scratch notes protocol

Owner uses scratch notes as a personal memory aid. When addressing items:

1. Mark fixed items clearly (strike-through + **Fixed YYYY-MM-DD** is the existing style).
2. If too large for a quick fix, move or point to wish list / phase backlog instead of leaving it silently untouched.
3. Do not delete unresolved ideas unless the owner asks; acknowledge and relocate them.

Owner signal from past work: update scratch notes with acknowledgement of changes so they don't try to re-fix when they forget.

## Completion message

Keep the wrap-up short:

* What shipped
* Docs updated
* Anything deferred / still needs a decision
* Suggested next step (one sentence) only if useful

Do not commit unless explicitly asked.
