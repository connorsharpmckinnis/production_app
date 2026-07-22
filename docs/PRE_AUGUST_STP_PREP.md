# Pre-August STP Meeting — What to Build & Prepare

**Created:** 2026-07-21  
**Horizon:** Soft meeting window — later August (Emmy + Pam + others)  
**Audience:** Connor (builder)  
**Status:** Working plan — not a commitment to STP

---

## Why this document exists

Emmy’s reply confirmed interest: she sees this as a real alternative to a **Stage Write** subscription she was already considering, and she’s excited about a **free pilot + support + customization** for STP. The group walkthrough is likely **later August**.

This doc answers: *What should I spend the next ~4–6 weeks on so that meeting goes well — and so a soft pilot afterward is credible?*

It consolidates open work from:

- [SCRATCH_NOTES.md](SCRATCH_NOTES.md)
- [UX_UI_IMPROVEMENTS.md](UX_UI_IMPROVEMENTS.md)
- [PROJECT.md](PROJECT.md) Wish List
- [STP_PRODUCT_OVERVIEW.md](STP_PRODUCT_OVERVIEW.md)
- [SECURITY_REVIEW.md](SECURITY_REVIEW.md)
- [PHASE_9.md](PHASE_9.md)
- [PHASE_10.md](PHASE_10.md)
- In-app [aboutContent.ts](../frontend/src/aboutContent.ts) Future State
- Competitive framing from the theater market landscape research (Stage Write / prep tools vs ops tools)

…and adds priorities shaped by Emmy’s email and STP reality.

---



## Strategic framing (read this first)



### What Emmy signaled


| Signal                                                    | Implication for prep                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Compared us to **Stage Write**                            | Meeting demo should make the *script → Timeline → prep → Rehearse → sheets* story obvious — that’s our lane          |
| Unsure Stage Write was worth it **across multiple shows** | Emphasize remount/reuse: catalogs, archives, org inventory bridge — not “pay per seat forever for one blocking tool” |
| Excited about **pilot + tech support + customization**    | Arrive ready to support a real show; don’t oversell unfinished SaaS                                                  |
| Walkthrough **later August**                              | Build for a strong Phase A meeting (look & talk), not a finished product                                             |




### Stay in our lane

**Build / deepen (Cluster A — prep & staging):**  
Timeline, catalogs, readiness, Rehearse, printable tech sheets, import reliability, pilot-safe deploy.

**Discuss but do not half-build before the meeting:**  
Visual stage diagrams / Stage Write–style spacing charts, live show calling, full PDF call-sheet suites, SM rehearsal-report packets.

**Explicitly out of scope (do not chase):**

- **Planning Center / volunteer management** — STP already has this; do not compete
- Payments, registration, ticketing
- Sensitive medical / allergy PII vaults
- SMS-as-a-product or cast messaging that duplicates their existing comms

Scheduling and attendance sit in a gray zone: useful in theater ops tools, but easy to collide with Planning Center. **Do not build them before the August meeting.** If they come up, position as “maybe later, and only if it complements Planning Center — never replaces it.”

### Success bar for the August meeting

Not “wow, every Stage Write feature.”  
Yes:

1. Demo feels coherent on a **real (or full) script**
2. STP can imagine directors living in Timeline and actors using Rehearse
3. You can propose a **one-show soft pilot** with clear support
4. You have a short list of **STP-shaped next features** to react to — not a 40-item wishlist dump

---



## Priority tiers


| Tier             | Meaning                                                                    | Time budget (rough) |
| ---------------- | -------------------------------------------------------------------------- | ------------------- |
| **P0**           | Must be true before showing STP on a shared host / talking pilot seriously | Do first            |
| **P1**           | High leverage for the walkthrough or an immediate soft pilot               | Next                |
| **P2**           | Strong differentiators or STP conversation starters — build if time        | Stretch             |
| **Meeting prep** | Non-code work that makes August land                                       | Parallel with P0/P1 |
| **Park**         | Good ideas — wrong season                                                  | After pilot signal  |


---



## P0 — Credibility & pilot safety

These are the “don’t embarrass yourself / don’t leak a script” items.

### Security & deploy (from [SECURITY_REVIEW.md](SECURITY_REVIEW.md))

