# UI Standards

**Version:** 0.3 (Phase 3 — Slice 3)

Minimum UI conventions for the Theater App. Slice 1 covers import and read-only timeline; Slice 2 adds casting, filters, notes, and bookmarks; Slice 3 adds import-review editing, songs, props, and cues.

Product context: [PROJECT.md](PROJECT.md). Role visibility: [ROLES.md](ROLES.md).

---

## App Shell

```
┌─────────────────────────────────────────────────────────┐
│ Header: Theater App   [Production title]   [User menu]  │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │ Main content area                            │
│ (nav)    │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

* **Sidebar:** Collapsible on mobile. Shows only items the current role may access.
* **Header:** App name, production title (when inside a production), user menu (bookmarks, logout).
* **Main content:** One primary task at a time.

### Sidebar (inside a production)

| Item | Admin | Director | Actor |
| --- | --- | --- | --- |
| Timeline | Yes | Yes | Yes |
| Characters | Yes | Yes | Yes (read-only) |
| Songs | Yes | Yes | Yes (read-only) |
| Props | Yes | Yes | Yes (read-only) |
| Groups | Yes | Yes | Hidden |
| Cue Categories | Yes | Yes | Hidden |

Global nav: Productions; User Management (Admin only).

---

## Slice 1 Screens (Phase 1)

### Production List

* Table of productions (title, season, author, created date).
* **Admin:** "New Production" button; Delete action.
* **All roles:** **Open** button for imported productions (Admin: Import for unimported).
* **Actor empty state:** "No productions yet — ask your director to cast you."

### Create Production / Upload & Import

Unchanged from Phase 1 — Admin-only import with line-level error reporting.

### Timeline Review (read-only baseline)

Moments listed in sequence order; click row → read-only detail in a `Sheet`.

---

## Slice 2 Screens (Phase 2)

### Characters (Preparation)

* Table: name, scene count, assigned actor.
* **Director/Admin:** cast dropdown (Actor users only), manual add character.
* **Actor:** read-only actor column for their cast characters.

### Groups (Preparation — Director/Admin)

* Create named groups (Ensemble, Trio, etc.).
* Edit members: checkbox lists for **characters** and **actors** (uncast ensemble members).
* Member counts shown on each group card.

### Timeline (rehearsal view)

**Filters (above moment list):**

| Control | Behavior |
| --- | --- |
| Act / Scene | Navigate structure; act label avoids duplicate "Act 1: Act 1" |
| Group (Director+) | Filter to group's character members; disables character filter |
| Character | All / My characters / single character; includes stage directions referencing that name |
| Search | Scene-scoped substring match; submit on Enter |
| Cue-only | Stage directions, song headers, and moments with attached technical cues |

**Moment list:**

* Sequence number, truncated text, type badge.
* Optional **Prop** / **Cue** outline badges when attachments exist.
* Highlighted rows (blue left border) for filtered character dialogue and referenced stage directions.
* Click row → moment detail sheet.

**Moment detail sheet:**

* Full **original text** (always read-only — sacred script).
* **Bookmark** icon button (lucide `Bookmark`; filled when active).
* **Notes** list + add form; Director/Admin can choose public/private visibility.

**Bookmarks (user menu):**

* List of saved moments with production title and preview text.
* Deferred: dedicated timeline-like bookmarks view (see [PROJECT.md](PROJECT.md) Wish List).

---

## Slice 3 Screens (Phase 3)

### Songs (Preparation)

* Table: title, composer, lyricist.
* **Director/Admin:** add song, edit metadata (composer, lyricist, description).
* **Actor:** read-only list.
* Songs can be linked to moments from the timeline moment sheet.

### Props (Preparation)

* Table: name, description, notes.
* **Director/Admin:** CRUD prop catalog.
* Attach props to moments from the timeline moment sheet (optional carrier character, notes).

### Cue Categories (Preparation — Director/Admin)

* Table: name, description.
* CRUD categories (Lighting, Sound, etc.).
* Cues are added per-moment from the timeline moment sheet.

### Timeline editing (moment sheet — Director/Admin)

Edit through the side panel; timeline list stays visible.

| Section | Editable fields |
| --- | --- |
| Moment fields | Type, linked song, parsed text |
| Stage direction | Direction text (when moment has stage direction) |
| Dialogue | Speaker (character dropdown per line) |
| Props | Attach / detach; carrier character; notes |
| Cues | Add / delete; category, title, notes |

**Actor:** all Slice 3 data is read-only except notes (private) and bookmarks.

**Additional timeline filters (Slice 3):**

| Control | Behavior |
| --- | --- |
| Song | Filter to moments linked to selected song |
| Prop (Director+) | Filter to moments with prop attached |
| Cue category (Director+) | Filter to moments with cue in category |

---

## Components

Use shadcn/ui throughout ([DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md)):

| Need | Component |
| --- | --- |
| Production list | `Table` |
| Forms | `Input`, `Button`, native `select` |
| File upload | `Input type="file"` + `Button` |
| Errors | bordered alert div (destructive colors) |
| Timeline rows | scrollable list + custom row |
| Moment type badge | `Badge` |
| Prop/Cue indicator | `Badge variant="outline"` |
| Side panel | `Sheet` |
| Bookmark toggle | `Button` (icon-sm) + lucide icon |
| Navigation | sidebar `nav` links |

---

## Role-Based UI (Slice 3)

| Element | Admin | Director | Actor |
| --- | --- | --- | --- |
| New Production | Yes | Hidden | Hidden |
| Import | Yes | Hidden | Hidden |
| User management | Yes | Hidden | Hidden |
| Casting controls | Yes | Yes | Hidden |
| Groups / Cue Categories | Yes | Yes | Hidden |
| Songs / Props catalog edit | Yes | Yes | Hidden (read-only) |
| Timeline content editing | Yes | Yes | Hidden |
| Timeline filters | All + song/prop/cue | All + song/prop/cue | All + song (no group/prop/cue category) |
| Public notes on moments | Yes | Yes | Hidden (private only) |
| Bookmarks | Yes | Yes | Yes |

---

## Responsive Notes

* Timeline filters stack on mobile; moment list scrolls independently.
* Moment detail sheet slides from bottom on small screens, right side on large screens.
* Sidebar collapses to hamburger menu on small screens.

---

## Deferred to Later Slices

* Timeline structural editing (add/delete/reorder/split/merge moments) — Phase 4
* Live search (filter as you type)
* Multi-select character filter
* Bookmarks dedicated view
* Production home page
* Saved filter views / rehearsal modes
* Preparation progress dashboard
* Costumes, microphones, blocking, entrances, exits
