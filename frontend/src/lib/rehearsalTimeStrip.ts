/** Pure helpers for the rehearsal-night time strip (10-minute snap). */

export const REHEARSAL_TIME_SNAP_MINUTES = 10;

export const REHEARSAL_STRIP_NONE_LOCATION = "__none__";

export type StripLocation = {
  id: string;
  name: string;
  sort_order?: number;
};

export function snapMinutes(
  minutes: number,
  snap: number = REHEARSAL_TIME_SNAP_MINUTES,
): number {
  return Math.round(minutes / snap) * snap;
}

export function floorToSnap(
  minutes: number,
  snap: number = REHEARSAL_TIME_SNAP_MINUTES,
): number {
  return Math.floor(minutes / snap) * snap;
}

export function minutesToTimeInput(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** 12-hour clock label for strip ticks and block chrome. */
export function formatMinutesLabel(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMinutes)));
  const hours24 = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  if (minutes === 0) return `${hours12} ${period}`;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function clampRangeToWindow(
  startMinutes: number,
  endMinutes: number,
  windowStart: number,
  windowEnd: number,
  minDuration: number = REHEARSAL_TIME_SNAP_MINUTES,
): { start: number; end: number } {
  let start = Math.max(windowStart, Math.min(startMinutes, windowEnd - minDuration));
  let end = Math.max(start + minDuration, Math.min(endMinutes, windowEnd));
  if (end - start < minDuration) {
    start = Math.max(windowStart, end - minDuration);
  }
  return { start, end };
}

/** Normalize a drag so start < end, then snap and clamp to the rehearsal window. */
export function normalizeDragRange(
  a: number,
  b: number,
  windowStart: number,
  windowEnd: number,
  snap: number = REHEARSAL_TIME_SNAP_MINUTES,
): { start: number; end: number } {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const start = snapMinutes(lo, snap);
  let end = snapMinutes(hi, snap);
  if (end <= start) end = start + snap;
  return clampRangeToWindow(start, end, windowStart, windowEnd, snap);
}

export function pointerFraction(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

export function fractionToMinutes(
  fraction: number,
  windowStart: number,
  windowEnd: number,
): number {
  const span = Math.max(0, windowEnd - windowStart);
  return windowStart + fraction * span;
}

/** Hour tick minutes inclusive of window start, exclusive of end unless end is on the hour. */
export function hourTicks(windowStart: number, windowEnd: number): number[] {
  const ticks: number[] = [];
  const first = Math.ceil(windowStart / 60) * 60;
  for (let m = first; m < windowEnd; m += 60) {
    ticks.push(m);
  }
  if (ticks[0] !== windowStart) ticks.unshift(windowStart);
  return ticks;
}

/** Default 60-minute slot after the latest existing block, else at window start. */
export function nextDefaultRange(
  windowStart: number,
  windowEnd: number,
  existing: { startMinutes: number; endMinutes: number }[],
  duration: number = 60,
): { start: number; end: number } | null {
  const span = windowEnd - windowStart;
  if (span < REHEARSAL_TIME_SNAP_MINUTES) return null;
  const useDuration = Math.min(duration, span);
  let start = windowStart;
  if (existing.length > 0) {
    start = Math.max(...existing.map((block) => block.endMinutes));
  }
  start = floorToSnap(start);
  if (start + useDuration > windowEnd) {
    start = floorToSnap(windowEnd - useDuration);
  }
  if (start < windowStart) start = windowStart;
  const end = Math.min(windowEnd, start + useDuration);
  if (end - start < REHEARSAL_TIME_SNAP_MINUTES) return null;
  return { start, end };
}

/**
 * Locations with blocks get full "active" rows; unused catalog locations stay
 * in a compact "idle" list. Always includes a No location option.
 */
export function partitionLocationLanes(
  locations: StripLocation[],
  blockLocationIds: string[],
  noneId: string = REHEARSAL_STRIP_NONE_LOCATION,
): { active: StripLocation[]; idle: StripLocation[] } {
  const used = new Set(blockLocationIds);
  const none: StripLocation = { id: noneId, name: "No location" };
  const catalog = [...locations].sort((a, b) => {
    const order = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (order !== 0) return order;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const active: StripLocation[] = [];
  const idle: StripLocation[] = [];

  for (const location of catalog) {
    if (used.has(location.id)) active.push(location);
    else idle.push(location);
  }

  if (used.has(noneId) || active.length === 0) {
    active.push(none);
  } else {
    idle.push(none);
  }

  return { active, idle };
}
