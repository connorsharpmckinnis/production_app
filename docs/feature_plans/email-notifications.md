# Feature plan — Email notifications

**Status:** Proposal (not scheduled)  
**Created:** 2026-07-28  
**Related:** [app-announcements.md](app-announcements.md), [tasks-and-mentions.md](tasks-and-mentions.md), `users.email` (optional), [SECURITY_REVIEW.md](../SECURITY_REVIEW.md) (no mail stack today)

---

## Goal

Add a **simple, trustworthy outbound email channel** so people who don’t open the app every day still learn about important announcements, @-mentions, and task assignments. Emails follow one **standardized, good-looking template**; Admins/Directors supply **customizable text** (and basic fields) before send or as per-type defaults — not a full marketing automation product.

**Primary motivating UX:** Director composes a production announcement (“Off-book next Tuesday”) and checks “Also email cast.” Before send, they edit the short email body in a preview that already has the Theater Thing header, production name, and a big “Open in Theater Thing” button. Cast members with emails on file receive it; the same item appears in the in-app bell.

**Secondary motivating UX:** When Alex is @-mentioned on a task, they get an optional email: subject “You were mentioned in Iceberg — Confirm mic pack,” body from a standard mention template, CTA deep-linking to the task. Prefer user preference: immediate vs daily digest vs off.

**Tertiary motivating UX:** Admin configures org defaults (from-name, reply-to, footer blurb, logo optional later) once; Directors don’t restyle every message.

---

## Problem

In-app announcements and mentions only help people who log in. STP-style casts often live in email/texts for logistics. Today the app has:

- **No SMTP / ESP integration** (Resend, SES, SendGrid, etc.)
- **Optional `users.email`** with no verification
- Feedback via `mailto:` / GitHub — not transactional mail
- Password reset is **in-app admin-set**, not email magic links

We need a thin pipe: **template + editable text + send to known addresses**, with clear failure modes when email is missing.

---

## Current behavior (baseline)

| Area | Today |
| ---- | ----- |
| Outbound email | **None** |
| User email | Optional string; not verified |
| Auth recovery | Admin resets password in Users UI |
| Announcements / mentions | Proposed; in-app only in those plans |
| Secrets / config | Env-based deploy; no mail keys yet |

---

## Product model (proposed)

### Design principles

1. **One visual system** — shared HTML (+ plain-text multipart) layout for all mail.
2. **Human-editable copy** — Directors/Admins write the *variable* parts; the chrome is fixed.
3. **In-app is source of truth** — email is a delivery channel, not a separate announcement store.
4. **Missing email = skip + visible warning**, never silent failure for the sender’s whole blast.
5. **Boring provider** — pick one ESP, wrap behind a tiny `EmailService`; don’t abstract five providers on day one.

### Standard template (chrome)

Fixed regions (not freely redesigned per send):

| Region | Content |
| ------ | ------- |
| Header | App/org name (configurable), optional small logo later |
| Eyebrow | Production title or “Theater Thing” for org-wide |
| Title | Event-specific headline (editable or derived) |
| Body | **Customizable text** (plain text or very limited markdown → safe HTML) |
| Primary CTA button | Deep link into the app (announcement, task, moment, inbox) |
| Secondary line | “You’re receiving this because …” |
| Footer | Reply-to / contact blurb, manage notification preferences link (when prefs exist), org name |

Look: clean, readable, mobile-friendly, on-brand but not a newsletter builder. No drag-and-drop sections in v1.

### Customizable text (what authors edit)

Per send (or per saved default for that email kind):

| Field | Example |
| ----- | ------- |
| Subject | `Off-book reminder — {{production_name}}` |
| Preheader | Optional short inbox preview text |
| Headline | Shown in template title region |
| Body | The paragraph(s) the Director cares about |
| CTA label | Default “Open in Theater Thing”; overridable |
| CTA URL | Usually auto from resource deep link |

