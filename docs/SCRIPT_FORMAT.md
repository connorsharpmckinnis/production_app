# Theater App Script Format

**Version:** 0.2

This document defines the **Theater App Standard Script Format** — the default format scripts are expected to follow when imported into Theater App.

Companion documents:

* [PROJECT.md](PROJECT.md) — product vision and import philosophy
* [DATABASE.md](DATABASE.md) — schema, including `moment_types` lookup table

The goal is not to capture every possible way a playwright might write a script. The goal is to give writers a clear, consistent set of rules so that a script can be imported faithfully into the production Timeline (Acts → Scenes → Moments) without guesswork.

**MVP import source:** Markdown (`.md`) files, typically exported from Google Docs via **File → Download → Markdown**. The export uses markdown headings and link syntax; see [IMPORT_SPEC.md](IMPORT_SPEC.md) for how the importer reads it. [SCRIPT_FORMAT.md](SCRIPT_FORMAT.md) describes authoring intent.

---

## Design Principles

1. **Plain text first.** Scripts should be readable and editable in any text editor. Rich-text styling (italics, bold) is represented with simple markers, not proprietary formatting.
2. **Structure through convention, not tags.** Acts, scenes, dialogue, and songs are identified by predictable line patterns — not XML, JSON, or Fountain-style markup.
3. **The imported text is sacred.** The format preserves the author's words. Production metadata (blocking, cues, casting) is layered on later; it does not belong in the script file.
4. **One moment per beat.** Each distinct production beat — a block of stage direction, a line of dialogue, a lyric line — becomes one Moment on the Timeline. Blank lines separate Moments.
5. **Markdown-friendly.** Stage directions use `*asterisk*` italics so the script renders cleanly in the MVP app without Word-style formatting.

---

## Document Hierarchy

A script is organized top-down:

```
Production Script
├── Title Page (metadata)
├── Act
│   ├── Scene
│   │   ├── Moment (stage direction)
│   │   ├── Moment (dialogue)
│   │   ├── Moment (song section)
│   │   └── ...
│   └── Scene
└── Act
```

| Level | What it is | How it appears in the file |
|-------|-----------|---------------------------|
| **Title page** | Show metadata (title, author) | Labeled lines at the top of the file |
| **Act** | Major structural division (intermission break, story arc) | Heading line |
| **Scene** | Continuous unit of action in one time/place | Heading line |
| **Moment** | Smallest timeline unit — one beat of the production | A paragraph, dialogue line, or lyric line |

Everything between an Act heading and the next Act heading belongs to that Act. Everything between a Scene heading and the next Scene or Act heading belongs to that Scene.

---

## Title Page

The first lines of the script carry basic metadata. These are imported and stored, but are not part of the performance Timeline.

### Format

```
Title: {Show Title}
Author: {Author Name}
```

### Rules

- Each field on its own line.
- `Title:` and `Author:` are literal prefixes (capital letter, colon, space).
- Additional metadata fields may be added in future versions.
- Leave one blank line after the title page before `Act 1`.

### Example

```
Title: Shackleton's Antarctic Adventure
Author: Jane Smith

Act 1
```

---

## Acts

### Format

```
Act {Number}
```

### Rules

- **Number** is a digit: `1`, `2`, `3`, etc.
- Acts are **number-only** — no act titles.
- The Act heading stands alone on its own line.
- Leave one blank line after the Act heading before the first Scene.

### Import tolerance

The importer accepts word-form numbers (`Act One`) and converts them to digits as a fallback. The standard format expects digits; word forms are a convenience for legacy scripts.

### Examples

```
Act 1

Scene 1 - Welcome to the Age of Adventure
```

```
Act 2
```

---

## Scenes

### Opening Format

```
Scene {Number} - {Title}
```

### Closing Format (optional, not imported)

```
End of Scene {Number}
```

Writers may include scene end markers as a human-readable convenience while drafting. The importer **ignores** end markers — scene boundaries are determined by the next Scene or Act heading.

### Rules

