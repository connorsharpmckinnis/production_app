import { cn } from "@/lib/utils";

const SONG_ROW_TYPES = new Set(["song_header", "song_attribution", "lyric"]);

/** Soft row tint for song/lyric moments (helps when lyrics are not ALL CAPS). */
export function isSongMomentType(type: string): boolean {
  return SONG_ROW_TYPES.has(type);
}

/** Tailwind classes for moment-type badges in timeline and rehearse lists. */
export function momentBadgeClass(type: string): string {
  switch (type) {
    case "dialogue":
      return "bg-moment-dialogue text-moment-dialogue-foreground";
    case "stage_direction":
      return "bg-moment-stage-direction text-moment-stage-direction-foreground";
    case "song_header":
    case "song_attribution":
    case "lyric":
      return "bg-moment-song text-moment-song-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Timeline/rehearse row chrome.
 * Priority: character highlight > selected > song tint.
 */
export function momentHighlightRowClass(
  isHighlighted: boolean,
  isSelected: boolean,
  momentType?: string,
): string {
  const isSong = momentType != null && isSongMomentType(momentType);
  return cn(
    "flex w-full min-h-[2.5rem] cursor-pointer items-stretch gap-2 px-3 py-2 text-left text-sm transition-colors",
    // Half-strength tint — glanceable like Excel zebra rows, not a highlighter.
    isSong && "bg-moment-song/30",
    isSelected && "bg-muted",
    isHighlighted && "border-l-4 border-l-highlight bg-highlight-muted",
  );
}

/** Blur own line text until revealed (Rehearse P2). */
export function momentTextBlurClass(blur: boolean, revealed: boolean): string {
  return cn(blur && !revealed && "blur-sm select-none");
}
