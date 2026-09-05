# Object detail pages

**Status:** Shipped (v1 — 2026-09-02)  
**Created:** 2026-09-02  
**Shipped:** 2026-09-02  
**Related:** [scene-summary-drill-down.md](../feature_plans/scene-summary-drill-down.md) (remaining Layer F follow-ons), [in-play-moment-deep-links.md](in-play-moment-deep-links.md), Moment Detail Sheet

---

## Goal

Ephemeral **object detail Sheet** + consistent **ObjectLink** affordance so users can quick-look (and light-edit) catalog / domain objects without leaving Timeline, lists, or reports — and without inventing new navbar destinations.

---

## What shipped (v1)

### Host

- `ObjectDetailProvider` + `ObjectDetailHost` mounted from AppShell
- One sheet at a time; opening another **replaces** after dirty guard (no stack/breadcrumbs yet; API leaves room for `pushDetail` later)
- Explicit **Save / Discard**; three-way unsaved dialog (Save / Discard / Keep editing)
- Capability-gated: no `read` → plain text; `update` → editable footer
- Shared Moment-like resize width (`useDetailPanelWidth`)
- Sheet body scrolls independently; Save/Discard stay pinned in a bottom footer section (2026-09-04)

### ObjectLink

- Secondary rounded chip + square-arrow icon
- `stopPropagation` so Timeline rows / cards don’t also activate
- Optional context: `momentId` (cues), `sceneId` / `sceneLabel` / `sceneEndMomentId` (Character scene filter)

### Panels

| Type | Edit | Notes |
| ---- | ---- | ----- |
| Character | description | Scene filter section when opened from scene summary |
| Prop | name, description, notes | |
| Song | composer, lyricist, description (title read-only) | |
| Set piece | name, mobile, description | |
| Costume | name, character, description | |
| Group | name, description | Members listed; membership still on Groups page |
| Cue | title, category, notes | Moment-scoped (`momentId` required) |
| Person | production roles | Cast characters as ObjectLinks |
| Cue category | name, description | |

### Surfaces wired

- Catalog lists (Characters, Props, Songs, Set pieces, Costumes, Groups, People, Cue categories)
- Timeline **scene summary** character + song chips (speakers on moment rows stay plain text on purpose)
- Moment Detail: entrances/exits, blocking (character/group), dialogue/lyrics speakers, props/sets/costumes, cues, song title
- Reports + On-stage chart labels where IDs exist

### Layer F (first slice)

Character chips on the scene summary strip pass scene context. The Character sheet shows **In {scene}**:

- Entrances/exits (when `reports:read`)
- On stage at end of scene + props / set pieces / costume held (when `timeline:read`, via last moment in the section)

---

## Code entry points

- `frontend/src/lib/objectDetail.ts`
- `frontend/src/context/ObjectDetailContext.tsx`
- `frontend/src/components/object-detail/*`
- Consumers: `SceneSummaryStrip`, `MomentDetailPanel`, catalog pages, Reports, etc.

---

## Explicitly deferred / follow-ons

See also [scene-summary-drill-down.md](../feature_plans/scene-summary-drill-down.md).

| Item | Notes |
| ---- | ----- |
| Named **prop chips** on scene summary | Strip still shows prop *count*; needs prop IDs in summary derivation |
| Scene filters for Prop / Group / others | Host already accepts `sceneId`; panels not built |
| Sheet **stack** / breadcrumbs | Replace-only by design in v1 |
| URL sync (`?detail=`) | Share/refresh |
| Migrate **Moment Detail** onto the same host | After host feels solid |
| Lav **wire/pack** ObjectDetail | Lav chart owns that UX |
| Hover-card “peek” | Click-open only in v1 |
| Clear Character description via `null` PATCH | Pre-existing API quirk (`description is not None`) |

---

## Manual check (v1)

1. Timeline → scene summary character chip → sheet opens with scene block + Save/Discard when allowed  
2. Dirty close / replace → unsaved dialog  
3. Characters / Props list names → ObjectLink → edit round-trip  
4. User without `characters:read` → plain text (no chip)  
5. Moment entrance card character name → ObjectLink replaces sheet  
6. Timeline dialogue speaker column stays non-linked  