**Merge fields (server-substituted, read-only in preview):** `{{recipient_first_name}}`, `{{production_name}}`, `{{actor_name}}` (sender), `{{app_url}}`, etc. Keep the list short.

### Email kinds (triggers)

| Kind | Who initiates | Custom text | Default on/off (draft) |
| ---- | ------------- | ----------- | ---------------------- |
| **Announcement blast** | Director/Admin at publish (or “Send email” action) | Full editor before send | Opt-in per announcement (checkbox) |
| **Mention** | System on @-mention | Org/production default template; rarely edited per event | User pref; default digest or off until verified email |
| **Task assigned** | System on assign | Default template | User pref |
| **Digest** | Cron (daily/weekly) | Admin-configured intro line + auto list of unread items | User pref |
| **Transactional auth** (password reset / invite) | System | Admin-configured defaults | Separate from “notification” prefs; always on when feature exists |

v1 can ship **announcement blast only**, then add mention/assignment, then digest. Auth emails are valuable but are a different product decision (invite links change how accounts work).

### Audience & addressing

- Recipients = users in announcement/task audience **who have a non-empty email**.
- Show sender a summary before send: `24 recipients · 3 users missing email (view list)`.
- Do **not** invent addresses; do **not** CC personal Gmail of the Director unless they set reply-to.

### Preferences (lightweight)

Per user (when we have a prefs UI):

- Email notifications: `off` | `immediate` | `daily_digest`
- Optional per-kind toggles later (mentions vs announcements)

Org default for new users: recommend `daily_digest` once digests exist; until then, announcement blasts are **sender-initiated** and don’t require the recipient to have opted in beyond “has email + is in audience” — but document that policy clearly (see Q4).

### Admin / Director configuration

| Level | Settings |
| ----- | -------- |
| **Org (Admin)** | ESP keys via env (not DB); from-name; from-email; reply-to; footer blurb; default templates per kind |
| **Production (Director)** | Optional override intro/footer line for that show’s blasts; otherwise inherit org |
| **Per send** | Subject, headline, body, CTA label; recipient preview |

Stored templates: `email_templates` (kind, subject_template, body_template, cta_label_default) — org-scoped; production overrides optional.

### Delivery architecture (sketch)

```text
Composer / domain event
    → build EmailMessage (template + merge + custom text)
    → enqueue send (sync OK for low volume MVP; job queue later)
    → EmailService.send via ESP
    → log email_delivery (user_id, kind, provider_id, status, error)
```

**Provider recommendation:** Start with **Resend** or **AWS SES** ( whichever is simpler for the existing Docker/deploy setup). Capture the choice in Decision log; keep `EmailService` as one module.

**Dev/stage:** Log-only or Mailpit/Mailhog in Docker — never real sends without explicit config.

---

## Relationship to other plans

| Plan | Relationship |
| ---- | ------------ |
| [app-announcements.md](app-announcements.md) | Blast email is an optional channel on publish; in-app bell remains required for parity among openers |
| [tasks-and-mentions.md](tasks-and-mentions.md) | Mention / assignment emails need notification events + deep links first |
| Auth / invites | Optional follow-on; not required to prove announcement mail |

**Recommendation:** Implement email **after** (or at the tail of) in-app announcements Slice A, starting with **manual announcement blast**. Mentions email waits on Tasks+mentions.

---

## What we could implement

### Slice A — Plumbing + announcement blast (recommended first)

- ESP config via env; `EmailService`; HTML+text template partials
- Org from-name / reply-to / footer in Settings (Admin)
- On announcement publish (or dedicated “Email cast”): preview editor (subject, headline, body, CTA), recipient counts, send
- `email_deliveries` log rows
- Skip users without email; show list to sender

**Done when:** Director sends one real (or Mailpit) blast; cast with emails receive standardized message; others listed as skipped.

### Slice B — Default templates UI

- Admin edits default subject/body for `announcement`, `mention`, `task_assigned`
- Preview with sample merge data

