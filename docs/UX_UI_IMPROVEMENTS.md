# UX / UI Improvements Backlog

**Purpose:** Candidate polish before sharing the app with the theater group for real-world consideration. This is a working inventory — not committed scope. Items come from owner scratch notes, the product wish list, phase docs, UI standards, and a pass over the current frontend.

**Last updated:** 2026-08-13

**Related docs:** [SCRATCH_NOTES.md](SCRATCH_NOTES.md), [PROJECT.md](PROJECT.md) Wish List, [UI_STANDARDS.md](UI_STANDARDS.md), [PHASE_6.md](PHASE_6.md), [DEMO_WALKTHROUGH.md](DEMO_WALKTHROUGH.md)

**Progress (2026-07-12 share-prep passes):** Most **P0** and a large **P1** set shipped (dialogs for users/groups/catalogs, filter chips, reports TOC + clickable moments + print, import drag-drop, skeletons, localStorage presets, shell polish, DEMO_WALKTHROUGH). Remaining P1/P2 are thinner polish. See checkmarks below.

**Progress (2026-08-04):** WP0/WP1 design-system pass — expanded shadcn primitives, `/dev/ui` gallery, SearchableSelect/Toast polish, form/catalog migration.

**Progress (2026-08-13):** Timeline + Rehearse live search (debounce ~275ms); Timeline multi-select character filter (OR). Prop/cue multi-select still open.

---

## How to use this list

Suggested priority for a first external share:

| Tier | Meaning |
| ---- | ------- |
| **P0** | Credibility and safety — fix or strongly consider before showing anyone |
| **P1** | Feels finished — high-impact polish that makes prep/rehearsal feel intentional |
| **P2** | Nice polish — consistency, convenience, smaller wins |
| **Wish** | Larger / undecided / post-share ideas — keep on the radar, don’t block a demo |

Within each section, items are concrete enough to implement later without re-discovering them.

---

## P0 — Before sharing (credibility & safety)

### Confirmations, errors, and feedback
- [x] Replace browser `confirm()` / `alert()` with proper **AlertDialog** (and toasts where useful) for deletes and failures — productions, catalog items, groups, users, structural timeline edits, settings save failures.
- [x] Add confirmation for **note delete** and **detach** actions (currently silent / no confirm).
- [x] Add light success feedback (toast) for cast changes, attach/detach, import success, and settings save.

### First-run / production onboarding
- [x] **Overview** should guide “what’s next”: link to **Rehearse**, Import when the timeline is empty, cast progress when characters are uncast, and other prep gaps — not only Timeline / Characters / Reports.
- [x] Surface **Import** for admins when a production has no script yet (sidebar or Overview CTA). Import is easy to lose after the create flow.
- [x] Empty “no acts / no timeline” states should point at **Import**, not only back to the productions list.
- [x] Production list: clear **status** (“Needs import” vs “Ready”) instead of only swapping Open/Import buttons.

### Rehearse touch support
- [x] **Blur my lines** currently reveals on mouse hover — broken on phones/tablets. Need tap-to-reveal (and re-blur) for real rehearsal use.

### Moment detail density
- [x] Collapse **empty** attachment sections by default for editors (props, mics, cues, etc.) so the sheet isn’t a long wall of “No X yet.”
- [x] When catalogs are empty, “Add to moment” types vanish with **no hint** to create props/cues first — add guidance or deep-links.
- [x] **Public/Private** note visibility control needs more padding from the Add Note button ([SCRATCH_NOTES.md](SCRATCH_NOTES.md)).
- [x] Clarify note visibility labels for volunteers (“Visible to cast” / “Only me” instead of only Public/Private).

### Costumes disconnect
- [x] Costumes appear as scene-level prep and as list badges, but aren’t managed like other moment attachments — explain in UI or deep-link to Costumes so the workflow doesn’t feel broken.

### About the App (added for share)
- [x] Global **About the App** nav for all users with App Details, Current State, and Future State sections.
- [x] Feedback button opens email to `csharpmckinnis@gmail.com` with subject `Theater App Feedback`.
- [x] Content kept easy to edit in `frontend/src/aboutContent.ts`.

---

## P1 — Feels finished (high-impact polish)

### Icon buttons & shared actions
Timeline already uses Lucide icon buttons for structural actions, bookmark, detach, etc. Extend that pattern:

- [x] Catalog tables (Props, Songs, Costumes, Mics, Set Pieces, Cue Categories): **Edit / Delete / Save / Cancel** as icon buttons with `aria-label` / `title`, not underline text links. *(Characters casting remains selects; no row edit icons.)*
- [x] Productions list: icon Delete; make row/title the primary Open click.
- [x] Notes: icon Delete (with confirm).
- [x] Groups: Edit members / Delete as icons or a clearer primary action.
- [x] Users: Reset password / Deactivate — less text-heavy; prefer a dialog for password reset. *(KeyRound / UserX icons + Dialogs for create and reset.)*

### Modals, sheets, and conditional forms
- [x] Catalog **create/edit** in a Dialog or Sheet instead of cramped inline table editing (especially on mobile).
- [x] Groups **member editor**: Dialog/Sheet with search instead of expanding huge checkbox grids on the page.
- [x] User **password reset**: Dialog, not inline in the table.
- [x] Timeline **Advanced filters**: Sheet on small screens; keep desktop collapsible panel.
- [x] Bookmarks: leave the banner for now *or* move toward a dropdown / dedicated view (see Wish) — at minimum, **deep-link to the bookmarked moment**, not just `/timeline`.
- [x] Continue the **Add to moment → sub-form** pattern; shorten submit labels (“Add” / “Attach”) so the panel stays scannable.

### Defaults & one-click helpers
- [x] Insert moment: default **moment type** (e.g. dialogue or last-used) instead of empty “Moment type…”.
- [x] Cue categories: one-click “Add common categories” (Lighting, Sound, Music, …) using existing placeholders as a seed list.
- [x] Remember last-opened production for admin nav (optional, previously noted in Phase 4).
- [x] Persist Rehearse presets in `localStorage` (today: `sessionStorage` only).
- [x] Costumes form: if navigated from Timeline with a scene in context, default that scene.

### Empty states & loading
- [x] Unify empty states (dashed card + short explanation + CTA) across catalogs, groups, Overview, and filtered timeline results. Role-aware copy where it helps (actor vs director/admin).
- [x] Replace plain “Loading…” with simple skeletons on Timeline, Rehearse, Overview, and Reports.
- [x] Structural-edit empty guidance when the list is empty or filters hide everything (Phase 4 note).

### Timeline & filters
- [x] **Clear filters** control.
- [x] Active filter chips (dismissible) + Clear all.
- [x] Helper text for how filters compose (AND/OR expectations).
- [x] Live search (filter as you type) — Timeline + Rehearse; debounce ~275ms; Enter still commits immediately.
- [x] Multi-select character filter (OR within character; AND with other dimensions). Mine pre-checks cast ids; exclusive with group.
- [ ] Multi-select prop/cue category filters with badge chips on rows.
- [ ] Shared act/scene/search toolbar between Timeline and Rehearse for consistency.
- [x] Speaker column: tooltip on truncated names.
- [x] On mobile, consider badge overflow (“+N”) when prep badges wrap the row.

### Overview & navigation
- [x] Overview quick links: add **Rehearse**, Songs, Props, and Import (when needed).
- [x] Cast progress CTA when `cast_count < character_count`.
- [x] Unify breadcrumbs / back links (“← Overview” / “← Productions” consistently).
- [x] Consider showing production title more prominently in the header (branding beyond generic “Theater App”).
- [x] Sidebar length: for actors, collapse or nest Preparation items so Rehearse + Timeline stay primary.
- [x] Preparation + Reports collapsible for all roles; open/closed persisted in `sessionStorage` for the tab session.

### Reports
- [x] Tabs or sticky TOC instead of five long sections on one page.
- [x] Moment references **clickable** into Timeline (open that moment).
- [x] At least basic print CSS / “Print this section” until full PDF export exists.

### Import
- [x] Link to script format help ([SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) / short in-app tips). *(About link + Import page tips.)*
- [x] Drag-and-drop upload.
- [x] Success toast before jumping to Timeline.

---

## P2 — Consistency & smaller wins