Tracked and sequenced in **[PHASE_10.md](PHASE_10.md)** (Tier A Tailscale on Dev stack + before-beta hardening). **Addressed in Phase 10** — see [DEPLOY.md](DEPLOY.md) for the day-to-day runbook (Dev + Tailscale Serve on 5173; localhost OK without Tailscale).

- [x] **Fix production IDOR** — actors (any auth’d user) must not read another production by guessing an ID. Shared `require_production_access` on every production-scoped route + tests.
- [x] **Prod secrets hygiene** — refuse default `SECRET_KEY` / weak `ADMIN_PASSWORD` when `ENVIRONMENT=prod`; no demo director/actor seeds in prod.
- [x] **Cap script uploads** (size + basic content checks).
- [x] **Login rate limiting** (or nginx equivalent) if the host is network-reachable.
- [x] **One-page deploy notes** for a single-org pilot host (secrets generation, compose prod frontend target, password story). Fix nginx `/api` proxy if using the prod frontend image. Private multi-device access via Tailscale (not public IP:port).
- [x] **Include basic dev-level 'public' accessibility across multiple devices** — documented via Tailscale Serve on 5173; localhost testing OK without Tailscale on secondary machines. Containerized Compose stack remains easy to bring down, rebuild, and redeploy without data loss. 



### Import reliability (from [PHASE_9.md](PHASE_9.md), [IMPORT_SPEC.md](IMPORT_SPEC.md), scratch notes)

Emmy’s meeting will go sideways if “import the real STP script” fails live.

- [ ] Finish Phase 9 hardening that still matters for a full STP script:
  - DOCX modern hyperlink song titles
  - Punctuated character names (`MS. ELEPHANT`, etc.)
  - Lyric punctuation that matches real songs
  - MD ↔ DOCX parity expectations (same structure from the same show)
- [ ] **Footnote artifacts** — stop polluting dialogue (`[^2]`, footnote bodies); consider importing footnotes as public notes on the moment ([SCRATCH_NOTES.md](SCRATCH_NOTES.md)).
- [ ] Keep a **cleaned full-script fixture** (or known-good export path) ready for demo — and know the Google Docs → `.md` / `.docx` recipe cold.



### Demo-ready polish (small, high visibility)

- [x] **Productions list:** whole card clickable (Open centering / affordance) — [SCRATCH_NOTES.md](SCRATCH_NOTES.md).
- [ ] **Overview:** bottom padding so CTAs aren’t flush with the screen edge.
- [ ] Smoke the [DEMO_WALKTHROUGH.md](DEMO_WALKTHROUGH.md) path yourself end-to-end on a fresh deploy.

---



## P1 — High leverage before August

Work that makes the walkthrough feel like a product STP could actually use next season — without boiling the ocean.

### Reports & “sheets that help tech” (Stage Write gap we can own differently)

Stage Write leans visual blocking + prompt book. STP’s recurring pain (and your own STP overview) is **sheets and readiness**. Push printable usefulness, not a ground-plan clone.