### Slice C — Event-driven mention / assignment mail

- Hook notification writer → email if user pref allows
- Respect `immediate` vs skip-when-digest

### Slice D — Daily digest

- Cron aggregates unread notifications + optional open tasks
- One email per user with bullet list + “Open inbox” CTA

### Slice E — Parked

- Verified emails + double opt-in
- Magic-link password reset / invites
- Attachments, iCal, rich newsletter builder
- Per-production custom CSS
- Marketing campaigns, open/click analytics dashboards (ESP-native stats enough)
- SMS / Discord / Slack bridges
- User-uploaded HTML templates

---

## Open questions (decide before build)

| # | Question | Recommendation | Alternatives | Status |
| - | -------- | -------------- | ------------ | ------ |
| **Q1** | ESP choice? | **Resend** for fast DX + simple API; Docker Mailpit for local. | SES (cheaper at scale, more AWS setup); SMTP relay. | Open (lean Resend) |
| **Q2** | First email kind to ship? | **Announcement blast** (human-initiated, editable text). | Mentions-first (needs Tasks). | **Locked** 2026-07-28 |
| **Q3** | Require verified email before send? | **No for v1** — Admin-entered emails trusted; add verify later. | Block sends to unverified (safer, more friction). | **Locked** 2026-07-28 |
| **Q4** | Blast without per-user opt-in? | **Yes for production ops mail**, with clear copy and later prefs to opt out of non-critical kinds. | Soft opt-in only (may gut usefulness). | Open (lean yes) |
| **Q5** | Body format? | **Plain text** in composer → escaped paragraphs in HTML template. | Markdown subset. | Open |
| **Q6** | Sync send vs queue? | **Sync** for blasts under ~100 recipients; add queue if timeouts appear. | Always queue (more infra). | Open |
| **Q7** | Who can send blasts? | Same as announcement authors (Admin org-wide; Director production). | Admin-only sends. | Open |
| **Q8** | Reply-to behavior? | Org default reply-to (e.g. company email); optional per-blast override. | Reply to sender’s personal email always. | Open |
| **Q9** | Mentions default pref? | **Off or digest** until users expect mail; blasts remain explicit. | Immediate mention mail always. | **Locked** 2026-07-28 |
| **Q10** | Store full rendered HTML in DB? | Store **template ids + custom fields + provider id**; not necessarily full HTML forever. | Store full body for audit (heavier). | Open |

Still pick ESP (Q1) and blast opt-in policy (Q4) before WP0 send-to-prod.

---

## Proposed work packages (if authorized)

### WP0 — Provider + policy decisions

- Q2, Q3, Q9 locked (see Decision log). Still choose ESP (Q1) and confirm blast opt-in policy (Q4); add local Mailpit in compose.
- Document env vars in deploy docs (no secrets in git).

**Done when:** Owner confirms provider (Q1); Mailpit path documented.

### WP1 — Template + EmailService + Mailpit path

- Render standard layout; send path; delivery log; dry-run/dev mode.

**Done when:** `docker compose` can catch a test message in Mailpit.

### WP2 — Announcement blast UI (Slice A)

- Preview editor with customizable subject/headline/body/CTA
- Recipient summary (ready / missing email)
- Send + per-user success/fail feedback

**Done when:** Motivating UX #1 works in staging.

### WP3 — Org Settings for chrome + default templates (Slice B)

### WP4 — Mentions / assignment hooks + prefs (Slice C)

### WP5 — Digest cron (Slice D)

---

## Explicitly out of scope (this proposal)

- Full ESP dashboard clone / campaign A/B testing
- Replacing Google Groups / church email lists as the org’s primary mail system
- Guaranteeing delivery to users with no address on file
- Push notifications / PWA (separate)
- In-app chat

---

## Risks / tradeoffs