### Component consistency
- ~~Only a few shadcn primitives exist today (`button`, `badge`, `sheet`). Add **AlertDialog**, **Dialog**, **Select**, **Input**, **Table**, **Toast** and migrate raw `<button>` / `<select>` / `<input>` toward them.~~ **Done 2026-08-05:** Added the remaining form/table primitives plus semantic `Alert`; polished SearchableSelect, Toast, focus states, tables, and palette-aware status colors; migrated catalogs, forms, shell/chrome, notifications, and standard page actions. Admin review gallery at `/dev/ui`. Bespoke listbox options, segmented toggles, disclosure rows, and click-catcher overlays intentionally remain custom.
- ~~Primary actions should consistently use the shared `Button` component (many pages still hand-roll Tailwind buttons).~~ **Done 2026-08-05:** Standard actions use `Button`; remaining native buttons are intentional custom controls.
- Groups always shows the create form; other catalogs toggle `showAddForm` — pick one pattern. *(Catalogs now use Dialog; Groups still inline create.)*
- Characters “Add character manually” styling differs from other “Add …” primaries.
- Songs: no Delete in UI; Characters: limited rename/delete — decide intentional vs gap.
- Catalog breadcrumb always → Timeline; Overview as hub may be better. *(Now → Overview.)*

### Accessibility
- Visible labels (or `aria-label`) on Timeline/Rehearse selects.
- Theme toggle: `aria-pressed`. *(Done.)*
- Mobile sidebar: focus trap + Escape to close (beyond overlay click).
- Resize handle on moment sheet: keyboard alternative.
- Skip link to main content. *(Done.)*
- Avoid color-only status on Users (Active/Inactive). *(Badge + text + dot.)*

### Mobile / responsive
- `overflow-x-auto` on wide tables (Productions, Characters, Users — some catalogs already do this).
- Header user button: long name + roles can overflow — roles as a compact badge. *(Done.)*
- Moment detail bottom sheet (`max-h-[70vh]`) may be too short for directors editing; consider taller / full-height on small screens.
- Rehearse toggle bar: collapse under preset or use a more compact control on narrow viewports.

### Catalog usefulness
- Show **usage counts** (“used in 4 moments”) so deletes aren’t blind.
- Empty catalog CTAs that point to Timeline attach flow when relevant.
- Type-change warning when changing moment type if structured attachments already exist (Phase 4 risk).

### Rehearse extras
- “Jump to my next line” / keyboard nav between highlighted moments.
- Clarify or remove the non-selectable **Custom** preset option in the dropdown (currently confusing). *(Disabled Custom option with title when toggles diverge.)*
- Extend dashed-border empty patterns used elsewhere to Rehearse empty messages.

### Actor-facing defaults
- In moment detail, prep sections collapsed by default for actors (Phase 6 note).
- Ensure edit chrome never confuses actors when they open a moment (already gated; verify copy).

### Docs / demo packaging (not chrome, but share-readiness)
- [x] Create **DEMO_WALKTHROUGH.md** (referenced in Phase 5, never written) so someone can try the app without you narrating.
- [x] Confirm seed/admin password story before any shared deploy ([README.md](../README.md)). *(Documented in DEMO_WALKTHROUGH + README.)*
- Full script import still needs owner cleanup — set expectations for the group if demos use a partial fixture. *(Called out in DEMO_WALKTHROUGH.)*

---

## Wish list — larger / undecided (don’t block a first share)

These are already captured in [PROJECT.md](PROJECT.md) and [SCRATCH_NOTES.md](SCRATCH_NOTES.md); listed here so this file is one place to look.

### Bookmarks redesign (owner undecided)
- Dedicated timeline-like view with `…` gaps between non-adjacent moments.
- Click a bookmark → open that moment in the main Timeline.
- Current banner-in-header approach is interim.

### Scene summary drill-down
- Scene summary chips are read-only today.
- Make chips clickable → modal with per-character detail: entrance, exit, costume, props, set pieces, blocking (derived from timeline; costume/props/set pieces now readable from Phase 14 event-derived state — `asset_state.py`).
- Named **prop chips** on the strip (not only “Props used (N moments)”).

### Moment detail evolution
- Further declutter beyond the Add menu — stronger “what do you want to add?” selection layer / shorter flows (owner still wants this panel to feel better under heavy use).

### Stage diagram (ambitious)
- Clickable mini stage diagram to set blocking / entrance locations (possibly per-production drawable zones). Interesting, hard, not required for a first share.

### Filters & views
- **Saved named views** (filter + Rehearse preset combos; tech-night modes).
- Character colors for highlighting.
- Split / merge moments during structural edit.

