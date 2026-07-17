/** Pure helpers for Overview spotlight start index and rotation. */

/** Local calendar day key as YYYY-MM-DD. */
export function localDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Stable non-cryptographic hash so the same production + day
 * always starts on the same spotlight item.
 */
export function hashSpotlightSeed(productionId: number, dayKey: string): number {
  const seed = `${productionId}:${dayKey}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic starting index into a backend-resolved spotlight queue. */
export function spotlightStartIndex(
  productionId: number,
  dayKey: string,
  length: number,
): number {
  if (length <= 0) return 0;
  return hashSpotlightSeed(productionId, dayKey) % length;
}

/** Rotate only when interval is positive and there is more than one item. */
export function shouldRotateSpotlight(
  rotationSeconds: number,
  itemCount: number,
): boolean {
  return rotationSeconds > 0 && itemCount > 1;
}

export function nextSpotlightIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current + 1) % length;
}

export function previousSpotlightIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current - 1 + length) % length;
}

/** Map readiness href_hint values to in-app routes. */
export function dimensionHref(
  productionId: number,
  hrefHint: string,
): string {
  const base = `/productions/${productionId}`;
  switch (hrefHint) {
    case "characters":
      return `${base}/characters`;
    case "costumes":
      return `${base}/costumes`;
    case "cue-categories":
      return `${base}/cue-categories`;
    case "props":
      return `${base}/props`;
    case "microphones":
      return `${base}/microphones`;
    case "set-pieces":
      return `${base}/set-pieces`;
    case "timeline":
      return `${base}/timeline`;
    case "reports":
      return `${base}/reports`;
    default:
      return base;
  }
}

export const ENCOURAGEMENT_BANDS = [
  "0",
  "1-24",
  "25-49",
  "50-74",
  "75-89",
  "90-99",
  "100",
] as const;

export function bandLabel(band: string): string {
  if (band === "0") return "0%";
  if (band === "100") return "100%";
  return `${band}%`;
}

export const ROTATION_MIN_SECONDS = 5;
export const ROTATION_MAX_SECONDS = 300;

export function isValidRotationSeconds(value: number): boolean {
  if (value === 0) return true;
  return value >= ROTATION_MIN_SECONDS && value <= ROTATION_MAX_SECONDS;
}
