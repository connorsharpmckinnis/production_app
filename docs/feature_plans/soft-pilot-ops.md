# Feature plan — Soft pilot ops

**Status:** Roadmap (approved intent — build eventually; not yet phased)  
**Created:** 2026-07-29  
**Related:** [PRE_AUGUST_STP_PREP.md](../PRE_AUGUST_STP_PREP.md) soft pilot packaging, [STP_PRODUCT_OVERVIEW.md](../STP_PRODUCT_OVERVIEW.md) Phase A/B/C, [DEPLOY.md](../DEPLOY.md), in-app feedback (shipped), [app-announcements.md](../shipped_features/app-announcements.md), [crew-roles.md](crew-roles.md)

---

## Goal

Make a **one-show soft pilot** operationally boring: clear roles, access, feedback loop, changelog, support expectations, and success criteria — so STP can try the app without you improvising process mid-week.

This is partly **product** (lightweight features) and partly **runbook** (docs you hand people). Both belong here because “pilot packaging” fails if either side is missing.

**Primary motivating UX:** You start a pilot with a one-pager: who is Admin, who is Director, which actors get accounts, how to report bugs, what you promise to fix within 7 days, and what is explicitly out of scope.

**Secondary motivating UX:** Pilots see a simple **What’s new** changelog in-app after you deploy fixes mid-pilot.

**Tertiary motivating UX:** Feedback already filed via in-app GitHub issues stays the intake; pilot ops defines **triage SLA** and labels.

---

## Problem

Pre-August doc still has open checkboxes: pilot ask, account roles, feedback loop promises, overview language refresh. In-app feedback shipped; **changelogging and packaging** did not. Without this, a soft pilot feels like a private beta with no contract — risky for trust.

---

## Deliverables (roadmap)

### A. Pilot runbook (docs — ship first)

A durable doc (or section in STP overview) that states:

| Topic | Content |
| ----- | ------- |
| **Scope** | One production; prep + Rehearse + agreed sheets |
| **Accounts** | Named Admin(s), Director(s), Actor cohort size |
| **Access** | Tailscale / URL / password reset path |
| **Feedback** | In-app feedback → GitHub; what to include (steps, screenshot) |
| **Response promise** | e.g. acknowledge in 48h; safety/import bugs prioritized same week |
| **Non-goals** | No live calling, no Planning Center replacement, no Stage Write clone |
| **Success criteria** | Matches STP overview Phase B bar |
| **End decision** | Phase C: yes / no / not yet after N weeks |

### B. Lightweight product bits

| Bit | Purpose |
| --- | --- |
| **Changelog / What’s new** | After deploy, users see recent pilot-relevant notes (markdown list or simple table). Admin-editable or repo-driven. |
| **Pilot badge (optional)** | Soft banner on production: “Soft pilot — expect rough edges; send feedback.” Reuse announcements system when built. |
| **About / support links** | GitHub repo + “open an issue” already desired in Pre-August P2 |
| **Role cheat sheet** | In-app or PDF: Admin vs Director vs Actor in plain language |

### C. Meeting / kickoff artifacts

- 15–20 min walkthrough script (Pre-August meeting prep)
- One-pager pilot proposal
- Question list for STP (already sketched in Pre-August)

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Feedback | User menu → Send feedback → GitHub Issues |
| Deploy | Docker + Tailscale ([DEPLOY.md](../DEPLOY.md)) |
| Roles | Admin / Director / Actor only |
| Changelog | None in-app |
| Announcements | Proposal only |
| Overview | Prep readiness; not pilot status |

---

## Explicitly out of scope

- Multi-org commercial onboarding
- Formal SLA / paid support
- Automated telemetry dashboards for pilot health
- Replacing email/Slack for cast communication ([email-notifications.md](email-notifications.md) later)

---

## Open questions

1. **Changelog source** — hand-edited in Admin Settings vs `CHANGELOG.md` shipped in image?  
   **Recommendation:** Admin-editable short “What’s new” text first (fast mid-pilot); structured file later.
2. **Pilot production flag** — boolean on production vs announcement only?  
   **Recommendation:** announcement/banner first; DB flag only if you need reporting.
3. **Who gets Actor accounts in first pilot?** Whole cast vs volunteer subset?  
   **Recommendation:** decide per show with STP; runbook should force an explicit number.

---

## Done when

- A pilot runbook exists and matches what you say in the August room.
- There’s a clear feedback → triage → deploy → “what’s new” loop you can run alone.
- STP overview Phase A/B/C language matches the runbook.
- You can start a one-show pilot without inventing process on day one.

---

## Suggested sequence

1. Write runbook + refresh STP overview language (docs only).
2. About links + support pointers.
3. In-app What’s new (minimal).
4. Optional pilot banner via announcements when that feature lands.
5. After first pilot: fold lessons into runbook v2.

---

## Risks / tradeoffs

- Over-building ops product instead of talking to humans — **docs first**.
- Promising fix SLAs you can’t meet solo — keep promises small and written.
- Changelog noise — pilot-relevant notes only, not every commit.