| Risk | Mitigation |
| ---- | ---------- |
| Unverified / wrong emails | Admin hygiene; later verify; show bounced status from ESP webhooks if added |
| Deliverability / spam | Proper from-domain DNS (SPF/DKIM); modest volume; transactional tone |
| Directors over-emailing | Explicit send step + preview; no silent email on every tiny edit |
| Infra creep (queues, workers) | Sync + ESP first; queue only when needed |
| Secrets in repo | Env only; document in deploy |
| Diverging from in-app content | Blasts reference the same announcement id; CTA opens app |
| Legal / CAN-SPAM tone | Footer with who you are + how to stop non-critical mail once prefs exist |

**Recommendation:** Ship **Slice A only** (templated announcement blast + Mailpit/ESP). Treat mentions/digest as follow-ons after in-app notifications and Tasks exist.

**Why this fits after announcements:** Without in-app + deep links, email becomes a dead-end paste of text. With announcements, email is a multiplier for the same object.

**Deferring:** Verification, auth magic links, digests, rich markdown, analytics UI.

---

## Suggested sequence

1. Answer Q1–Q4; add Mailpit to local Docker story.
2. Authorize WP0–WP2 after announcements can create a durable announcement record to link.
3. Dogfood one cast reminder via email + bell.
4. Add default template Settings (WP3).
5. Connect mention/assignment email when [tasks-and-mentions.md](tasks-and-mentions.md) Slice C lands.
6. Consider digest when unread volume justifies it.

---

## Other considerations

### Accessibility

- Semantic HTML, good contrast, large CTA tap target, plain-text alternative part.

### Security

- Escape all user-provided body text; allowlist merge fields; CTA URLs must be app-origin or already-approved external announcement CTAs (don’t let body inject raw HTML links freely in v1 — or sanitize strictly).
- Rate-limit blast sends per production/hour.

### Operability

- Log provider message ids for support (“did it send?”).
- Optional ESP webhook later for bounces → mark `users.email` delivery_state.

### Copy tone

- Operational, short, theater-plain language — not growth-marketing drip copy.

### Cost

- ESP free tiers likely enough for one company; watch blast size × frequency.

---

## Decision log

| Date | Topic | Decision |
| ---- | ----- | -------- |
| 2026-07-28 | Q2 first email kind | **Announcement blast first** — standardized template + Director/Admin preview editor (subject, headline, body, CTA) before send. Mention/assignment mail is later (Slice C), after in-app notifications + Tasks/mentions exist. |
| 2026-07-28 | Q3 verify email in v1? | **No** — Admin-entered `users.email` values are trusted for v1; verification / bounce handling can come later. |
| 2026-07-28 | Q9 mentions default pref | **Not immediate-by-default** — off or daily digest until users expect mail; announcement blasts stay explicit sender-initiated sends. |
| *(pending)* | Q1 ESP | Lean Resend + Mailpit locally — confirm at build. |
| *(pending)* | Q4 blast without opt-in? | Lean yes for production ops mail — confirm at build. |

---

## Acceptance sketches (draft)

1. **Blast:** Director opens Email preview on an announcement, edits body, sees “18 ready · 2 missing email,” sends; 18 messages in Mailpit/ESP; missing listed; announcement still in bell for all audience members.
2. **Template chrome:** All messages share header/footer/CTA styling; only subject/headline/body differ.
3. **No email:** User without address never called to ESP; sender warned pre-send.
4. **Dev safety:** Without ESP keys, app uses log/Mailpit mode and does not touch production email APIs.
5. **(Later) Mention:** @-mention with pref=immediate sends templated mail with task deep link; pref=off sends nothing.

---

## References

- Announcements: [app-announcements.md](app-announcements.md)
- Tasks / mentions: [tasks-and-mentions.md](tasks-and-mentions.md)
- Security baseline (no mail today): [SECURITY_REVIEW.md](../SECURITY_REVIEW.md)
- Users.email: [DATABASE.md](../DATABASE.md) USERS
