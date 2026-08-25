---
name: ai-collaboration
description: >-
  Collaboration defaults for working with the project owner: ask clarifying
  questions before assuming, gate material decisions, present tradeoffs, keep
  scope small, and sync documentation. Use at the start of non-trivial tasks,
  when requirements are ambiguous, when choosing between approaches, or whenever
  the user says ask before assuming / clarifying / deciding.
---

# AI Collaboration

How to work with this project's owner. Read this for any non-trivial task.

Also enforced project-wide by `.cursor/rules/ai-collaboration.mdc`.

## Core directive (verbatim)

Ask any questions that still need deciding or clarifying before assuming.

Related owner phrasing from past work:

* "Ask me any questions that you need answering, rather than assuming what I want to build if I didn't make the document clear enough."
* "Ask questions for anything that you need clarification or decisions on."
* "Ask me any questions you need to be certain we're working on the right stuff and in the right direction."
* "Do the smallest, simplest tweak that fully accomplishes the goal."

## Decision gate

Before implementing, scan for open decisions. Ask when any of these are unclear:

| Area | Examples |
| --- | --- |
| Product intent | What the feature is for; who uses it; what "done" means |
| UX / interaction | Navigation, defaults, mobile behavior, click targets, clutter tradeoffs |
| Data model | New tables/columns, derived vs stored, naming, migrations |
| Permissions | Who can see/edit; actor vs director vs admin |
| Import / script rules | Ambiguous parse behavior; failure policy; format changes |
| Security / deploy | Auth, secrets, remote config, hosting choices |
| Scope | MVP now vs wishlist later; polish vs architecture |

Do **not** invent business rules, theater workflows, or schema meaning to fill gaps.

### Proceed without asking when

* The request + authoritative docs already specify the behavior
* The change follows an established local pattern
* It is a clear bugfix with an obvious correct behavior
* The user already answered the decision in this conversation

### How to ask

* Batch questions once; do not drip them one message at a time when avoidable
* Make each question concrete and answerable (options help when useful)
* State your default recommendation per question so the owner can accept quickly
* Wait for answers on material decisions before writing code

## Scope discipline

1. Solve the requested problem completely with the smallest change.
2. Reuse existing components, APIs, and docs conventions.
3. If a better-but-larger idea appears, record it (scratch notes, wish list, phase backlog) instead of building it now.
4. Do not turn polish requests into architecture rewrites unless asked.

## Tradeoff format

When recommending among options:

```markdown
**Recommendation:** <one sentence>

**Why this fits now:** <project stage, effort, risk, maintainability>

**Alternatives:**
- A — pros / cons
- B — pros / cons

**Deferring:** <what we are not doing yet>
```

Prefer maintainability, readability, and low operational burden over elegant or enterprise-grade complexity the owner cannot operate alone.

## Communication

* Be direct and concise; lead with the answer or recommendation
* Explain significant design decisions in plain language a non-technical theater collaborator could follow when the topic is operational or user-facing
* After significant coding work: what changed, why, tradeoffs, and any follow-ups
* Do not pad with process narration ("I will now…", "Next I should…")

## Authorization boundaries

Require explicit owner authorization for:

* git commit / push
* deploys and remote system changes (DB, cloud, CI, DNS, SaaS config)
* overwriting planning docs the owner is actively editing (unless asked)
* expanding into adjacent domains outside the theater production workflow
* adding, removing, or upgrading Python packages via uv (`uv add` / `uv remove` / dependency bumps)

## Ask for tooling help (do not thrash)

When a tool fails for auth, permissions, or environment reasons — especially `gh` (issues, PRs, checks), GitHub access, or similar CLI auth — stop and ask the owner. Say what you need and why. The owner can run it, approve a specific command, or fix auth. Do not burn turns inventing workarounds or retrying the same blocked path.

## Related skills

* [PLAN_THEN_BUILD](../PLAN_THEN_BUILD/SKILL.md) — plan/audit requests stay read-only until build is authorized
* [FEATURE_CLOSEOUT](../FEATURE_CLOSEOUT/SKILL.md) — sync phase docs, scratch notes, and status after work
* [DEVELOPMENT_GUIDE](../DEVELOPMENT_GUIDE/SKILL.md) — product, code, and stack standards
