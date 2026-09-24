import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Layers,
  LogIn,
  LogOut,
  Mic,
  Move,
  Music,
  Package,
  Shapes,
  Shirt,
  StickyNote,
  VenetianMask,
  Zap,
} from "lucide-react";

/**
 * Canonical domain icons for prep objects and related affordances.
 *
 * Swap a Lucide component in DOMAIN_ICONS to change that glyph everywhere
 * (Timeline chips, moment detail picker, sidebar nav, etc.).
 *
 * To add a new type:
 * 1. Add a key to DomainIconKind
 * 2. Add an entry in DOMAIN_ICONS
 * 3. Optionally add a short label / alias
 * 4. Use domainIcon("your_kind") at call sites
 */
export type DomainIconKind =
  | "prop"
  | "set_piece"
  | "costume"
  | "cue"
  | "entrance"
  | "exit"
  | "blocking"
  | "song"
  | "character"
  | "group"
  | "lav"
  | "notes"
  | "bookmark";

/** Moment attachment kinds (detail “Add to moment” + Timeline prep chips). */
export type MomentAttachmentKind = Extract<
  DomainIconKind,
  "prop" | "set_piece" | "costume" | "cue" | "entrance" | "exit" | "blocking"
>;

/**
 * Single source of truth for domain glyphs.
 * Change an entry here when you settle on preferred icons.
 */
export const DOMAIN_ICONS: Record<DomainIconKind, LucideIcon> = {
  prop: Package,
  set_piece: Layers,
  costume: Shirt,
  cue: Zap,
  entrance: LogIn,
  exit: LogOut,
  blocking: Move,
  song: Music,
  character: VenetianMask,
  group: Shapes,
  lav: Mic,
  notes: StickyNote,
  bookmark: Bookmark,
};

/** Aliases so older keys / nav resource names resolve to the same glyph. */
export const DOMAIN_ICON_ALIASES = {
  set: "set_piece",
  cue_categories: "cue",
  props: "prop",
  costumes: "costume",
  set_pieces: "set_piece",
  songs: "song",
  characters: "character",
  groups: "group",
  lav_chart: "lav",
} as const satisfies Record<string, DomainIconKind>;

export type DomainIconAlias = keyof typeof DOMAIN_ICON_ALIASES;
export type DomainIconRef = DomainIconKind | DomainIconAlias;

export function resolveDomainIconKind(ref: DomainIconRef): DomainIconKind {
  if (Object.prototype.hasOwnProperty.call(DOMAIN_ICON_ALIASES, ref)) {
    return DOMAIN_ICON_ALIASES[ref as DomainIconAlias];
  }
  return ref as DomainIconKind;
}

/** Resolve a Lucide icon component for a domain kind or alias. */
export function domainIcon(ref: DomainIconRef): LucideIcon {
  return DOMAIN_ICONS[resolveDomainIconKind(ref)];
}

/** Short labels for moment attachment picker / chips. */
export const MOMENT_ATTACHMENT_LABELS: Record<MomentAttachmentKind, string> = {
  prop: "Prop",
  set_piece: "Set",
  costume: "Costume",
  cue: "Cue",
  entrance: "Entrance",
  exit: "Exit",
  blocking: "Blocking",
};

const ATTACHMENT_ORDER = [
  "prop",
  "set_piece",
  "costume",
  "cue",
  "entrance",
  "exit",
  "blocking",
] as const satisfies readonly MomentAttachmentKind[];

/** Ordered options for the moment detail “Add to moment” type grid. */
export const MOMENT_ATTACHMENT_OPTIONS: {
  value: MomentAttachmentKind;
  label: string;
  icon: LucideIcon;
}[] = ATTACHMENT_ORDER.map((value) => ({
  value,
  label: MOMENT_ATTACHMENT_LABELS[value],
  icon: DOMAIN_ICONS[value],
}));

/** Timeline chip tint classes keyed by attachment kind. */
export function momentAttachmentChipClass(
  kind: MomentAttachmentKind | "set",
): string {
  const resolved = resolveDomainIconKind(kind === "set" ? "set" : kind);
  switch (resolved) {
    case "prop":
    case "blocking":
      return "text-amber-800 dark:text-amber-300";
    case "cue":
      return "text-violet-700 dark:text-violet-300";
    case "entrance":
    case "exit":
      return "text-teal-700 dark:text-teal-300";
    case "set_piece":
      return "text-sky-700 dark:text-sky-300";
    case "costume":
      return "text-rose-700 dark:text-rose-300";
    default:
      return "text-muted-foreground";
  }
}
