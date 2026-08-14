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

* Table of productions (title, season, status, created date).
* **Admin:** "New Production" button; Delete action (icon; stops row navigation).
* **Row click:** the whole row opens the production (or Import for unimported admin rows). Use a chevron affordance, not a separate Open button.
* **Actor empty state:** "No productions yet — ask your director to cast you."

### Lists & selection

* Prefer **full-row click targets** for opening or selecting an object (productions, timeline moments, etc.). People expect “click anywhere on this row.”
* Keep keyboard support (`Enter` / `Space` or a real link) and a visible hover state.
* Icon / destructive / secondary actions on the row must `stopPropagation` so they do not also trigger open/select.
* Do not rely on a lone text “Open” button as the primary way into an object when a row already represents that object.

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
| Group (Director+) | Filter to group's character members; disables character multi-select and clears character ids |
| Character | Multi-select (OR within this filter). Empty = all characters. **My characters** pre-checks the actor's cast ids (hidden if none). Mutually exclusive with group. Includes stage directions referencing those names |
| Search | Scene-scoped substring match; live debounce (~275ms) plus Enter / Search to commit immediately. Empty/whitespace clears immediately |
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
| Forms | `Input`, `Label`, `Textarea`, `Button`, `Select` / `SearchableSelect` |
| Toggles | `Checkbox`, `Switch`, `RadioGroup` |
| File upload | `Input type="file"` + `Button` |
| Feedback / errors | `Alert` (`info`, `success`, `warning`, `destructive`) |
| Timeline rows | scrollable list + custom row |
| Moment type badge | `Badge` |
| Prop/Cue/Mic/Set/Costume indicator | `Badge variant="outline"` |
| Side panel | `Sheet` |
| Bookmark toggle | `Button` (icon-sm) + lucide icon |
| Navigation | sidebar `nav` links |
| Toasts | `ToastProvider` / `useToast` |
| Component review | Admin `/dev/ui` gallery |

### Data tables

* Columns are resizable from the right edge of each column header. Keyboard users can focus the resize separator and use the left/right arrow keys.
* Column widths persist in local browser storage for that table.
* Cell and header content truncates when it exceeds the column width. Hovering truncated content for 500 ms shows the full value.
* Tables remain horizontally scrollable when their resized columns exceed the available page width.

Semantic action colors:

* Default/primary — normal actions and navigation.
* Success — positive confirmations and completed actions (`Button` / `Badge` `variant="success"`).
* Info — contextual notices that are neither positive nor warnings.
* Warning — cautionary states that need review.
* Destructive — dangerous, failed, or irreversible actions.
* Use semantic tokens (`info`, `success`, `warning`, `destructive`) rather than hard-coded color utilities so every palette supplies its own color.

---

## Role-Based UI (Slice 3)

| Element | Admin | Director | Actor |
| --- | --- | --- | --- |
| New Production | Yes | Hidden | Hidden |
| Import | Yes | Hidden | Hidden |
| User management | Yes | Hidden | Hidden |
| Casting controls | Yes | Yes | Hidden |
| Groups / Cue Categories | Yes | Yes | Hidden |
| Costumes / Set Pieces catalog | Yes | Yes | Read-only |
| Lav chart (wires/packs) | Yes | Yes | Hidden (Director/Admin) |
| App Settings | Yes | Hidden | Hidden |
| Reports | Yes | Yes | Hidden |
| Songs / Props catalog edit | Yes | Yes | Hidden (read-only) |
| Timeline content editing | Yes | Yes | Hidden |
| Structural editing (add/delete/reorder) | Yes | Yes | Hidden |
| Timeline filters | All + song/prop/cue/mic/set/costume | All + song/prop/cue/mic/set/costume | All + song (no group/prep filters) |
| Public notes on moments | Yes | Yes | Hidden (private only) |
| Bookmarks | Yes | Yes | Yes |

---

## Responsive Notes

* Timeline filters stack on mobile; moment list scrolls independently.
* Moment detail sheet slides from bottom on small screens, right side on large screens.
* Sidebar collapses to hamburger menu on small screens.

---

## Slice 4 (Phase 4 — shipped)

* Moment detail auto-save on blur; flush pending saves on panel close
* Parsed-data correction collapsed behind pencil toggle; global App Settings for original/parsed text visibility
* Prose-like timeline rows with optional dialogue character column
* Structural editing: insert (inline form), delete (confirm), move up/down
* Prep catalog pages: Costumes (scene+character), Set Pieces; Lav chart for wires/packs
* Moment detail sections for set pieces (mirror props); lav change Moments are a Phase 13 follow-on
* Timeline filters: microphone, set piece, `costume_only` checkbox
* Reports page: prop sheet, cue sheet, costumes-by-scene
* Administration sidebar section (Users, App Settings)

---

## Slice 5 (Phase 5 — shipped)

* Moment-attached entrances, exits, and blocking (Director/Admin write; all roles read)
* Timeline filters: `entrance_only`, `exit_only`, `blocking_only`; list-row badges
* Production overview page at `/productions/:id` with counts and quick links
* Reports: entrance/exit sheet and blocking sheet

---

## Slice 6 (Phase 6 — shipped)

* **Rehearse page** at `/productions/:id/rehearse` — all roles; sidebar nav above Timeline
* Client-side practice presets: Scene run-through, My lines, Line cues (zero API refetch on preset change)
* Rehearse display toggles: highlight my lines, stage directions, lyrics/songs, prep badges, blur my lines
* `sessionStorage` persistence for Rehearse controls per production
* **Scene summary strip** — client-side character/song chips and props-used count below act/scene selectors (Timeline + Rehearse)
* Shared `TimelineMomentList` — full-row click targets, keyboard accessible, shared highlight styles
* Timeline **Advanced filters** disclosure for director prep controls; cue-only checkbox removed; Sheet on small screens
* Timeline **live search** (debounce ~275ms; Enter commits immediately) and **multi-select character filter** (OR within characters; AND with other filters). Rehearse has live search only
* Moment detail: **Imported data** label; **Add to moment** menu; on-stage block removed; irrelevant fields hidden
* **Theme** — light/dark/system plus Warm and Stage palette presets (Settings + user menu); tokens in `index.css`

---

## Deferred to Later Slices

* Multi-select prop / cue filters
* Bookmarks dedicated view
* Saved filter views / rehearsal modes
* Preparation progress dashboard
* Split/merge moments
* Costume **pieces / outfits** (whole-costume Wear/Clear events already shipped in Phase 14)
