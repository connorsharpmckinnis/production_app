import { cn } from "@/lib/utils";

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

/** Left-border highlight for filtered or "my line" moments. */
export function momentHighlightRowClass(isHighlighted: boolean, isSelected: boolean): string {
  return cn(
    "flex w-full min-h-[3rem] cursor-pointer items-stretch gap-2 px-4 py-3 text-left text-sm transition-colors",
    isSelected && "bg-muted",
    isHighlighted && "border-l-4 border-l-highlight bg-highlight-muted",
  );
}

/** Blur own line text until revealed (Rehearse P2). */
export function momentTextBlurClass(blur: boolean, revealed: boolean): string {
  return cn(blur && !revealed && "blur-sm select-none");
}
