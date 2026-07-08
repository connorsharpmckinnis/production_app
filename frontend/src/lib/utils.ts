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
