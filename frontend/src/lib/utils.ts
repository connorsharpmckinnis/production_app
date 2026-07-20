import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function truncate(text: string, maxLength = 80): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function momentTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export function formatActLabel(act: { number: number; title: string }): string {
  const defaultTitle = `Act ${act.number}`;
  if (!act.title || act.title === defaultTitle) {
    return defaultTitle;
  }
  return act.title;
}

/** Case-insensitive alphabetical sort by a display name field. */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function formatSceneSectionLabel(
  actNumber: number,
  scene: { number: number; title: string | null },
): string {
  const base = `Act ${actNumber} › Scene ${scene.number}`;
  return scene.title ? `${base} — ${scene.title}` : base;
}
