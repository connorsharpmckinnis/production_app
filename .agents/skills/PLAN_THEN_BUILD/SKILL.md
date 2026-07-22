---
name: plan-then-build
description: >-
  Two-phase workflow: produce a concrete plan, audit, phase doc, or
  recommendation first; implement only after explicit owner authorization. Use
  when the user asks to plan, design, write a PHASE_*.md, audit, recommend next
  steps, compare approaches, or says plan first / don't implement yet.
---

# Plan Then Build

Default for consequential work: plan first, build only when authorized.

## Detect the mode

| Owner language | Mode |
| --- | --- |
| "write a PHASE_*.md", "put together a plan", "what should I do next", "audit", "recommend", "compare options" | **Plan only** |
| "implement", "build", "take over implementation", "go ahead and build", "AS WELL AS" with explicit feature asks | **Build** (still ask open questions first) |
| Plan request with no build language | Stay in **Plan only** even if implementing would be easy |

When unsure, stay in Plan only and ask which mode they want.

## Plan-only workflow

1. Read the DEVELOPMENT_GUIDE skill and the authoritative docs it lists.
2. Inspect the current codebase enough to ground the plan in reality.
3. Ask clarifying questions for anything that still needs deciding.
4. Produce a concrete plan the owner can approve or edit.
5. Stop. Do not start implementation, migrations, or refactors.

### Plan output shape

```markdown
## Goal
<one paragraph>

## Open questions
- Q1 — recommendation: …
- Q2 — recommendation: …

## Proposed work packages
### WP0 — …
- Scope
- Files / systems touched
- Done when

### WP1 — …
…

## Explicitly out of scope
- …

## Risks / tradeoffs
- …

## Suggested sequence
1. …
```

For phase documents, match existing `docs/PHASE_*.md` structure and tone rather than inventing a new template.

## Build workflow (after authorization)

1. Re-read the approved plan / phase doc.
2. Ask any remaining clarification or decision questions before coding.
3. Implement the authorized scope only.
4. Prefer the smallest complete vertical slice over infrastructure-first work.
5. Run the FEATURE_CLOSEOUT skill when the package or phase slice is done.

## Anti-patterns

* Implementing during a planning request "to save time"
* Expanding WP scope mid-build without asking
* Treating test-green as done when the owner expects a real workflow / fixture / walkthrough check
* Future-proofing architecture before MVP validation