- **Number** is a digit: `1`, `2`, `3`, etc.
- **Title** is required. Separate number and title with ` - ` (space, hyphen, space).
- A Scene heading always appears after its parent Act (or after the previous scene's content).
- Leave one blank line after the Scene heading before the first Moment.

### Import tolerance

Word-form scene numbers (`Scene One`) are accepted and converted to digits on import.

### Examples

```
Scene 1 - Welcome to the Age of Adventure

*LIGHTS UP on a haggard trio...*

CREAN: This is the edge of the glacier.
```

```
*The whole cast takes their bows.*

End of Scene 6
```

The end marker above is fine for the writer's reference. It will not create a Moment or affect import structure.

---

## Moments

A **Moment** is the atomic unit of the production Timeline. In the script file, each Moment is one logical beat.

### What counts as one Moment

| Moment type | Source in script |
|-------------|-----------------|
| Stage direction | One prose paragraph (may contain multiple sentences) |
| Dialogue | One `CHARACTER:` line (delivery parentheticals stay inline) |
| Extracted action | An action parenthetical pulled out of a dialogue line on import (see Dialogue) |
| Song header | The song title line (including any parenthetical) |
| Song attribution | One performer line (e.g. `ALL`, `VERA & MOM`) |
| Lyric line | One line of lyrics |

### Separation rules

- **One blank line** between Moments.
- Do not put multiple dialogue lines on the same line.
- Do not combine a stage direction paragraph and a dialogue line without a blank line between them.
- A multi-sentence stage direction that describes one continuous beat stays in **one paragraph** (one Moment). Start a new paragraph (new Moment) when the beat changes — e.g. a new physical action, a shift in mood, or a new music cue.

### Example sequence

```
*Adventurous music (Into the Deep?) plays quietly underneath the dialog, building up and eventually freezing on 'Tom. Danger. Crean.'*

CREAN: This is the edge of the glacier. The station is near the bottom. We're coming from above. We can cut back and hike around –

WORSLEY: – That'll take nearly two days.

SHACKLETON: What's at the bottom of the glacier?
```

---

## Stage Directions

Stage directions describe action, setting, mood, sound, music, lighting, and transitions. They are **not** spoken dialogue.

Entrances and exits are **not** managed as a separate script construct at import time. Any entrance or exit described in the imported script is written as a normal stage direction. Formal entrance/exit tracking is added later inside Theater App during production preparation.

### Format

- Written as a prose paragraph.
- Wrapped in *italics* using Markdown asterisks: `*...*`
- Song or music titles referenced in stage directions use **title case** in quotes or parentheses, as natural in prose.

### Character references in stage directions

Character names may appear in stage directions so actors can find relevant moments in a **"My Stuff"** view (Timeline filtered to moments referencing their character).

- **Recommended:** Write character names in **ALL CAPS** when you want an explicit link to that Character (e.g. `SHACKLETON breaks out of the freezing`).
- **Not required:** Mixed-case names in prose (e.g. "Worsley looks up") are still valid stage direction text. During import, the parser matches known Character names where it can, but ALL CAPS references are the reliable way to guarantee a link.
- When referring to multiple characters, use natural English joining: `SHACKLETON, WORSLEY, and CREAN`.

### Rules

- Stage directions never use the `CHARACTER:` dialogue pattern.
- A stage direction paragraph may be one sentence or several, as long as it describes one continuous beat.
- Sound and music cues are written inline as part of the prose — not on a separate tagged line.
- Do not use entrance/exit shorthand (`ENTER SHACKLETON`, `EXEUNT`, etc.). Describe entrances and exits in prose.

### Examples

```
*LIGHTS UP on a haggard trio standing at the edge of the stage or platform, looking down into the yawning depths below. SHACKLETON, WORSLEY, and CREAN look tired beyond belief and unsure what to do next.*
```

```
*Adventurous music (Into the Deep?) plays quietly underneath the dialog, building up and eventually freezing on 'Tom. Danger. Crean.'*
```

```
*Flashback bubble transition music. MOM and VERA walk and sing together. MOM looks increasingly sorrowful, but VERA supports her and tries to lend her some strength and trust.*
```

```
*During Age of Adventure / Us Who Travel, the crew reunite with their loved ones back home. WILD and VERA embrace, followed by SHACKLETON and MOM, who hugs her son and then pulls back to eyes him with a tough-to-perform mix of joy, hope, and weariness.*
```

---

## Dialogue

Dialogue is spoken text attributed to a character.

### Format

```
{CHARACTER}: {text}
```

For multiple characters speaking together:

```
{CHARACTER}, {CHARACTER}, and {CHARACTER}: {text}
```

### Rules

- **Character name** is ALL CAPS.
- A **colon and space** (`: `) follow the character name.
- Everything after the colon is dialogue text, in normal sentence case.
- One line of dialogue = one Moment (after parenthetical extraction; see below).
- A character name may include hyphens, spaces, or other punctuation as part of the name (e.g. `ORDE-LEES`, `VERA`).

### Parentheticals (wrylies)

Dialogue lines may contain parentheticals. There are two kinds, handled differently on import:

| Type | Purpose | Examples | On import |
|------|---------|----------|-----------|
| **Delivery** | How the line is performed — tone, emotion, intent | `(Getting suspicious)`, `(Figuring it out)`, `(With a gleam in his eye)` | Stays inline in the dialogue Moment |
| **Action** | What happens on stage — movement, exits, reactions | `(as they leave)`, `(Worsley looks up to heaven)` | Extracted to a separate stage direction Moment |

**Writer guidance:** When you can, put action in its own stage direction line instead of embedding it in dialogue. This keeps the script unambiguous and avoids relying on the importer to split lines.

```
SHACKLETON: Okay, you guys are good. Go get changed and get ready for Age of Adventure.

*As they leave.*

SHACKLETON: Let's give it up for Worsley and Crean, everybody!
```

Action parentheticals embedded in dialogue are still valid. The importer extracts them into adjacent stage direction Moments and links any character references it finds.

### Interruptions and overlaps

When one character cuts off another, the interrupted line may trail off and the interrupting line may begin with an em dash:

```
CREAN: We can cut back and hike around –

WORSLEY: – That'll take nearly two days.
```

The em dash at the start of the second line signals continuation/interruption. Both lines are separate dialogue Moments.

### Group lines

When multiple characters speak the same line in unison, list all names before the colon:

```
SHACKLETON, WORSLEY, CREAN: – another presence, as though Providence himself walked with us.
```

The importer treats each name as a participant in the same dialogue Moment.

### Examples

```
CREAN: This is the edge of the glacier. The station is near the bottom. We're coming from above. We can cut back and hike around –

WORSLEY: – That'll take nearly two days.

SHACKLETON: What's at the bottom of the glacier?

WORSLEY: No one's ever mapped it out.

CREAN: Could be smooth packed snow, could be ice crevasses, could drop straight into the ocean.

WORSLEY: (Getting suspicious) Sir, what are you thinking?

SHACKLETON: We don't have two days. We need to get somewhere safe before nightfall.

CREAN: How will we climb down a thousand yards of sheer glacier before nightfall?

WORSLEY: (Figuring it out) No. No, no no no –

SHACKLETON: (With a gleam in his eye, interrupting Worsley) Abigail. Danger. Worsley.

*Worsley looks up to heaven.*

SHACKLETON: Tom. Danger. Crean. Who's up for some sledding?
```

The last example shows the preferred pattern: delivery parenthetical stays inline; action is a separate stage direction.

---

## Songs and Lyrics

Songs are distinct sequences within a scene. A song block has three parts: **title**, **performer attribution**, and **lyrics**.

### Song title line

```
{SONG TITLE} ({optional instance label})
```

### Rules for titles

- Written in ALL CAPS.
- The parenthetical is **part of the song title**, not a separate field. It identifies which *instance* of a song this is within the production.
- Use `(REPRISE)`, `(PRE-PRISE)`, `(VERSE 2)`, or a **number** when the same song appears multiple times in fragments: `US WHO TRAVEL (2)` is the second time that song appears — functionally similar to `(REPRISE)` but numbered for shows that reuse songs in many small pieces.
- The full title line (including parenthetical) is one Song record and one Moment.

### Performer attribution line

```
{PERFORMER}
```

### Rules for performers

- Stands on its own line, immediately after the title (or after a blank line following the title).
- `ALL` for full-cast numbers.
- Single character: `SHACKLETON`
- Multiple characters: `VERA & MOM`
- The performer line is its own Moment.
- Repeat the performer line when a new section of the song begins with different singers (see example below).

### Lyric lines

- Each lyric line is written in ALL CAPS on its own line.
- One lyric line = one Moment.
- Punctuation and ellipses are preserved as written.

### Full song example

```
INTO THE DEEP (PRE-PRISE)

ALL

INTO THE DEEEEEEEEEP

INTO THE DEEEEEEEEEP

BUTT SLEDDING DOWN GLACIERS STEEP

WE GOOOO… INTO THE DEEP
```

### Numbered instance example

```
US WHO TRAVEL (2)

VERA & MOM

O GOD WHOSE GLORY FILLS CREATION,

AND WHO'S PRESENT IN EVERY SITUATION

FROM MOUNTAIN HIGH TO VALLEY SEA AND SHORE

REMAIN BESIDE US NOW AND EVERMORE

VERA & MOM

PRESERVE THOSE WHO TRAVEL, GUARD THEM NIGHT AND DAY

SURROUND THEM WITH YOUR LOVE ALONG THE WAY

PROTECT THEM FROM EACH DANGER, BRING THEM HOME AGAIN

IN SAFETY TO THEIR JOURNEY'S END – AMEN
```

`US WHO TRAVEL (2)` and `US WHO TRAVEL (REPRISE)` are both valid instance labels. Use whichever is clearer for the production. The number form is preferred when a song appears many times in small sections.

### Songs embedded in stage directions

When characters "walk and sing together" or otherwise perform a song as part of staged action, the stage direction describes the action (*MOM and VERA walk and sing together.*) and the song lyrics follow as a separate song block. Do not put lyrics inside a stage direction paragraph.

---

## Character Names

### Rules

- Character names are **ALL CAPS** in dialogue attribution (`CREAN:`, `SHACKLETON, WORSLEY, CREAN:`).
- Use a single consistent spelling throughout the script. The importer uses dialogue appearances to build the Character list.
- Hyphenated names, multi-word names, and titles are allowed: `ORDE-LEES`, `VERA`, `SHACKLETON`.
- In stage directions, ALL CAPS is recommended when you want a guaranteed Character link for actor filtering. Mixed case is acceptable in prose.

### First appearance

There is no special "introduction" syntax. A character is identified by their first dialogue line or first mention in a stage direction.

---

## Author Notes

Notes to the writer, director, or production team — information that is **not** part of the performance text — use a `Note:` prefix:

```
Note: The stage directions in the document are italicized.
```

### Rules

- Begin the line with `Note:` (capital N, followed by colon and space).
- Author notes may be wrapped in *italics* like stage directions.
- Author notes are imported as Moments but flagged as non-performance text so they can be hidden from actor-facing views.

---

## Typography Summary

| Element | Casing | Emphasis | Line pattern |
|---------|--------|----------|-------------|
| Title page fields | Sentence case value | None | `Title: ...` / `Author: ...` |
| Act heading | Title case label + digit | None | `Act 1` |
| Scene heading | Title case label + digit | None | `Scene 1 - Title` |
| Scene end marker | Title case | None | `End of Scene 6` (ignored on import) |
| Stage direction | Sentence case | *Italics* | `*prose paragraph*` |
| Character name (dialogue) | ALL CAPS | None | Before colon |
| Character name (stage direction) | ALL CAPS recommended | Inside `*italics*` | For explicit Character links |
| Dialogue text | Sentence case | None | After `CHARACTER: ` |
| Delivery parenthetical | Sentence case | None | `(inline in dialogue)` |
| Song title | ALL CAPS | None | Own line, parenthetical included |
| Performer attribution | ALL CAPS | None | Own line |
| Lyric line | ALL CAPS | None | Own line |
| Author note | Sentence case | *Italics* (optional) | `Note: ...` |

---

## Blank Lines and Whitespace

- Use **Unix line endings** (LF). Avoid trailing spaces on lines.
- Separate Acts, Scenes, and Moments with exactly **one blank line**.
- Do not use multiple consecutive blank lines.
- Indentation is not meaningful. Do not indent dialogue or stage directions.

---

## What Does Not Belong in the Script

The following production information is managed inside Theater App, not in the script file:

- Casting / actor assignments
- Blocking coordinates or stage positions
- Prop lists and handoff notes
- Formal entrance/exit records (beyond prose descriptions in stage directions)
- Lighting, sound, or fly cues (beyond inline music/sound references in stage directions)
- Rehearsal notes
- Page layout, font choices, or PDF formatting

---

## Complete Mini-Example

Below is a short contiguous excerpt demonstrating most rules together:

```
Title: Shackleton's Antarctic Adventure
Author: Jane Smith

Act 1

Scene 1 - Welcome to the Age of Adventure

*LIGHTS UP on a haggard trio standing at the edge of the stage or platform, looking down into the yawning depths below. SHACKLETON, WORSLEY, and CREAN look tired beyond belief and unsure what to do next.*

*Adventurous music (Into the Deep?) plays quietly underneath the dialog, building up and eventually freezing on 'Tom. Danger. Crean.'*

CREAN: This is the edge of the glacier. The station is near the bottom. We're coming from above. We can cut back and hike around –

WORSLEY: – That'll take nearly two days.

SHACKLETON: What's at the bottom of the glacier?

INTO THE DEEP (PRE-PRISE)

ALL

INTO THE DEEEEEEEEEP

INTO THE DEEEEEEEEEP

BUTT SLEDDING DOWN GLACIERS STEEP

WE GOOOO… INTO THE DEEP

*SHACKLETON, WORSLEY, and CREAN take one last look at each other, grab hands, and slo-mo leap into the air as though to butt-sled down the glacier. After they freeze, SHACKLETON breaks out of the freezing.*

SHACKLETON: Okay, you guys are good. Go get changed and get ready for Age of Adventure.

*As they leave.*

SHACKLETON: Let's give it up for Worsley and Crean, everybody!

End of Scene 1
```

---

## Import Mapping (Preview)

This section previews how the MVP importer will read the format. The full import specification will be a separate document.

**Importer strategy:** Read the `.md` file line by line. Classify each line with regex pattern matching. Build Acts, Scenes, Moments, Characters, and Songs incrementally. No parser generator or AST is needed.

| Script construct | Maps to | `moment_types.name` |
|-----------------|---------|----------------------|
| `Title:` / `Author:` lines | Production metadata (not Timeline Moments) | — |
| `Act {N}` heading | **Act** record | — |
| `Scene {N} - {Title}` heading | **Scene** record | — |
| `End of Scene {N}` marker | Ignored | — |
| `*...*` stage direction paragraph | **Moment** + Character links where detected | `stage_direction` |
| `CHARACTER: text` line | **Moment** + **Character** reference | `dialogue` |
| Action parenthetical in dialogue | **Moment** (extracted adjacent to dialogue) | `stage_direction` |
| Delivery parenthetical in dialogue | Stays in dialogue Moment text | (inline in `dialogue`) |
| Song title line (with parenthetical) | **Song** record + **Moment** | `song_header` |
| Performer line | **Moment** | `song_attribution` |
| Lyric line | **Moment** (one line = one Moment) | `lyric` |
| `Note:` line | **Moment** (non-performance; hide from actor views) | `author_note` |

### Import tolerance (non-standard input)

| Non-standard input | Importer behavior |
|-------------------|-------------------|
| Word-form act/scene numbers (`Act One`) | Converted to digits |
| Scene end markers | Ignored |
| Mixed-case character names in stage directions | Matched against known Characters where possible |
| Inline action parentheticals | Extracted to stage direction Moments |

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-07-08 | Initial draft derived from production script example |
| 0.2 | 2026-07-08 | Resolved open questions: digit numbering, title page, song instance labels, parenthetical handling, character reference guidance |
