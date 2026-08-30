# Feature plans

Proposals and **approved roadmap** decision docs for features that are **not yet** committed as a `PHASE_*.md` execution plan.

Use this folder when:

- An idea needs shaping (options, open questions, scope) before build authorization
- Work is adjacent to a shipped phase but not large enough (or decided enough) for a full phase doc yet
- You want a durable place for “we will build this eventually” that is stronger than a GitHub Enhancement issue or a scratch one-liner

**Lifecycle**

1. Draft a plan here (`docs/feature_plans/<slug>.md`)
2. Resolve open questions with the owner
3. Either promote to a `docs/PHASE_*.md` work package list, fold into an existing phase, or park / decline
4. When the authorized slice **ships**, move the file to [shipped_features/](../shipped_features/README.md) and leave a one-line pointer here if useful

**Status vocabulary**

| Status | Meaning |
| ------ | ------- |
| **Proposal** | Shaped idea; not yet treated as committed roadmap |
| **Active implementation** | Authorized work is in progress; hardening or closeout remains |
| **Roadmap (approved intent)** | Owner intends to build eventually; not scheduled/phased yet |
| **Roadmap (curiosity / far-field)** | Captured for thoughtful prioritization; shape may change; still stronger than a random Enhancement |
| **Far-future (v2+)** | Valid idea; explicitly deferred past first real show/season (or equivalent). Do not phase or prioritize against near work |
| **Parked / declined** | Explicitly not pursuing (say why) |
| **Promoted** | Superseded by a `PHASE_*.md` (link it) |
| **Shipped** | File belongs in [shipped_features/](../shipped_features/README.md) |

These are **not** more authoritative than [PROJECT.md](../PROJECT.md), [DATABASE.md](../DATABASE.md), or active phase docs when they conflict — but they **are** the preferred place for upcoming feature intent beyond scratch notes.

When implementing, agents should read the matching plan here for goals, non-goals, and open questions before coding.

---

## Current proposals

| Plan | Status | One-liner |
| ---- | ------ | --------- |
| [production-membership-and-casting-workspace.md](production-membership-and-casting-workspace.md) | Active implementation | Explicit production roster, production-scoped roles, pre-casting membership, and contact/casting workspace; downstream hardening remains |
| [casting-and-auditions.md](casting-and-auditions.md) | Proposal | Casting workspace, private audition notes, per-person unavailable dates, and rehearsal conflict awareness |

## Approved roadmap (near / mid)

| Plan | Status | One-liner |
| ---- | ------ | --------- |
| [rehearsal-management.md](rehearsal-management.md) | Shipped (Phases 15–18) | Reserved slots, call planner, soft-publish call sheets, notes, times rehearsed |
| [print-and-call-sheets.md](print-and-call-sheets.md) | Roadmap | Plan-driven call sheet (Phase 17) + optional scene-select Reports shortcut |
| [org-catalog-and-shop.md](org-catalog-and-shop.md) | Roadmap | Theater-wide catalog + CSV; check out / copy assets into a show |
| [tech-week-chart-suite.md](tech-week-chart-suite.md) | Roadmap | Visual burn-down, break-time, set-change (+ lav change-list later) |
| [character-onstage-chart.md](character-onstage-chart.md) | Prototype shipped | Reports Gantt of who is on stage, from entrance/exit records |
| [soft-pilot-ops.md](soft-pilot-ops.md) | Roadmap | Pilot runbook, What’s new, support loop for one-show soft pilots |
| [director-house-notes.md](director-house-notes.md) | Roadmap | Mobile house mode, dictation, optional follow-along assist |
| [show-archives.md](show-archives.md) | Roadmap | Archive past shows as institutional memory |
| [crew-roles.md](crew-roles.md) | Roadmap | Stage Manager / crew-shaped access beyond Admin·Director·Actor |

## Earlier proposals (comms)

| Plan | Status | One-liner |
| ---- | ------ | --------- |
| [tasks-and-mentions.md](tasks-and-mentions.md) | Proposal | Basic production Tasks + @-mentions → notifications |
| [email-notifications.md](email-notifications.md) | Proposal | Templated outbound email (blasts, later mentions/digest) |

## Far-future (v2+ / post first season)

| Plan | Status | One-liner |
| ---- | ------ | --------- |
| [character-nightly-packs.md](character-nightly-packs.md) | Far-future | Actor prep pack: character + scene(s) → lines, E/E, costumes/props/sets — revisit after real-show use |
| [script-rights-and-reference-mode.md](script-rights-and-reference-mode.md) | Far-future | Rights metadata plus script-less reference-only productions |

## Curiosity / far-field

| Plan | Status | One-liner |
| ---- | ------ | --------- |
| [script-revision-reimport.md](script-revision-reimport.md) | Curiosity | Writer revision merge / re-import without wiping prep |
| [scene-summary-drill-down.md](scene-summary-drill-down.md) | Curiosity | Scene chips → per-character/asset modal detail |
| [lav-follow-ons.md](lav-follow-ons.md) | Curiosity | Lav Timeline events, change-list, handhelds, CSV |
| [understudies-and-cast-overrides.md](understudies-and-cast-overrides.md) | Curiosity | Understudies + effective cast for packs/Rehearse |
| [costume-pieces-and-outfits.md](costume-pieces-and-outfits.md) | Curiosity | Piece-level wardrobe beyond whole-costume on/off |
| [rehearse-depth.md](rehearse-depth.md) | Curiosity | Deeper actor practice modes / mobile Rehearse |
| [prep-progress-intentionally-blank.md](prep-progress-intentionally-blank.md) | Curiosity | Reviewed / intentionally blank prep marks |
| [production-home-and-modes.md](production-home-and-modes.md) | Curiosity | Production landing + saved views / modes |
| [bookmarks-redesign.md](bookmarks-redesign.md) | Curiosity | Dedicated bookmarks timeline-like UX |
| [stage-diagram-blocking.md](stage-diagram-blocking.md) | Curiosity | Lightweight zone tap-to-block (not Stage Write) |
| [scheduling-and-attendance.md](scheduling-and-attendance.md) | Parked / superseded | See [rehearsal-management.md](rehearsal-management.md) |
| [ai-assisted-querying.md](ai-assisted-querying.md) | Curiosity | NL query over Timeline data; very low priority |

## Already shipped

See [shipped_features/](../shipped_features/README.md): in-play deep links (including costumes), lav assignment UX, announcements prototype.

UX backlog items shipped 2026-08-13 (no standalone plan): Timeline + Rehearse **live search**; Timeline **multi-select character filter**.
