# Performance & Optimization Notes

**Purpose:** Ongoing inventory of latency, query-cost, and caching ideas. Not committed scope — capture findings so we do not rediscover them when free-tier or Cloud Run hosting makes roundtrips more expensive.

**Last updated:** 2026-09-05

**Related docs:** [DEPLOY.md](DEPLOY.md) (Neon / Cloud Run), [PREP_READINESS.md](shipped_features/PREP_READINESS.md) (how readiness is computed), [UX_UI_IMPROVEMENTS.md](UX_UI_IMPROVEMENTS.md) (UI polish backlog)

---

## How to use this list

| Status | Meaning |
| ------ | ------- |
| **Open** | Observed or suspected; not scheduled |
| **Watch** | Acceptable for now; revisit if hosting/cost/latency worsens |
| **Done** | Shipped or invalidated — leave a short note |

When adding an item: note the **surface** (page/endpoint), **symptom**, **likely cause**, and **ideas** (not a full design). Prefer smallest fixes when something is eventually pulled into a phase.

---

## Context (2026-09-05)

With **Neon** as the database and the API still on localhost, Production Overview felt like ~1s of skeletons before data appeared. A WebKit timeline recording showed:

- Transfer sizes are tiny (overview JSON ~9 KB) — time is almost all **server wait / TTFB**.
- `GET /api/productions/{id}/overview` dominated (~2.4–2.7s TTFB in that capture).
- In **Vite + React Strict Mode (dev only)**, `/overview`, `/people`, and announcements each fired **twice**. A production frontend build does not double-invoke those effects; expect roughly half the DB work for that page in prod builds.
- No frontend N+1 (no per-scene / per-character HTTP storm). Cost is concentrated in one fat overview request.

Conclusion for now: free-tier Neon latency is expected; no emergency. Keep the items below for when we want snappier Overview or lower Neon compute.

---

## Open / watch

### W1 — `compute_readiness` / `GET …/overview` (Watch)

| | |
| --- | --- |
| **Surface** | Production Overview · `GET /api/productions/{production_id}/overview` · `backend/app/services/readiness.py` (`compute_readiness`) · spotlight helpers in overview path |
| **Symptom** | ~1s+ skeleton with remote Postgres; multi-second TTFB under load or cold paths |
| **Cause** | Readiness is **derived on each request** (not stored). The handler fans out **many sequential SQL roundtrips** (counts, scene coverage for cues/props/lav/sets, casting, costumes, entrances/exits/blocking, plus spotlight queries). Local Docker hid the cost; Neon multiplies per-query RTT. |
| **Ideas (later)** | |
| | **A. Fewer roundtrips** — Combine related counts/coverage queries; avoid repeating work already done inside the same request (e.g. cast-id sets computed more than once across overview + readiness). |
| | **B. Split the payload** — Serve a lighter Overview shell first (title, counts, spotlight), load readiness dimensions in a second request or deferred section so the page isn’t blocked on the full readiness fan-out. |
| | **C. Short-lived server cache** — Cache readiness (or full overview JSON) per `production_id` for a short TTL, invalidate on prep mutations (cast, cues, props, etc.). |
| | **D. Skip unused work** — Actor-only responses currently still compute full readiness then strip dimensions; short-circuit when the client won’t see them. |
| **Notes** | Behavior of scores stays documented in [PREP_READINESS.md](shipped_features/PREP_READINESS.md). Any cache must not claim stale “reviewed” progress — readiness remains a heuristic snapshot. |

### W2 — Browser reuse of Overview / readiness (Open)

| | |
| --- | --- |
| **Surface** | `ProductionOverviewPage` · shell fetches · no React Query / SWR today |
| **Symptom** | Re-visiting Overview (or remounting) always refetch; periodic “is prep still the same?” updates always hit the network |
| **Cause** | Custom `useEffect` + `api.*` with local state only; no shared client cache across navigations |
| **Ideas (later)** | |
| | **A. Client cache** — Cache last successful `/overview` (and maybe `/people`) per production in memory (or sessionStorage) with a short TTL; show cached data immediately, refresh in background. |
| | **B. Data library** — Introduce React Query (or similar) for stale-while-revalidate on Overview and other production-scoped GETs. |
| | **C. Abort duplicate in-flight** — Even in prod, abort controllers on unmount avoid wasted Neon work if the user navigates away mid-request (also cleans up Strict Mode double-fetch in local Neon testing). |
| **Notes** | Prefer keeping Overview “fresh enough” for prep work without implying live collaboration. TTL and invalidation rules should stay simple. |

---

## Intentionally deferred / not bugs

- **Strict Mode double-fetch in local Vite** — Dev-only; do not remove Strict Mode just for Neon. Prod builds are the right baseline for “is Overview fast enough?”
- **~0.5s lighter endpoints** (people, inbox, announcements) against free Neon — Acceptable until Cloud Run + Neon stacking makes them feel worse; then profile cold starts vs query time separately.

---

## Changelog

| Date | Note |
| ---- | ---- |
| 2026-09-05 | Doc created from Neon + Overview timeline recording sanity check (compute_readiness / overview size / client reuse). |
