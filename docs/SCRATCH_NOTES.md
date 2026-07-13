# Scratch Notes
## Transient, low-importance notes for human use (not to be taken as authoritative)

I'll be using this document to store temporary notes relating to the project. Stuff that I need to remember to ask/work on. 





## Little Things

- The My Bookmarks experience is odd right now. It pops up a screen-wide banner-looking thing with the bookmarks listed there. Not a terrible instinct, but I think I'd like it to show in its own dedicated timeline-like view with '...'s between bookmarks to show it's not the whole timeline view. And then clicking on a bookmark will open it up in the 'main' timeline view. Or something like that. I'm not sure how I want bookmarks to work yet, so we'll leave it be for the time being and come back to it when I know how I want it to work. → **Wish list** (undecided)
- ~~Editing the stuff in the Timeline view as an admin doesn't look quite right~~ — **Fixed 2026-07-10**: list now shows `display_text`; sheet stays open after save.
- ~~Moment detail view should be changed to be more unified~~ — **Wish list / Phase 4 WP2**
- ~~Settings page (hide original/parsed text)~~ — **Wish list / Phase 4 WP2**
- ~~Timeline view more natural as written text~~ — **Partial fix 2026-07-10** (text wrap); character column → **Wish list / Phase 4 WP1**
- ~~'edit parsed data' behind pencil icon~~ — **Wish list / Phase 4 WP2**
- ~~Auto-save without Save button~~ — **Wish list / Phase 4 WP1**
- ~~User Management in separated section + Settings~~ — **Wish list / Phase 4 WP3**
- ~~Remove button too close to character name (Props)~~ — **Fixed 2026-07-10**: trash icon with spacing
- ~~Prop carrier/notes hidden until prop selected~~ — **Fixed 2026-07-10**
- ~~Same for cues~~ — **Fixed 2026-07-10**
- ~~Don't auto-close detail panel on add cue/prop~~ — **Fixed 2026-07-10**
- ~~Resizable detail panel (session-persisted)~~ — **Fixed 2026-07-10**
- ~~For the moment detail page, when its a Dialogue type moment, I don't need/want to see the Stage Direction text area, since it'll always be blank for Dialogue-type moments (I think that's the approach we've settled on). I believe the inverse is already in place (Dialogue not showing up for Direction-type Moments) but I just wanna flag that for future tweaking.~~ — **Fixed 2026-07-11**: stage direction section only renders for `stage_direction`-type moments.
- ~~The whole section for each moment should be clickable, not just the part of the section with the text. Right now if I click in the section (above the divider) but below the end of the text, it doesn't properly select the Moment.~~ — **Fixed 2026-07-11**: full row is clickable (`items-stretch`, `cursor-pointer`).
- ~~'Parsed data correction should just be 'parsed data' or 'imported data'~~ — **Fixed 2026-07-11**: renamed to "Imported data" / "Imported text" in detail panel and Settings.
- There's a lot of stuff (much of it repetitive) in the Moment detail panel. I'm thinking that perhaps most of the 'add a X to this moment' actions could be shortened a bit or all put behind an additional selection layer ('what do you want to add? > Exit > Exit modal'). Not sure how I want to solve it, but the general idea is that I want the detail panel to be better, since 1) it's cluttered and 2) it will be used heavily
- AMBITIOUS IDEA: What if you could click on a mini-diagram of the stage in order to quickly add a note or a location to a blocking or entrance/exit object on a moment? So you could select the character, then click the stage left downstage quadrant on the stage diagram to set them as being there? It'd be tough, especially since the set often adds additional changes/layers to the 'base' stage, so you may need to either only do entrances/exits (pretty static) or let admins add/draw a general diagram of the stage for the production so you can set clickable areas that correspond to specific locations. Could be interesting, but definitely not necessary and coudl be very difficult. 
- Some of the scene-level stats (who's included in this scene, what props are involved, what songs are there, etc) should be displayed somewhere on the Timeline at the beginning of the scene, or in some other view where I can see the scene-level info. Right now the 'who's in this scene' lives in the moment detail panel, which isn't ideal because it's confusing and also because people exit mid-scene so the 'this scene' list may not reflect who's on stage for that given moment. So all those scene-level data points (derived or not) should be seen outside of the Moment detail panel but probably within the Timeline (maybe with a separate scene-by-scene report or something too). Each of the things listed in this hypothetical display should also be clickable to show maybe a modal with the details. So you can click Crean in the 'who's in this scene' and it shows what moment he enters on, what moment he exits on, what costume he's wearing, what props he has/gets/loses, set pieces he brings, etc. Definitely a tough one as well, but it'd be very useful. 
- ~~Each Moment row in the Timeline has 'On: CREAN' and whatnot for each actor. That's not needed on the per-moment basis since that's already handled on the scene-level strip at the begining of the scene. (Same for rehearse mode as well) The Cue, Entrance, etc badges can stay since they might be useful, but not the individual character badges on each row (they're confusing)~~ — **Fixed 2026-07-11**: removed per-moment "On:" badges from Timeline and Rehearse.
- ~~I want the blur to come back in Rehearse mode when the mouse comes off of the section. Right now it un-blurs correctly but it stays unblurred~~ — **Fixed 2026-07-11**: blur is hover-based again; lines re-blur on mouse leave.
- The Public/Private dropdown before adding a Note is too close to the Add Note button. Give some padding. → **Fixed 2026-07-12** (spacing + “Visible to cast” / “Only me” labels)
- On the Overview page for a production, I need a little bit of buffer at the bottom of the page so that the bottom-most buttons aren't sitting directly on the bottom of the screen. Just a handful of pixels would be fine. 
- Idea: The theater has a certain number of 'standard' items (pre-build set blocks like staircases and platforms, 30 or so microphone packs, mic wires of different lengths, and even costumes but there's a shit-ton of them so they may not work for this idea). Those items generally don't vary in availability, type, or notes/details from one production to the other, they just are used in different ways and by different people. So, what if an Admin or other meta-production role could set all the microphones with their notes, add standard set pieces that won't get fully dismantled between shows, and other 'permanent' stuff that the theater has available, and then a director can selectively or collectively import those items as things to use in their show, rather than having to manually add all microphones, set pieces, etc for each production? This idea could be initially implemented with an import feature that lets users upload CSVs, and then we can set an expectation that STP creates authoritative CSVs of their various assets for directors to copy, modify, and import to speed up the process, and then a future version could even include a system to manage, add, edit, and delete those assets in-app, and directors could essentially 'shop' from teh catalog of sets, props, mics, etc to choose what they want/need from the catalog. We can even store metadata like where it's stored, to give prop/costume/etc people an easier time assembling the shopping list. I definitely want this, and will need to flesh out the final-state idea (including the management system in-app, storage locations, status/condition, painting/tailoring notes, etc) in the 'final' product, if not starting this system earlier. 

## Report Ideas (things I'd like to be able to see at a glance and the ways I'd like to be able to see them)
- Character 'burn-down' chart: A horizontal timeline of the show with color-coded characters occupying rows on the chart, showing what scenes they're in and when they're on/offstage. Perhaps including hover-able icons to display when they have costume, prop, or mic changes.
- Set change chart: Another horizontal timeline, but this time with set pieces and their positions displayed. Position changes, on-offs, and any other modifications are displayed in the chart
- Break Tike Chart: Some way to see when actors have time off-stage to drink water, go to the bathroom, or generally have enough time to do anything other than get ready for the next scene. Include highights or alerts to show when actors have particularly short periods between entrances/exits/whatevers to protect that time for them and prevent unnecessary quick-changes or mic-changes. 
- 

## Done (Phase 2 close-out)

- ~~Groups: add actors/users in UI~~ — shipped on Groups page
- ~~Timeline filter by group~~ — shipped for Director/Admin
- ~~Act filter "Act 1: Act 1" duplicate~~ — fixed via `formatActLabel`
