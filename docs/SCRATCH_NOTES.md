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
- For the moment detail page, when its a Dialogue type moment, I don't need/want to see the Stage Direction text area, since it'll always be blank for Dialogue-type moments (I think that's the approach we've settled on). I believe the inverse is already in place (Dialogue not showing up for Direction-type Moments) but I just wanna flag that for future tweaking. 
- The whole section for each moment should be clickable, not just the part of the section with the text. Right now if I click in the section (above the divider) but below the end of the text, it doesn't properly select the Moment. 
- 'Parsed data correction should just be 'parsed data' or 'imported data'
- There's a lot of stuff (much of it repetitive) in the Moment detail panel. I'm thinking that perhaps most of the 'add a X to this moment' actions could be shortened a bit or all put behind an additional selection layer ('what do you want to add? > Exit > Exit modal'). Not sure how I want to solve it, but the general idea is that I want the detail panel to be better, since 1) it's cluttered and 2) it will be used heavily
- AMBITIOUS IDEA: What if you could click on a mini-diagram of the stage in order to quickly add a note or a location to a blocking or entrance/exit object on a moment? So you could select the character, then click the stage left downstage quadrant on the stage diagram to set them as being there? It'd be tough, especially since the set often adds additional changes/layers to the 'base' stage, so you may need to either only do entrances/exits (pretty static) or let admins add/draw a general diagram of the stage for the production so you can set clickable areas that correspond to specific locations. Could be interesting, but definitely not necessary and coudl be very difficult. 
- Some of the scene-level stats (who's included in this scene, what props are involved, what songs are there, etc) should be displayed somewhere on the Timeline at the beginning of the scene, or in some other view where I can see the scene-level info. Right now the 'who's in this scene' lives in the moment detail panel, which isn't ideal because it's confusing and also because people exit mid-scene so the 'this scene' list may not reflect who's on stage for that given moment. So all those scene-level data points (derived or not) should be seen outside of the Moment detail panel but probably within the Timeline (maybe with a separate scene-by-scene report or something too). Each of the things listed in this hypothetical display should also be clickable to show maybe a modal with the details. So you can click Crean in the 'who's in this scene' and it shows what moment he enters on, what moment he exits on, what costume he's wearing, what props he has/gets/loses, set pieces he brings, etc. Definitely a tough one as well, but it'd be very useful. 

## Done (Phase 2 close-out)

- ~~Groups: add actors/users in UI~~ — shipped on Groups page
- ~~Timeline filter by group~~ — shipped for Director/Admin
- ~~Act filter "Act 1: Act 1" duplicate~~ — fixed via `formatActLabel`