### Production & reports (post-MVP product)
- Richer production home / readiness dashboard.
- Production-level settings (vs global App Settings).
- PDF export, print layouts, cross-production analytics, preparation progress dashboard.
- Costume **pieces / outfits** over time (Phase 14 WP5 shipped thin whole-costume Wear/Clear on the Timeline; piece-level tracking still later).

### Mobile director note capture (ambitious)
- Sit in the house, advance moments passively, dictate a short note onto the current moment without leaving the action.
- Real-time / voice note-flagging while watching.

---

## By screen (quick index)

| Area | Highest-signal ideas |
| ---- | -------------------- |
| **App shell** | Actor-simplified prep nav; Import when empty; bookmarks deep-link; breadcrumb consistency; role badge vs long “(roles)” text; collapsible Preparation/Reports (session persist); Admin Act-as banner |
| **Productions list** | Status chip; icon Delete; row Open; AlertDialog; table overflow |
| **Overview** | Rehearse + Import + next-step CTAs; cast progress |
| **Timeline** | Clear filters; live search; character multi-select; defaults on insert; skeletons; mobile filter sheet; tooltips |
| **Rehearse** | Touch blur; compact toggles; jump-to-next-line; preset dropdown clarity; localStorage |
| **Moment detail** | Collapse empties; confirm delete/detach; spacing; visibility copy; catalog-empty hints; costumes explanation |
| **Catalogs** | Icon actions; Sheet/Dialog edit; unified empties; usage counts; common cue seeds |
| **Groups** | Member editor Dialog; icon actions; confirm |
| **Reports** | TOC/tabs; clickable moments; print |
| **Import** | Format help; drag-drop; success toast |
| **Users / Settings** | Dialog password reset; fewer text actions; toast on save |
| **About** | Editable `aboutContent.ts`; in-app Send feedback + mailto fallback |
| **Login** | Fine for MVP; forgot-password not required for internal share |

---

## Patterns already worth extending

Reuse these instead of inventing new ones:

1. **Icon `Button` + `aria-label`** — Timeline structural actions, bookmark, detach.
2. **Sheet** for moment detail (right desktop / bottom mobile) with pending-save flush.
3. **Add to moment** type picker → conditional sub-form.
4. **Collapsible Advanced filters** + active count badge.
5. **AttachmentSection** collapse + count — default collapsed when empty.
6. **Rehearse presets + toggles** with session persistence — extend persistence and Timeline filter memory.
7. **Role-aware empty copy** (productions list) — extend to all empties.
8. **Scene summary strip** — read-only chips → future drill-down modals.
9. **Destructive bordered error banners** — prefer over `alert()`.
10. **`useConfirm` / `useToast`** — shared AlertDialog + toast providers for destructive actions and feedback.
11. **`EmptyState`** — dashed card + optional CTA for empty lists.
12. **`Dialog`** — catalog create/edit, groups members, user create/reset.
13. **`Skeleton`** — loading placeholders on Timeline, Rehearse, Overview, Reports.
14. **`rememberLastProduction`** — admin back-link after Users/Settings.

**UI philosophy reminder** ([DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md), [PROJECT.md](PROJECT.md)): keep the Timeline visible when practical; edit via side panels/dialogs; simple beats flashy; icons support labels; prefer shadcn; avoid unnecessary animation.

---

## Suggested share-prep order (practical)

If time is limited before the theater group sees it, do roughly this order:

1. ~~AlertDialogs + confirm on destructive / detach / note delete~~
2. ~~Overview next steps (Rehearse, Import, cast progress)~~
3. ~~Touch-friendly line blur~~
4. ~~Collapse empty moment-detail sections + Public/Private spacing~~
5. ~~Icon actions on catalog / production tables~~
6. ~~Unified empty states with CTAs~~
7. ~~Bookmarks deep-link to moment~~
8. ~~Timeline clear-filters + active chips + AND helper~~
9. ~~Reports clickable moments + light print support~~
10. ~~DEMO_WALKTHROUGH + password / deploy expectations~~
11. Optional remaining: catalog usage counts; multi-select prop/cue filters

Everything in **Wish** can wait until after feedback from a real rehearsal pass — then update [SCRATCH_NOTES.md](SCRATCH_NOTES.md) with what actually hurt.
