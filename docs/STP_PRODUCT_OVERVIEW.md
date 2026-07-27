# Theater App — An Introduction for Spiritual Twist Productions

**For:** Emmy, Becky, Pam, and anyone else who might help steer this  
**From:** Connor McKinnis  
**Status:** Early but usable MVP (version 0.1)  
**Intent:** Built with STP in mind; offered as a free partnership if it's useful

---

## What this is

Theater App is a production preparation and rehearsal tool for community theater.

It is **not** a replacement for writing the show, directing the show, or talking to each other. It is a place to keep the *production* side of a show — casting, props, cues, costumes, blocking, notes, and line practice — tied to the script itself, so everyone is looking at the same living picture of the production.

Think of it this way:

1. The **script** comes in.
2. The app turns it into a **Timeline** — a beat-by-beat walk through the show (acts → scenes → moments).
3. Directors and admins **layer preparation onto those moments** (who's cast, what prop appears here, who enters, what cue fires, a note for later).
4. Actors use **Rehearse** to practice lines against that same material.
5. **Reports** (prop sheets, cue sheets, entrances/exits, blocking) are generated from the Timeline instead of being maintained as separate documents that drift out of date.

The script text itself stays sacred. Production decisions sit on top of it; they don't rewrite the words.

---

## Why I built it (and why STP)

At STP — and at almost every community theater I've seen — show knowledge gets scattered:

- Script in Google Docs  
- Casting in a spreadsheet or email thread  
- Prop lists somewhere else  
- Blocking in a notebook or in the director's head  
- "Who's on mic when" as tribal knowledge  
- Actors practicing from PDFs or printed sides that don't know anything about the rest of the production  

That works until it doesn't. People leave. Details get lost between shows. The same questions get asked every rehearsal. Tech week gets louder than it needs to be.

Theater App is my attempt to give STP **one source of truth for the production**, without asking volunteers to learn enterprise software. It's built for how community theater actually works: directors prep incrementally, actors need a clean place to run lines, and admins need enough control to keep accounts and shows organized.

I perform with STP and write for STP. This is meant to serve *this* company first — not a generic "theater SaaS" product.

---

## Who it's for (today)

| Role in the app | Who that maps to at STP | What they can do |
| --- | --- | --- |
| **Admin** | Someone trusted to set up shows and accounts (could be Pam's desk, a production manager, or me during a pilot) | Create productions, import scripts, manage user accounts, full prep access |
| **Director** | Directors, assistant directors, and people doing production prep | Cast the show, edit the Timeline, manage props/cues/costumes/etc., run reports, use Rehearse |
| **Actor** | Cast members | See productions they're cast in; use Timeline (read-only) and Rehearse; leave notes and bookmarks |

More specialized crew roles (stage manager, lighting, sound, writer-in-app) are on the roadmap. For now, directors cover most prep, and the Timeline is the shared hub.

---

## What you can do with it today

### Start a show
An admin creates a **Production**, imports the script (from a Theater App–friendly markdown export — typically Google Docs → Download as Markdown, with a little formatting discipline), and lands on the Timeline.

### Prepare the show
Directors work primarily in the **Timeline**:

- Review and adjust the structure (add, delete, reorder moments)  
- Cast characters to actors  
- Build catalogs: songs, props, costumes, set pieces, cue categories, groups; plan lavs on the Lav chart (wires/packs)
- Attach prep to specific moments: props, cues, entrances, exits, blocking, notes  
- Bookmark moments that need attention later  

### Rehearse
**Rehearse** mode gives actors (and directors checking the actor experience) practice presets that match real habits:

- **Scene run-through** — full scene, with your lines highlighted  
- **My lines** — only what you say  
- **Line cues** — your line plus the line that feeds it  
- Optional **Blur my lines** — hide your text until you tap/hover, for memorization  

### Pull sheets without rebuilding them by hand
**Reports** currently include basic printable views for:

- Prop sheet  
- Cue sheet  
- Costumes by scene  
- Entrances & exits  
- Blocking sheet  

Click a moment reference in a report and jump straight back to that spot on the Timeline.

---

## What it is *not* (yet)

Honesty matters more than a long feature list. Theater App does **not** currently replace:

- Rehearsal **scheduling** or a company calendar  
- **Attendance** tracking  
- Assignable **task lists**  
- Live **show calling** / board-op consoles  
- Polished **PDF call sheets** (reports are useful but still basic)  
- In-app **playwriting** (writers still author in Google Docs / markdown; the app imports the result)  
- Full **multi-company** / commercial product packaging  

Those are real needs. Some are on the roadmap. The MVP deliberately focuses on the hardest under-tooled problem first: **structured production prep glued to the script**, plus rehearsal practice that uses that same data.

---

## How people actually use it (day-to-day)

**Admin path:** create production → import script → invite/create users → hand off to director  

**Director path:** live in Timeline for prep → use Overview to see casting gaps and next steps → check Rehearse occasionally so you know what actors see → print reports when tech needs a sheet  

**Actor path:** open the show → go to Rehearse (or Timeline) → practice → leave a note or bookmark on a moment when something's unclear  

Preparation pages stay available; for actors, the app keeps Rehearse and Timeline front and center so they aren't dumped into a wall of admin tools.

---

## A proposed path with STP

If this feels promising, here's a concrete way we could try it without boiling the ocean:

### Phase A — Look and talk (1 meeting)
- 15–20 minute walkthrough of the current app  
- Open questions from staff/directors
- Decide whether a pilot is worth doing  

### Phase B — Soft pilot on one production
- Pick **one** upcoming STP show (or a contained slice of a larger show)  
- Import the real script  
- Director(s) use Timeline for prep alongside whatever you already do  
- Cast a small group of actors on Rehearse and gather feedback  
- I stay available to fix bugs, adjust workflows, and add the "must-haves" that show up in real use  

### Phase C — Decide together
After the pilot, we answer three questions honestly:

1. Did this save time / reduce confusion for anyone?  
2. Did actors actually use Rehearse, or was it director-only?  
3. What would have to be true for STP to want this on the next show?  

If the answer is "not for us," we stop. If the answer is "yes, with X/Y/Z," I keep building those pieces — still for free, still with STP as the primary customer in the room.

---

## What I'm offering

- **Continued free development and support** if STP wants to use and shape the product  
- **Training / walkthroughs** for directors and cast as needed during a pilot  
- **Willingness to change the app based on STP reality**, not based on a generic feature wishlist  
- **Transparency** about what's ready and what isn't  

## What I'm asking for

- **Honest feedback** — especially "this is confusing" and "we would never do it that way"  
- **A chance to pilot on a real production** if the overview and demo land well  
- **A point person or two** (even informally) who can say whether something matches how STP works  

I'm not asking for a budget, a committee, or a long-term commitment up front. I'm asking for a conversation and, if it goes well, a test run.

---

## How this might help each of you

**Emmy (Creative Director)**  
A clearer picture of what's been decided on a production — blocking, cues, who enters when — living next to the script rather than only in individual heads. Easier to see whether a show is *actually* prepared, not just rehearsed.

**Becky (Writer / Director)**  
Writers still write the way you write. The app cares about a clear script format for import, then gets out of the way. As a director, Timeline + reports give you one place to hang prep instead of juggling docs. As a friend of the process: your feedback on whether the moment-by-moment structure matches how you *think* about a show would be gold.

**Pam (Executive Director)**  
Lower chaos cost for volunteers. Fewer "where is the latest prop list?" moments. A tool we can evaluate on a real show before deciding if it belongs in the organization's toolkit. No purchase order required to find out.

**Actors / cast (everyone else)**  
A practice space that knows your character, highlights your lines, and supports the way people actually memorize — not just another PDF.

---

## Ideas I'd love your reaction to

These aren't promises for day one of a pilot. They're conversation starters — things that feel especially STP-shaped if the core tool sticks:

1. **Per-character "what do I need tonight?" packs** — lines + props + costume notes + entrances for one actor, printable before rehearsal.  
2. **Lav / mic change charts** — who wears which mic when, and when they need to swap (a classic community-theater headache).  
3. **Readiness checklist for a production** — casting done? props tagged? blocking in for Act I? — so leadership can see prep status at a glance.  
4. **Director notes from the house** — phone in the audience, dictate a short note onto the current moment without diving into a laptop.  
5. **Archive of past STP shows** — so institutional memory survives when people rotate off a production.  
6. **Writer-friendly export / re-import loop** — so script revisions mid-process don't mean starting over (this one's carefully designed; not fully there yet).  

If any of those make you sit up — or if something totally different would matter more — tell me. The roadmap should follow STP's real pain, not my imagination alone.

---

## Tone for a pilot (what success looks like)

A successful first test is **not** "we ran the entire company through new software."

A successful first test **is**:

- One production used the Timeline for real prep decisions  
- At least a few actors tried Rehearse and said whether it helped  
- We collected a short list of "blockers" and "delighters"  
- Leadership has enough signal to say yes, no, or not yet  

That's the bar. Everything else can wait.

---

## Closing

I care about STP's shows, STP's people, and STP's limited volunteer time. Theater App is my attempt to spend my skills in a way that might actually help.

If you want to see it, I'll set up a short demo. If you want to try it on a show, I'll support that. If it's not the right fit, I'd rather hear that early than build in the wrong direction.

Thanks for considering it — and for the years of work that make STP the kind of place where a tool like this might matter.

— Connor

---

## Appendix: One-sentence versions (if you need them)

**Elevator:** Theater App keeps casting, props, cues, blocking, and line practice attached to the script so the whole production stays in sync.

**For a board / leadership blurb:** An early volunteer-built production tool for STP that turns a script into a shared timeline for prep and rehearsal; offered for a free pilot on a real show.

**For cast:** An app where you can run your lines (with cues and blur-to-memorize) against the same production the directors are preparing.