- [ ] **Per-character “what do I need tonight?” pack** — lines context + props + costume notes + entrances for one actor ([STP_PRODUCT_OVERVIEW.md](STP_PRODUCT_OVERVIEW.md) idea #1). Even a solid print view beats a PDF suite.
- [ ] **Lav / mic change chart** — who has which mic when, and when they swap (idea #2). Classic community-theater headache; Stage Write doesn’t own this narrative for you.
- [ ] Improve existing reports’ **print layouts** (CSS / section print) so prop, cue, entrance/exit, and blocking sheets look intentional under a projector or on paper.
- [ ] Optional stretch inside P1: set-piece sheet or song sheet if the character pack + lav chart land early.



### Org inventory bridge (multi-show story Emmy cares about)

Emmy’s Stage Write doubt was partly **multi-show investment**. Lean into remountability without building full inventory SaaS.

- [ ] Treat **CSV catalog import** as the 'for-now' STP bridge: document a clear “STP keeps authoritative mic/set CSVs → directors import into a show” workflow ([CATALOG_CSV.md](CATALOG_CSV.md), scratch org-inventory note). Include mentions (or stub connections) to a more permanent 'live' connection/integration with their existing catalogs (props, costumes, etc) (probably just Excel spreadsheets on a cloud server)
- [ ] Costume CSV ergonomics already partially fixed (`2:1` / act+scene columns) — note remaining gap (true unassigned “closet pull” import) for the meeting, don’t block on it.
- [ ] Sketch (doc only is fine) the **future “shop from org catalog”** story so you can describe it in August without building the management UI yet.



### Import / song model gaps that break real musicals

- [ ] **Singer attribution for songs** — lyric blocks need a singer like dialogue needs a speaker; support splits like `SHACKLETON (WILD)` ([SCRATCH_NOTES.md](SCRATCH_NOTES.md)). Musical-heavy STP shows will hit this.



### Timeline / director QoL (use daily in a pilot)

Pick a few that directors will feel in the first hour:

- [ ] Further **moment-detail declutter** under heavy use (add-flow still feels dense — scratch + UX wish).
- [ ] **Live search** and/or **multi-select character filter** ([UX_UI_IMPROVEMENTS.md](UX_UI_IMPROVEMENTS.md) remaining P1).
- [ ] Scene-level summary visibility improvements if cheap; full chip drill-down can wait ([PROJECT.md](PROJECT.md) wish list).



### Soft pilot packaging

- [ ] Decide and document the **pilot ask**: one show, who gets Admin vs Director accounts, how feedback is collected, what you promise to fix in-week.
- [x] Include easy bug reporting and feature requesting in-app (user menu → Send feedback → GitHub Issues via backend). Changelogging still open.
- [ ] Refresh [STP_PRODUCT_OVERVIEW.md](STP_PRODUCT_OVERVIEW.md) Phase A/B/C language so it matches what you’ll say in the room (Emmy already has the summary; keep consistency).

---



## P2 — Stretch / conversation-ready differentiators

Build only if P0–P1 are in good shape. Otherwise bring these as **slides / talking points**, not half-finished UI.

### STP-shaped ideas (from overview + About Future State)


| Idea                                                 | Build before August?                    | Meeting use                                     |
| ---------------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| Readiness checklist / richer Overview                | Partial already exists — polish if easy | Show “are we actually prepared?”                |
| Archive of past STP shows                            | No (schema/story only)                  | Multi-show memory vs Stage Write seats          |
| Writer-friendly re-import after acts exist           | Design notes only                       | Honest limitation + roadmap                     |
| Director notes from the house (mobile + dictate)     | No                                      | Delighter for Emmy/directors; too big for now   |
| Character burn-down / break-time / set-change charts | Prototype one chart max                 | Visual “wow” if time; else mock                 |
| Stage diagram click-to-block                         | No                                      | Acknowledge Stage Write strength; don’t fake it |
| Crew roles (SM, lighting, sound)                     | Probably not                            | Note shared Director login as interim           |
| Bookmarks dedicated view                             | No (undecided UX)                       | Skip unless trivial                             |
| Event-driven costumes/props/mics                     | No                                      | Architecture story only                         |




### Small leftovers worth grabbing if idle

- [x] Encouragement chrome: remove “Encouragement 2 of 5” / transport buttons — keep subtle ([SCRATCH_NOTES.md](SCRATCH_NOTES.md)).
- [ ] About page: GitHub repo link + simple “open an issue” link.
- [x] Costumes form: default scene when navigated from Timeline ([UX_UI_IMPROVEMENTS.md](UX_UI_IMPROVEMENTS.md)).
- [ ] Catalog **usage counts** before delete.
- [x] Mobile advanced-filters Sheet; badge overflow `+N`.

---



## Meeting prep (non-code) — do in parallel

These matter as much as features for a first group conversation.

### Narrative & materials

- [ ] **15–20 min walkthrough script** aligned with [DEMO_WALKTHROUGH.md](DEMO_WALKTHROUGH.md), tuned for Emmy / Pam / Becky:
  1. Scattered knowledge problem (STP-shaped)
  2. Import → Timeline sacred script
  3. Attach prep on a moment (prop + entrance + blocking)
  4. Overview readiness
  5. Rehearse as an actor
  6. Print a sheet (and, if ready, character pack or lav chart)
  7. Pilot proposal (one show, free, customization)
- [ ] One slide or spoken line on **Stage Write**: “Similar prep intent; we’re betting on timeline + catalogs + Rehearse + STP customization, not iPad spacing charts or seat licenses.”
- [ ] One slide or spoken line on **Planning Center**: “We won’t replace volunteer management — we sit beside it for production prep.”
- [ ] Printed or shared **one-pager**: elevator + Phase A/B/C + what you’re asking for ([STP_PRODUCT_OVERVIEW.md](STP_PRODUCT_OVERVIEW.md) appendix already helps).



### Questions to ask them (listen more than pitch)

Use these; don’t fill silence with features.

1. For the next show, where does prep knowledge actually live today (Docs, notebooks, tribal)?
2. Who would be the day-to-day Timeline user — director, AD, SM-ish volunteer?
3. Would actors actually open Rehearse, or is this director-only at first?
4. What’s the minimum sheet they wish existed on tech week (lavs? props? character packs?)?
5. How do script revisions happen mid-rehearsal, and how painful is re-export?
6. What must *not* change about how STP runs a show?
7. If a pilot happened, which upcoming production is the realistic candidate?



### Pilot proposal to walk in with

Mirror [STP_PRODUCT_OVERVIEW.md](STP_PRODUCT_OVERVIEW.md):

- **Phase A (this meeting):** look, talk, decide if a pilot is worth it  
- **Phase B:** one production, Timeline prep + some actors on Rehearse, Connor on-call for bugs/must-haves  
- **Phase C:** honest yes / no / not yet

Success = real prep use + a short blockers/delighters list — not company-wide rollout.

---



## Suggested ~6-week sequence

Adjust to real calendar; order matters more than dates.


| Window       | Focus                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Week 1–2** | P0 via [PHASE_10.md](PHASE_10.md) (IDOR + secrets + Tailscale on Dev/5173) + Phase 9 import bugs + footnote cleanup |

| **Week 2–3** | Demo deploy path solid; DEMO_WALKTHROUGH smoke; productions/Overview micro-polish                                |
| **Week 3–4** | Character pack **or** lav chart (prefer lav if STP mics are the louder pain); print CSS pass on existing reports |
| **Week 4–5** | Song singer attribution if musicals are likely; CSV org-catalog story documented; moment-detail or filter QoL    |
| **Week 5–6** | Meeting materials, question list, pilot write-up; only then optional P2 chart or About/GitHub links              |
| **Buffer**   | Fix whatever breaks when you re-import a fresh STP export the week before                                        |


If time collapses, cut in this order: **P2 → most P1 QoL → keep one killer sheet + P0**. Never cut IDOR/secrets/import for a flashy chart.

---



## Explicit park lot (after August / after pilot signal)

Do not spend August-prep cycles here unless STP asks in the room:

- Visual stage diagram / ground-plan blocking (Stage Write’s moat)
- Live show calling / board-op console
- Full event-driven costume/prop/mic engine
- In-app org inventory management UI (“shopping catalog”)
- Scheduling, attendance, tasks (Planning Center adjacency)
- Voice note capture from the house
- Multi-tenant commercial packaging
- Split/merge moments, character colors, saved views, bookmarks redesign
- Understudies / cast overrides
- Rich PDF export suite and cross-production analytics

---



## Source map (where items came from)


| Theme                  | Primary sources                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Pilot path & STP ideas | [STP_PRODUCT_OVERVIEW.md](STP_PRODUCT_OVERVIEW.md), [STP_PITCH_LETTER.md](STP_PITCH_LETTER.md) |
| Security bar           | [SECURITY_REVIEW.md](SECURITY_REVIEW.md), [PHASE_10.md](PHASE_10.md)                            |
| Import bugs            | [PHASE_9.md](PHASE_9.md), [IMPORT_SPEC.md](IMPORT_SPEC.md), scratch footnotes/songs            |
| UX leftovers           | [UX_UI_IMPROVEMENTS.md](UX_UI_IMPROVEMENTS.md), [SCRATCH_NOTES.md](SCRATCH_NOTES.md)           |
| Long-term product      | [PROJECT.md](PROJECT.md) Wish List, About Future State                                         |
| Anti-scope             | README “What it won’t be”, Emmy email + Planning Center note                                   |
| Competitive angle      | Stage Write comparison (Emmy email + market landscape research)                                |


---



## Bottom line

**Before August, optimize for trust and a believable one-show pilot:** secure multi-user access, reliable import of an STP-shaped script, a crisp demo, and one or two tech sheets (character pack and/or lav chart) that Stage Write wouldn’t be why they buy you.

**Do not** spend the runway cloning Stage Write’s visual blocking or Planning Center’s volunteer ops. Win the meeting by being the tool that keeps STP’s production prep attached to the script — free, customizable, and ready to learn from a real show.