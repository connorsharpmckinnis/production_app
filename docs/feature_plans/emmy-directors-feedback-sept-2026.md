# Feature plan — Emmy / stage directors feedback (Sept 2026)

**Status:** Roadmap (active pilot feedback)  
**Created:** 2026-10-18  
**Context:** Live walkthrough with Emmy and stage directors while Scrooge is in limited rehearsal use. Issues [#182](https://github.com/connorsharpmckinnis/production_app/issues/182)–[#196](https://github.com/connorsharpmckinnis/production_app/issues/196).

---

## Goal

Respond to director/SM feedback with **general-value** improvements to Timeline prep, casting clarity, rehearsal planning, and progress tracking — useful for any production, not Scrooge-specific workarounds for partial adoption.

---

## Principles

- Prefer changes that help every show’s director/SM workflow.
- Do not redesign around Scrooge’s incomplete data or limited role usage.
- Ship in small vertical slices; park larger “smart” features until core edit/plan flows feel solid.
- [#183](https://github.com/connorsharpmckinnis/production_app/issues/183) is a duplicate of [#185](https://github.com/connorsharpmckinnis/production_app/issues/185).

---

## Intended improvements (high level)

### Casting & catalogs

- Make character cleanup (delete + reassign Timeline attributions) reliable.
- Show who is cast when looking at group membership, not only character names.

### Timeline prep

- Edit and reassign Moment actions after they are added (notes, move to another Moment, etc.).
- Add actions for several people/characters at once.
- Support working backwards (e.g. exits before entrances) with clearer onstage cues.
- Let Prep Badges filter by action type instead of one blunt toggle.
- Keep Reports’ onstage bars continuous through an act/show when someone never exits.

### Rehearsal builder & call sheets

- Faster cast picking (select all / deselect individuals).
- Longer notes on each rehearsal time block.
- Collapsible blocks so a full rehearsal is glanceable (call-sheet mental model).
- Fix print/call-sheet layout when many people are called.
- On Complete, confirm which targeted pieces actually finished before incrementing progress.

### Progress tracking (Emmy’s spreadsheet ask)

- Target specific scenes, songs, and choreo (music vs choreo where useful) in the rehearsal builder.
- Track blocked/taught progress independently and report what has been covered.

### Later / nice-to-have

- Suggest entrances/exits from upcoming lines (“imminence” helper) after core Timeline editing is solid.

---

## Suggested work order

| Slice | Themes | Issues |
| ----- | ------ | ------ |
| Day 1 | Casting polish | #188, #189 |
| Day 2–3 | Timeline edit & bulk add | #185 (+ #183), #184, #186 |
| Day 4 | Timeline / report visibility | #187, #190 |
| Day 5–6 | Rehearsal builder + print | #196, #194, #192, #195 |
| Day 7 | Honest completion | #193 |
| Days 8–9 | Song/scene/choreo tracking | #182 |
| Later | Suggestion engine | #191 |

---

## Non-goals

- Scrooge-only data migrations or one-off import fixes as product features.
- Large scheduling/attendance product (see parked plans elsewhere).
- Replacing the full spreadsheet workflow in one change — track coverage first, then deepen reports.
