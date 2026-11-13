import type { CharacterColorPreset } from "@/lib/characterColorPrefs";
import { cn } from "@/lib/utils";

const SONG_ROW_TYPES = new Set(["song_header", "song_attribution", "lyric"]);

/** Theme-token classes for personal character highlight presets. */
export const CHARACTER_COLOR_ROW_CLASS: Record<
  CharacterColorPreset,
  { border: string; muted: string; text: string; swatch: string }
> = {
  sky: {
    border: "border-l-char-sky",
    muted: "bg-char-sky-muted",
    text: "text-char-sky",
    swatch: "bg-char-sky",
  },
  teal: {
    border: "border-l-char-teal",
    muted: "bg-char-teal-muted",
    text: "text-char-teal",
    swatch: "bg-char-teal",
  },
  green: {
    border: "border-l-char-green",
    muted: "bg-char-green-muted",
    text: "text-char-green",
    swatch: "bg-char-green",
  },
  amber: {
    border: "border-l-char-amber",
    muted: "bg-char-amber-muted",
    text: "text-char-amber",
    swatch: "bg-char-amber",
  },
  orange: {
    border: "border-l-char-orange",
    muted: "bg-char-orange-muted",
    text: "text-char-orange",
    swatch: "bg-char-orange",
  },
  rose: {
    border: "border-l-char-rose",
    muted: "bg-char-rose-muted",
    text: "text-char-rose",
    swatch: "bg-char-rose",
  },
  violet: {
    border: "border-l-char-violet",
    muted: "bg-char-violet-muted",
    text: "text-char-violet",
    swatch: "bg-char-violet",
  },
  pink: {
    border: "border-l-char-pink",
    muted: "bg-char-pink-muted",
    text: "text-char-pink",
    swatch: "bg-char-pink",
  },
};

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
 * Priority: selected outline > personal character color > filter/rehearse highlight > song tint.
 * Selected uses a reserved transparent border so toggling does not shift layout.
 */
export function momentHighlightRowClass(
  isHighlighted: boolean,
  isSelected: boolean,
  momentType?: string,
  characterColor?: CharacterColorPreset | null,
): string {
  const isSong = momentType != null && isSongMomentType(momentType);
  const colorClasses =
    characterColor != null ? CHARACTER_COLOR_ROW_CLASS[characterColor] : null;
  return cn(
    "relative flex w-full cursor-pointer items-stretch rounded-md border-2 border-transparent px-3 text-left text-sm transition-colors",
    "min-h-[var(--timeline-row-min-h)] gap-[length:var(--timeline-row-gap)] py-[length:var(--timeline-row-py)]",
    // Subtle hover so the active row is obvious while scanning (selected stays firm).
    !isSelected && "hover:bg-muted/55",
    // Half-strength tint — glanceable like Excel zebra rows, not a highlighter.
    isSong && !isSelected && !colorClasses && "bg-moment-song/30 hover:bg-moment-song/45",
    isSelected && "border-foreground/80 bg-background",
    colorClasses && !isSelected && cn("border-l-4", colorClasses.border, colorClasses.muted),
    colorClasses && isSelected && colorClasses.border,
    !colorClasses &&
      isHighlighted &&
      !isSelected &&
      "border-l-4 border-l-highlight bg-highlight-muted hover:bg-highlight-muted/80",
    !colorClasses && isHighlighted && isSelected && "border-l-highlight",
  );
}

/** Speaker-name tint for a personal character color. */
export function characterColorTextClass(
  preset: CharacterColorPreset | null | undefined,
): string | undefined {
  if (!preset) return undefined;
  return CHARACTER_COLOR_ROW_CLASS[preset].text;
}

export function characterColorSwatchClass(preset: CharacterColorPreset): string {
  return CHARACTER_COLOR_ROW_CLASS[preset].swatch;
}

/** Badge / ObjectLink chrome for a personal character color. */
export function characterColorBadgeClass(
  preset: CharacterColorPreset | null | undefined,
): string | undefined {
  if (!preset) return undefined;
  const classes = CHARACTER_COLOR_ROW_CLASS[preset];
  return cn(classes.muted, classes.text, "hover:opacity-90");
}
/** Blur own line text until revealed (Rehearse P2). */
export function momentTextBlurClass(blur: boolean, revealed: boolean): string {
  return cn(blur && !revealed && "blur-sm select-none");
}
