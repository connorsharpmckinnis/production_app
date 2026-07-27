# Demo Walkthrough

A short path through Theater App so someone can try it without a narrator. Assumes a clean local `docker compose up` and the default seed users.

**Related:** [README.md](../README.md), [UX_UI_IMPROVEMENTS.md](UX_UI_IMPROVEMENTS.md), [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md)

---

## Before you start

1. From the repo root: `docker compose up --build`
2. Open http://localhost:5173
3. Seed logins (development only — change before any shared deploy):

| Username | Password | Role |
| -------- | -------- | ---- |
| `admin` | `admin` | Admin |
| `director` | `director` | Director |
| `actor` | `actor` | Actor |

4. For import demos, use `fixtures/scripts/endurance-scene1.md` (scene one only). The full script fixture still needs cleanup and may fail import.

---

## 15-minute tour

### 1. Create or open a production (admin)

1. Log in as `admin`.
2. On **Productions**, create a production (or open an existing one).
3. If it shows **Needs import**, use **Import script** (sidebar or Overview CTA).
4. Drag `endurance-scene1.md` onto the drop zone (or choose the file) and import.
5. You land on the **Timeline**. Original script text stays as imported — production notes attach on top.

### 2. Timeline is the center (director)

1. Log out, log in as `director` (or stay as admin).
2. Open the production → **Overview** shows next steps (Rehearse, cast gaps, Import when empty).
3. Open **Timeline**. Pick an act/scene. Click a moment to open the detail sheet.
4. Try:
   - Cast a character under **Characters**
   - Attach a prop / cue / entrance / exit / blocking note on a moment (create catalog items first if the Add menu is empty)
   - Bookmark a moment; reopen it from **My bookmarks** in the user menu
5. Use filters (character, search, advanced). Chips show what is active; filters combine with **AND**.

### 3. Rehearse like an actor

1. Log in as `actor` (after casting that user to a character, or use director and pick **My characters** / Rehearse presets).
2. Open **Rehearse**. Try presets and **Blur my lines** (tap to reveal on touch devices).
3. Preparation links stay collapsed under **Preparation** for actor-only accounts so Rehearse and Timeline stay primary.

### 4. Reports from the timeline (director)

1. As director/admin, open **Reports**.
2. Use the sticky section links to jump between prop, cue, costume-change, entrance/exit, and blocking sheets.
3. Click a moment reference — it should open that moment on the Timeline.
4. Optional: **Print** for a basic browser print layout.

### 5. Close the loop

1. Open **About the App** for current vs future state and the feedback email link.
2. Say what felt confusing — that feedback drives the next polish pass more than the wish list.

---

## What this demo is (and is not)

**Is:** Script import → timeline prep → role-aware rehearsal → derived reports.

**Is not:** PDF export polish, attendance, tasks, live cue calling, costume **pieces**/outfits, or a perfect full-script import of every draft markdown file.

If import fails on a line, the error names the line and reason — fix the markdown and retry. See [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) and the tips on the Import page.

---

## Shared deploy checklist

Before anyone outside your machine uses the app:

- [ ] Change `ADMIN_PASSWORD` / seed passwords (see README)
- [ ] Change `SECRET_KEY` from the dev default
- [ ] Confirm which script fixture (or cleaned script) you will demo
- [ ] Walk this document once on the target deploy URL
