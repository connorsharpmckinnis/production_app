# UI Standards (Phase 1 — Slice 1)

**Version:** 0.1

Minimum UI conventions for the first vertical slice: create production → upload script → import → review timeline.

Product context: [PROJECT.md](PROJECT.md). Role visibility: [ROLES.md](ROLES.md).

---

## App Shell

```
┌─────────────────────────────────────────────────────────┐
│ Header: Theater App          [User menu]                │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │ Main content area                            │
│ (nav)    │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

* **Sidebar:** Collapsible on mobile. Shows only items the current role may access.
* **Header:** App name, production context (when inside a production), user menu (logout, profile).
* **Main content:** One primary task at a time for Slice 1.

Slice 1 sidebar items:

* Productions (list)
* Settings (Admin only — user management stub)

---

## Slice 1 Screens

### 1. Production List

* Table or card list of productions (title, season, created date).
* **Admin:** "New Production" button.
* **Director / Actor:** No create button. Directors see productions they can edit; Actors see productions they are cast in (Phase 1: may show all productions read-only for testing until casting exists in Phase 2).

### 2. Create Production Form

Fields: title, season (optional).

Submit → production detail / upload screen.

### 3. Upload & Import (Admin only)

* File picker accepting `.md` only.
* "Import Script" button.
* On success → Timeline Review.
* On failure → error panel:

  ```
  Import failed at line 200
  Line content: "Therefore, since we are surrounded..."
  Reason: Unrecognized format
  ```

* No partial timeline shown after failure.

### 4. Timeline Review (primary screen)

The main view after import.

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ Act 1 › Scene 1 — Welcome to the Age of Adventure       │
├─────────────────────────────────────────────────────────┤
│ [Scrollable moment list]                                │
│                                                         │
│  1  *LIGHTS UP on a haggard trio...*     stage dir     │
│  2  CREAN: This is the edge...           dialogue       │
│  3  WORSLEY: – That'll take...           dialogue       │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**

* Moments listed in `sequence_number` order within the selected scene.
* Each row shows: sequence number, original text (truncated), moment type badge.
* Click moment → read-only detail in a side panel (Slice 1); editing deferred to later slices.
* Act/Scene selector at top (dropdown or tabs) to navigate structure.
* **Actor:** Same view, read-only. No edit controls.
* **Director:** Read-only in Slice 1 (editing in later slices).

**Not in Slice 1:**

* Side-panel editing
* Search
* Character highlighting
* Preparation progress dashboard

---

## Components

Use shadcn/ui throughout ([DEVELOPMENT_GUIDE](../.agents/skills/DEVELOPMENT_GUIDE/SKILL.md)):

| Need | Component |
|---|---|
| Production list | `Table` or `Card` |
| Forms | `Form`, `Input`, `Button` |
| File upload | `Input type="file"` + `Button` |
| Errors | `Alert` (destructive variant) |
| Timeline rows | `ScrollArea` + custom row |
| Moment type badge | `Badge` |
| Side panel | `Sheet` (read-only detail) |
| Navigation | `Sidebar` or simple `nav` links |

---

## Role-Based UI (Slice 1)

| Element | Admin | Director | Actor |
|---|---|---|---|
| New Production button | Yes | Hidden | Hidden |
| Upload / Import | Yes | Hidden | Hidden |
| User management nav | Yes | Hidden | Hidden |
| Timeline view | Yes | Yes | Yes (read-only) |
| Edit controls on timeline | Hidden (Slice 1) | Hidden (Slice 1) | Hidden |

---

## Responsive Notes

* Timeline list must scroll on mobile; act/scene selector stacks above the list.
* Sidebar collapses to hamburger menu on small screens.

---

## Deferred to Later Slices

Documented here to avoid re-deciding later:

* Timeline inline editing (Slice 2+)
* Character filter / actor view (Slice 2)
* Side panel create/edit for entities (Slice 2+)
* Search bar on timeline (Slice 2)
* Preparation progress UI (post-MVP)
