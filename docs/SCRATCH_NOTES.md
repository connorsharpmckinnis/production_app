# Scratch Notes
## Transient, low-importance notes for human use (not to be taken as authoritative)

I'll be using this document to store temporary notes relating to the project. Stuff that I need to remember to ask/work on. 





## Little Things

- The My Bookmarks experience is odd right now. It pops up a screen-wide banner-looking thing with the bookmarks listed there. Not a terrible instinct, but I think I'd like it to show in its own dedicated timeline-like view with '...'s between bookmarks to show it's not the whole timeline view. And then clicking on a bookmark will open it up in the 'main' timeline view. Or something like that. I'm not sure how I want bookmarks to work yet, so we'll leave it be for the time being and come back to it when I know how I want it to work. 
- Editing the stuff in the Timeline view as an admin doesn't look quite right, and also I don't think that editing the parsed text is correctly saving or rendering the new stuff on the timeline view etc. I tried editing the parsed text, hit 'savemoment fields', and refreshed, but still saw the pre-edited version. Also tried chaning the character speaking the line. It changed (and stayed) on the moment fields in the timeline detail view, but not on the timeline itself displaying anywhere. 
- Moment detail view should be changed to be more unified in displaying data and allowing edits (for the director/admin view). Also, we should make a settings page that lets me mess with stuff. First setting I know I need is the ability to disable showing the original and parsed texts (two separate settings probably). We just need one instance (dialogue or whatever) eventually (after admin confirms successful import)
- I want to tweak the timeline view so that it looks more natural as written text, instead of looking like a table with even-height rows. We'll need to add textwrapping, etc. Possibly splitting the character name (for dialogue) into a separate column or something to make it more intuitive to filter/highlight/etc. 
- 'edit parsed data' feels weird, but I get it. Perhaps it doesn't need to be its own data section, perhaps hide it underneath a pencil icon in the detail view so I don't see that section unless I see something wrong with the parse results and need tochange it. 
- If it's possible/easy, I'd like to not have to click a Save button when editing the stuff in the detail field. Like I want to be able to just open the detail panel, add/change something in the text field of the stage direction, then close out the panel and it's saved and propogated to the main Timeline view (this bug is mentioned in an earliernote)
- Put User Management in a visually distinguished section, away from the Production preparation/management tabs. When Iclick it, it takes me out of the selected Production which is a bummer. Also in that separated section we can put stuff like Settings or whatever it'll be called (App Settings, Admin Panel, etc idk)
- Remove button/action on the Prop section is too close to the character's name. Give it some padding or something or replace with an icon
- Make the additional prop details (carrier, notes) not display from the get-go but pop up when a prop is selected, keeping the detail panel clean for review but accessible for mid-process editing. Samegoes for cues. 
- Don't auto-close the detail panel when adding a new cue or prop to the moment. 
- I'd like to be able to resize the detail panel to see wider content, and have that size change apply even when I close the moment and open a new one (in the samebrowser session; it doesn't need to be a user setting or anything)

## Done (Phase 2 close-out)

- ~~Groups: add actors/users in UI~~ — shipped on Groups page
- ~~Timeline filter by group~~ — shipped for Director/Admin
- ~~Act filter "Act 1: Act 1" duplicate~~ — fixed via `formatActLabel`
