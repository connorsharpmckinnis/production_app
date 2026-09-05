/** Moment-based scroll anchoring for the Timeline list. */

import type { TimelineSection } from "@/components/TimelineMomentList";
import type { TimelineScrollAnchor } from "@/lib/timelinePrefsStorage";
import type { MomentSummary } from "@/lib/types";

export type FlatMomentRef = {
  sceneId: number;
  moment: MomentSummary;
};

function visibleMomentsInSections(sections: TimelineSection[]): FlatMomentRef[] {
  const flat: FlatMomentRef[] = [];
  for (const section of sections) {
    for (const moment of section.moments) {
      if (moment.moment_type === "song_attribution") continue;
      flat.push({ sceneId: section.sceneId, moment });
    }
  }
  return flat;
}

/** Sticky section headers overlay content; treat their bottom as the visible top. */
function effectiveViewportTop(listEl: HTMLElement): number {
  const listTop = listEl.getBoundingClientRect().top;
  let top = listTop;
  for (const sticky of listEl.querySelectorAll<HTMLElement>(".sticky")) {
    const rect = sticky.getBoundingClientRect();
    if (rect.top <= listTop + 1 && rect.bottom > top) {
      top = rect.bottom;
    }
  }
  return top;
}

/**
 * First moment row that is fully visible in the list viewport
 * (below any sticky section header). Falls back to the first partially visible row.
 */
export function findFirstFullyVisibleAnchor(
  listEl: HTMLElement,
): TimelineScrollAnchor | null {
  const listRect = listEl.getBoundingClientRect();
  const viewTop = effectiveViewportTop(listEl);
  const viewBottom = listRect.bottom;
  const rows = listEl.querySelectorAll<HTMLElement>("[data-moment-id][data-scene-id]");

  let firstPartial: TimelineScrollAnchor | null = null;

  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const momentId = Number(row.dataset.momentId);
    const sceneId = Number(row.dataset.sceneId);
    const sequenceNumber = Number(row.dataset.sequenceNumber);
    if (
      !Number.isFinite(momentId) ||
      !Number.isFinite(sceneId) ||
      !Number.isFinite(sequenceNumber)
    ) {
      continue;
    }

    const intersects = rect.bottom > viewTop && rect.top < viewBottom;
    if (!intersects) continue;

    const anchor: TimelineScrollAnchor = { sceneId, momentId, sequenceNumber };
    if (!firstPartial) firstPartial = anchor;

    const fullyVisible = rect.top >= viewTop - 1 && rect.bottom <= viewBottom + 1;
    if (fullyVisible) return anchor;
  }

  return firstPartial;
}

/** Prefer exact moment; else same-scene nearest sequence; else nearest in script order. */
export function resolveNearestMomentId(
  sections: TimelineSection[],
  anchor: TimelineScrollAnchor,
): number | null {
  const flat = visibleMomentsInSections(sections);
  if (flat.length === 0) return null;

  if (flat.some((item) => item.moment.id === anchor.momentId)) {
    return anchor.momentId;
  }

  const sameScene = flat.filter((item) => item.sceneId === anchor.sceneId);
  if (sameScene.length > 0) {
    let best = sameScene[0];
    let bestDelta = Math.abs(best.moment.sequence_number - anchor.sequenceNumber);
    for (const item of sameScene.slice(1)) {
      const delta = Math.abs(item.moment.sequence_number - anchor.sequenceNumber);
      if (delta < bestDelta) {
        best = item;
        bestDelta = delta;
      }
    }
    return best.moment.id;
  }

  // Nearest by overall script order: last moment at/before target scene, else first after.
  let before: FlatMomentRef | null = null;
  let after: FlatMomentRef | null = null;
  for (const item of flat) {
    if (item.sceneId < anchor.sceneId) {
      before = item;
    } else if (item.sceneId > anchor.sceneId && after === null) {
      after = item;
      break;
    }
  }
  return (after ?? before)?.moment.id ?? flat[0].moment.id;
}

export function scrollListToMoment(
  listEl: HTMLElement,
  momentId: number,
  _behavior: ScrollBehavior = "auto",
): boolean {
  const row = listEl.querySelector<HTMLElement>(`[data-moment-id="${momentId}"]`);
  if (!row) return false;
  const listRect = listEl.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const stickyOffset = effectiveViewportTop(listEl) - listRect.top;
  listEl.scrollTop += rowRect.top - listRect.top - stickyOffset;
  return true;
}
