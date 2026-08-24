/**
 * About the App — editable content.
 *
 * Edit this file to update what users see on the About page.
 * Keep sections short and concrete so cast/crew can skim quickly.
 */

export const ABOUT_FEEDBACK_EMAIL = "csharpmckinnis@gmail.com";
export const ABOUT_FEEDBACK_SUBJECT = "Theater App Feedback";

export const aboutContent = {
  appDetails: {
    title: "App Details",
    version: "0.1.0",
    author: "Connor McKinnis",
    purpose:
      "I built this for community theater prep and rehearsal. You import a script, get a timeline of moments, then layer casting, props, cues, blocking, notes, on top of that timeline. Rehearse mode on the Timeline lets actors run lines. More is coming.",
    stack: [
      "Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui",
      "Backend: Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL",
      "Infrastructure: Docker, uv",
    ],
    criticalSettings: [
      "App Settings (Admin): hide the original/imported text fields once you've finished reviewing the import.",
      "Theme: light, dark, system, or color — saved in your browser.",
      "Roles: Admin, Director, and Actor control who can edit what. More specific crew roles are planned.",
    ],
  },

  currentState: {
    title: "Current State",
    intro:
      "This build is meant to be usable with a real STP production. The core prep and rehearsal loops work end to end. Some of it is still rough around the edges, and a bunch of the bigger ideas are still ahead.",
    whatWorks: [
      "Create a production and import a script as markdown (.md) or Word (.docx).",
      "Review and edit the Timeline — add, delete, and reorder moments.",
      "Cast characters, manage groups, and keep catalogs for props, cues, costumes, mics, set pieces, and songs.",
      "Attach prep data and notes to moments; bookmark moments for later.",
      "Rehearse mode on the Timeline — practice presets (scene run-through, my lines, line cues) and optional line blur.",
      "Overview page plus basic reports for props, cues, entrances/exits, and blocking.",
    ],
    howToUse: [
      "Admins: create a production → Import script → open Overview.",
      "Directors: live in Timeline for prep; toggle Rehearse mode to see what actors see.",
      "Actors: start from Overview or Timeline with Rehearse mode on; open moments for notes and bookmarks.",
      "Attach props, cues, entrances, exits, and blocking from a moment's detail panel.",
      "Costumes are assigned per character/scene on the Costumes page (not per moment — for now).",
    ],
  },

  futureState: {
    title: "Future State",
    intro:
      "Here's where I want this to go. Some of it is near-term polish; some of it is the longer bet that the timeline becomes the living record of the show, and everything else — sheets, charts, who's on stage — falls out of that.",
    sections: [
      {
        heading: "Sheets and reports that actually help tech",
        body: "We've got basic prop, cue, entrance/exit, and blocking reports today, plus an editable lav chart (wires + packs, propose, print). I still want call-sheet quality next: print-ready / PDF layouts, lav change-list sheets (when they swap), set-piece sheets, song sheets, and per-character packs for what you're carrying. Same idea for a readiness dashboard — casting done? blocking in? props tagged? — so you can tell if you're actually ready for rehearsal instead of guessing.",
      },
      {
        heading: "Entrances, exits, and blocking",
        body: "You can already attach entrances, exits, and blocking notes to moments. Next steps: group-level entrances/exits (put Ensemble on in one go), clearer derived who's-on-stage from the entrance/exit history, and richer blocking sheets. Longer shot: click a stage diagram (or production-drawn zones) to set where someone enters or stands, instead of typing \"cross DSL.\" That one's ambitious and not day-one.",
      },
      {
        heading: "Event-driven production data",
        body: "Long-term, a lot of prep should live as events on the timeline — entrance, exit, prop handoff, costume change, cue fire, mic assignment, set change — and the app derives current state from that history. Don't store \"Crean is on in Scene 3\"; store when he enters and exits, and compute who's on at any moment. Same pattern for costumes (add/remove pieces over the show instead of only scene-level assignments) and lavs (assignments that produce change charts). One source of truth; reports and sheets are just different lenses on it.",
      },
      {
        heading: "Timeline and Rehearse quality-of-life",
        body: "Live search as you type, multi-select filters (several characters or props at once), character colors so lines are easy to spot, and saved named views — e.g. tech night, my lines, lighting pass — that remember a filter + Rehearse preset. Bookmarks should feel more like the script: a dedicated timeline-ish view with gaps between jumps, then click through to the real spot. Scene-summary chips should open a drill-down: this character's entrances, exits, costume, props, blocking for the scene.",
      },
      {
        heading: "Director notes from the house",
        body: "Sit in the audience with a phone, advance moments passively while you watch, and when something's off, bring the phone up and dictate a short note onto the current moment without taking your eyes off the scene. Mobile-first for that workflow — voice notes welcome.",
      },
      {
        heading: "From prep into running the show",
        body: "Rehearsal scheduling, attendance, assignable tasks, and performance dates. Production archives for finished shows. More crew roles (stage manager, lighting, sound) with views tuned to what each job needs from the same timeline. Inventory / shared props across productions if we ever need it. Split and merge moments during structural edit. Understudies and cast overrides are on the radar but not designed yet.",
      },
    ],
  },
} as const;

export function feedbackMailtoHref(): string {
  const subject = encodeURIComponent(ABOUT_FEEDBACK_SUBJECT);
  return `mailto:${ABOUT_FEEDBACK_EMAIL}?subject=${subject}`;
}
