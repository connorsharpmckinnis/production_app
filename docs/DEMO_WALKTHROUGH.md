# Demo Walkthrough

A short path through Theater App so someone can try it without a narrator. Assumes a clean local `docker compose up` and the default seeded Admin.

**Related:** [README.md](../README.md), [ROLES.md](ROLES.md), [SEED_DATA.md](SEED_DATA.md), [UX_UI_IMPROVEMENTS.md](UX_UI_IMPROVEMENTS.md), [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md), [production-membership-and-casting-workspace.md](feature_plans/production-membership-and-casting-workspace.md)

---

## Before you start

1. From the repo root: `docker compose up --build`
2. Open http://localhost:5173
3. Seed login (development only — change before any shared deploy):

| Username | Password | Notes |
| -------- | -------- | ----- |
| `admin` | `admin` | Only org-wide role seeded. Create other accounts under **Users**, then add them to a production under **People**. |

4. For import demos, use `fixtures/scripts/endurance-scene1.md` (scene one only). The full script fixture still needs cleanup and may fail import.

---

## 15-minute tour

### 1. Create or open a production (admin)

1. Log in as `admin`.
2. On **Productions**, create a production (or open an existing one).
3. If it shows **Needs import**, use **Import script** (sidebar or Overview CTA).
4. Drag `endurance-scene1.md` onto the drop zone (or choose the file) and import.
5. You land on the **Timeline**. Original script text stays as imported — production notes attach on top.

### 2. People and production roles (admin)

Organization accounts are separate from production access. Seeded Admin can see every production; other users only see productions where they have an **active membership**.

1. Open **Users** (Admin). Create two accounts, e.g. `director` and `actor` (no global role required).
2. Open the production → **People**.
3. Add `director` with the **Director** production role.
4. Add `actor` with the **Actor** production role (no character yet).
5. Optional: open **Settings** → production-role permission matrix to see global role capabilities (Admin-only).
6. Log out, log in as `actor`. Confirm the production appears and general views (Overview, Timeline, Script-shaped content) work **before** casting.
7. Log back in as Admin (or as the production Director) and continue.

### 3. Timeline is the center (director)

1. As Admin or the production Director, open the production → **Overview** shows next steps (Rehearse, cast gaps, Import when empty) and the people roster.
2. Open **Timeline**. Pick an act/scene. Click a moment to open the detail sheet.
3. Try:
   - Under **Characters**, cast the `actor` user to a character (only active members with the Actor production role appear)
   - Attach a prop / cue / entrance / exit / blocking note on a moment (create catalog items first if the Add menu is empty)
   - Bookmark a moment; reopen it from **My bookmarks** in the user menu
4. Use filters (character, search, advanced). Chips show what is active; filters combine with **AND**.

### 4. Rehearse like an actor

1. Log in as `actor` after casting that user to a character.
2. Open **Rehearse**. Try presets and **Blur my lines** (tap to reveal on touch devices).
3. Preparation links stay collapsed under **Preparation** for actor-shaped accounts so Rehearse and Timeline stay primary.

### 5. Reports from the timeline (director)

1. As director/admin, open **Reports**.
2. Use the sticky section links to jump between prop, cue, costume-change, entrance/exit, and blocking sheets.
3. Click a moment reference — it should open that moment on the Timeline.
4. Optional: **Print** for a basic browser print layout.

### 6. Remove access (optional check)

1. As Admin or production Director, open **People** → deactivate the actor’s membership.
2. Log in as that user: the production should no longer appear.
3. Reactivating the membership (add the same user again) restores the prior membership row; casting may become effective again when the Actor role is present.

### 7. Close the loop

1. Open **About the App** for current vs future state. Admins can **Edit page** there to update copy in Markdown.
2. Use **Send feedback** (user menu) or the About page email link for bugs and ideas.
3. Say what felt confusing — that feedback drives the next polish pass more than the wish list.

---

## What this demo is (and is not)

**Is:** Script import → production membership / roles → timeline prep → casting → role-aware rehearsal → derived reports.

**Is not:** A dedicated Casting workspace, conflict calendars / unavailable dates, PDF export polish, attendance, tasks, live cue calling, costume **pieces**/outfits, or a perfect full-script import of every draft markdown file.

If import fails on a line, the error names the line and reason — fix the markdown and retry. See [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) and the tips on the Import page.

---

## Shared deploy checklist

Before anyone outside your machine uses the app:

- [ ] Change `ADMIN_PASSWORD` / any demo user passwords (see README)
- [ ] Change `SECRET_KEY` from the dev default
- [ ] Confirm which script fixture (or cleaned script) you will demo
- [ ] Walk this document once on the target deploy URL (including People → cast → Rehearse)
