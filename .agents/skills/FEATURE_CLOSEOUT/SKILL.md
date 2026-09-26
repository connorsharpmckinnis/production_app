---
name: feature-closeout
description: >-
  Sync planning and status docs after shipping work: update phase docs, feature
  plans, UX archive notes, README, and related status so finished items are not
  rediscovered. Use after completing a feature, polish pass, phase work package,
  or when the user asks to acknowledge shipped work / mark phase complete.
---

# Feature Closeout

After meaningful work lands, update the human-facing status trail so the owner does not re-fix finished work.

## When to run

Run at the end of:

* A phase work package or phase completion
* A UX/UI polish pass
* Any change that alters "what's done" vs "what's next"

Skip for tiny one-line fixes with no doc footprint, unless the owner asks.

## Closeout checklist

```text
Closeout:
- [ ] Code matches the authorized scope (no silent extras)
- [ ] Tests / manual checks for the touched workflow
- [ ] Relevant phase doc / feature plan status updated
- [ ] GitHub Issues closed or commented if this resolved tracked work
- [ ] UX archive or wish list updated only if status actually changed
- [ ] README / deploy / seed docs updated if operator steps changed
- [ ] Open follow-ups listed for the owner (prefer Issues over new scratch prose)
```

## What to update (pick the ones that apply)

| Doc | Update when |
| --- | --- |
| `docs/PHASE_*.md` / `docs/shipped_features/phases/` | Work package or phase status changed |
| Matching `docs/feature_plans/*.md` | Plan status, deferred leftovers, or ship notes |
| `docs/feature_plans/README.md` | Index status / which bucket a plan sits in |
| GitHub Issues / milestones | Actionable open work (preferred over in-repo scratch) |
| `docs/UX_UI_IMPROVEMENTS.md` | Only if correcting historical archive status |
| `docs/PROJECT.md` | Wish list / roadmap intent changed |
| `docs/DATABASE.md` | Schema or naming decisions changed |
| `docs/UI_STANDARDS.md` | Interaction standards became normative |
| `README.md` / `docs/DEPLOY.md` | Setup, ports, or operator steps changed |
| `docs/DEMO_WALKTHROUGH.md` | Demo path changed |

## Issue / follow-up protocol

Owner tracks actionable polish and bugs in **GitHub Issues**. When shipping:

1. Close or comment on matching Issues when the work lands.
2. If leftover scope appears, file or update an Issue (or a short deferred note on the feature plan) — do not invent a new scratch file.
3. Larger shaped ideas still get a feature plan when a ticket is not enough.

## Completion message

Keep the wrap-up short:

* What shipped
* Docs / Issues updated
* Anything deferred / still needs a decision
* Suggested next step (one sentence) only if useful

Do not commit unless explicitly asked.
