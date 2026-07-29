# Feature plans

Proposals and decision docs for features that are **not yet** committed as a `PHASE_*.md` execution plan.

Use this folder when:

- An idea needs shaping (options, open questions, scope) before build authorization
- Work is adjacent to a shipped phase but not large enough (or decided enough) for a full phase doc yet
- You want a durable place for “we could do X” without mixing it into scratch notes

**Lifecycle**

1. Draft a plan here (`docs/feature_plans/<slug>.md`)
2. Resolve open questions with the owner
3. Either promote to a `docs/PHASE_*.md` work package list, fold into an existing phase, or park / decline
4. Update status in the plan header when outcome is known

These are **not** authoritative product vision. Prefer [PROJECT.md](../PROJECT.md), [DATABASE.md](../DATABASE.md), and active phase docs when they conflict.

## Current proposals

| Plan | Status | One-liner |
| ---- | ------ | --------- |
| [app-announcements.md](app-announcements.md) | Proposal | In-app announcements, banners/modals, bell inbox |
| [tasks-and-mentions.md](tasks-and-mentions.md) | Proposal | Basic production Tasks + @-mentions → notifications |
| [email-notifications.md](email-notifications.md) | Proposal | Templated outbound email (blasts, later mentions/digest) |
| [in-play-moment-deep-links.md](in-play-moment-deep-links.md) | Proposal | Jump from in-play assets to source Timeline Moments |
