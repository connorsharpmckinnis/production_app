# Feature plan — Analytics events

**Status:** Roadmap (in progress — suggestion accept/dismiss spine shipping with suggestion-engine v1)  
**Created:** 2026-11-11  
**Related:** [suggestion-engine.md](suggestion-engine.md), [DATABASE.md](../DATABASE.md) (Audit Logs / FUTURE TABLES), Issue #46 (rich reports / analytics wish), announcements CTA analytics (deferred)

---

## Goal

Own a **simple, append-only product event log** in Postgres so we can measure whether features help (starting with suggestion accept vs dismiss) without locking into a vendor or a one-off metrics table per feature. Broader app / enterprise analytics grow by emitting more `event_name`s into the same spine.

---

## Posture

- **Append-only** — never update/delete event rows for “corrections”; emit a new event if needed.
- **Domain events, not page pixels** — prefer meaningful actions (`suggestion.accepted`) over high-volume impressions unless a funnel truly needs them.
- **Flexible properties** — stable `event_name` + JSON `properties`; avoid a migration per new metric.
- **Same DB transaction as the mutation** when practical (one Neon round-trip with the write).
- **No third-party SDK required** for MVP; a later sink (PostHog, BigQuery, Cloud Logging) can mirror the same rows/logs.
- Humans still decide; analytics inform product, they do not auto-change Timeline data.

---

## Product model (v1)

### Table: `analytics_events`

| Column | Notes |
| ------ | ----- |
| `id` | PK |
| `created_at` | server default now |
| `organization_id` | nullable FK (CASCADE with org when set) |
| `production_id` | nullable FK (CASCADE with production when set) |
| `actor_user_id` | nullable FK SET NULL on user delete |
| `event_name` | indexed string, e.g. `suggestion.accepted` |
| `properties` | JSON object (default `{}`) |

Helper: `record_event(db, *, event_name, user=None, production=None, organization_id=None, properties=None)` — adds a row; **does not commit**.

### Suggestion instrumentation (ships with this slice)

| Event | When | Key properties |
| ----- | ---- | -------------- |
| `suggestion.accepted` | Accept succeeds (including “already present”) | `rule_id`, `fingerprint`, `scene_id`, `anchor_moment_id`, `speaking_moment_id`, `subject_kind`, `subject_id`, `action_kind`, `attachment_id` (if created), `already_present` |
| `suggestion.dismissed` | Explicit Dismiss | same identity fields; no attachment |

`suggestion_dismissals` remains the **UI suppress list** only (Accept still writes a dismissal so the nudge disappears). **Outcomes for metrics live in `analytics_events`.**

### Retrieval API (v1)

Production-scoped, Timeline editors + App Admin:

- `GET /api/productions/{id}/analytics/suggestions/summary` — counts accepted / dismissed / total by `rule_id` (and overall)
- `GET /api/productions/{id}/analytics/events?event_name_prefix=suggestion.&limit=100` — recent raw events for inspection

No charts UI in this slice.

---

## Broader objectives (later branch)

1. **Feature usefulness** — accept/dismiss (and later ignore rates) for rules, Propose lav, rehearsal suggest-calls, Overview gap CTAs once migrated onto the suggestion spine.
2. **Adoption / engagement** — which roles use Timeline prep, Rehearse, Reports, call sheets; last-active style signals if we add login/`last_seen` events.
3. **Operational health** — slow paths, import outcomes, failed accepts (structured logs may complement the table).
4. **Trust / compliance** — rights-sensitive script changes, membership changes, Admin act-as (aligns with parked Audit Logs and script-rights plan).
5. **Exportable truth** — org can dump or warehouse events without relying on a SaaS black box.

---

## Next actions to instrument (wishlist)

Prioritized for a follow-on branch; emit into the **same** table.

| Area | Candidate `event_name`s | Why |
| ---- | ----------------------- | --- |
| Suggestions (next) | `suggestion.impression` (sampled or on Detail open only) | Funnel shown→acted; keep volume low |
| Rehearsal capture | `attachment.suggested_created`, `attachment.approved`, `attachment.deleted` | Human suggest→official usefulness |
| Lav chart | `lav.propose_applied`, `lav.cell_edited`, `lav.row_locked` | Heuristic vs manual TD work |
| Rehearsal planner | `rehearsal.suggest_calls_applied`, `rehearsal.plan_saved`, `rehearsal.published` | Call-list automation quality |
| Readiness / Overview | `readiness.gap_clicked` (CTA) | Which gaps drive action |
| Script import | `import.completed`, `import.failed` (+ profile id, counts) | Pipeline reliability |
| Auth | `auth.login`, `auth.act_as_start`, `auth.act_as_stop` | Access + impersonation audit |
| Announcements | `announcement.cta_clicked`, `announcement.dismissed` | Was deferred; fits this spine |
| Reports / print | `report.viewed`, `call_sheet.printed` | Booth workflow adoption |
| Catalog | `catalog.item_created`, `catalog.csv_imported` | Prep velocity |

**Not first:** client pageview beacons, session replay, cross-production BI dashboards (Issue #46 territory).

---

## Non-goals (this slice)

- Admin charts / dashboards UI
- PostHog / Segment / Mixpanel
- Impression spam on every Timeline poll
- Rewriting readiness scores into stored time series
- Using analytics to auto-apply suggestions

---

## Work packages

### WP0 — Owner accepts defaults (done 2026-11-11)

Events spine + suggestion accept/dismiss + retrieve API; impressions deferred; Admin/Director-readable via production Timeline edit capabilities.

### WP1 — Schema + `record_event` + suggestion wiring + summary/list API

**Status:** Done (2026-11-11)

**Done when:** accepts and dismisses appear as distinct events; summary endpoint returns counts by rule; pytest covers record + summary.

### WP2 — (later branch) Broader instrumentation pass

Pick 2–3 rows from the wishlist table; document event_name conventions in this file’s decision log.

---

## Event naming convention

- `domain.action` in `snake` segments: `suggestion.accepted`, `auth.login`
- Properties: snake_case keys; ids as integers; no PII beyond what the app already stores (prefer ids + display names only when needed for debugging)
- Prefer reusing the same names forever; add properties rather than renaming events

---

## Decision log

| Date | Decision |
| ---- | -------- |
| 2026-11-11 | General `analytics_events` over suggestion-only outcome table |
| 2026-11-11 | Track `suggestion.accepted` / `suggestion.dismissed` only for v1; skip impressions |
| 2026-11-11 | Keep `suggestion_dismissals` as suppress list; analytics is source of truth for outcomes |
| 2026-11-11 | Retrieve via API first; no charts UI; expand broader tracking in a later branch |
