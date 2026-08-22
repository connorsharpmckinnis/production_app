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

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Convert an ISO timestamp to a value for `<input type="time">` (HH:MM). */
export function toTimeInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combine a rehearsal date (from ISO) with a time input value → ISO string. */
export function combineRehearsalDateAndTime(rehearsalDateIso: string, time: string): string {
  const base = new Date(rehearsalDateIso);
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  if (Number.isNaN(base.getTime()) || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return new Date(time).toISOString();
  }
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
}

/** Minutes since midnight for comparing block times on the same rehearsal night. */
export function timeInputToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

/** Convert an ISO timestamp to a value for `<input type="datetime-local">`. */
export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a datetime-local value to an ISO string (with timezone). */
export function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString();
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
