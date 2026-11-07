/** Persist Timeline reading prefs, filters, and scroll anchor per production. */

import {
  ALL_MOMENT_ATTACHMENT_KINDS,
  type MomentAttachmentKind,
} from "@/lib/domainIcons";

export const timelinePrefsStorageKey = (productionId: number) =>
  `timeline-prefs-${productionId}`;

/** Script place to restore after layout/filter/navigation changes. */
export interface TimelineScrollAnchor {
  sceneId: number;
  momentId: number;
  sequenceNumber: number;
}

export interface StoredTimelinePrefs {
  showPrepBadges: boolean;
  /** Which prep chip kinds to show when prep badges are on. */
  prepBadgeKinds: MomentAttachmentKind[];
  showSequenceNumbers: boolean;
  searchInput: string;
  selectedCharacterIds: number[];
  costumeOnly: boolean;
  entranceOnly: boolean;
  exitOnly: boolean;
  blockingOnly: boolean;
  groupFilter: string;
  blockingCharacterFilter: number[];
  songFilter: number[];
  propFilter: number[];
  cueCategoryFilter: number[];
  setPieceFilter: number[];
  selectedSceneIds: number[] | null;
  anchor: TimelineScrollAnchor | null;
}

export const DEFAULT_TIMELINE_PREFS: StoredTimelinePrefs = {
  showPrepBadges: false,
  prepBadgeKinds: [...ALL_MOMENT_ATTACHMENT_KINDS],
  showSequenceNumbers: false,
  searchInput: "",
  selectedCharacterIds: [],
  costumeOnly: false,
  entranceOnly: false,
  exitOnly: false,
  blockingOnly: false,
  groupFilter: "all",
  blockingCharacterFilter: [],
  songFilter: [],
  propFilter: [],
  cueCategoryFilter: [],
  setPieceFilter: [],
  selectedSceneIds: null,
  anchor: null,
};

const KIND_SET = new Set<string>(ALL_MOMENT_ATTACHMENT_KINDS);

function parsePrepBadgeKinds(
  raw: unknown,
  showPrepBadges: boolean,
): MomentAttachmentKind[] {
  if (Array.isArray(raw)) {
    const kinds = raw.filter(
      (item): item is MomentAttachmentKind =>
        typeof item === "string" && KIND_SET.has(item),
    );
    if (kinds.length > 0) return kinds;
  }
  // Legacy prefs: master toggle on with no kinds list → show all.
  return showPrepBadges ? [...ALL_MOMENT_ATTACHMENT_KINDS] : [];
}

function parseAnchor(raw: unknown): TimelineScrollAnchor | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<TimelineScrollAnchor>;
  if (
    typeof value.sceneId !== "number" ||
    typeof value.momentId !== "number" ||
    typeof value.sequenceNumber !== "number"
  ) {
    return null;
  }
  return {
    sceneId: value.sceneId,
    momentId: value.momentId,
    sequenceNumber: value.sequenceNumber,
  };
}

function parseNumberArray(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return [raw];
  if (typeof raw === "string" && raw !== "all") {
    const value = Number(raw);
    return Number.isFinite(value) ? [value] : [];
  }
  return [];
}

export function loadTimelinePrefs(productionId: number): StoredTimelinePrefs | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(timelinePrefsStorageKey(productionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTimelinePrefs>;
    const showPrepBadges = Boolean(parsed.showPrepBadges);
    return {
      showPrepBadges,
      prepBadgeKinds: parsePrepBadgeKinds(parsed.prepBadgeKinds, showPrepBadges),
      showSequenceNumbers: Boolean(parsed.showSequenceNumbers),
      searchInput: typeof parsed.searchInput === "string" ? parsed.searchInput : "",
      selectedCharacterIds: parseNumberArray(parsed.selectedCharacterIds),
      costumeOnly: Boolean(parsed.costumeOnly),
      entranceOnly: Boolean(parsed.entranceOnly),
      exitOnly: Boolean(parsed.exitOnly),
      blockingOnly: Boolean(parsed.blockingOnly),
      groupFilter:
        typeof parsed.groupFilter === "string" ? parsed.groupFilter : "all",
      blockingCharacterFilter: parseNumberArray(parsed.blockingCharacterFilter),
      songFilter: parseNumberArray(parsed.songFilter),
      propFilter: parseNumberArray(parsed.propFilter),
      cueCategoryFilter: parseNumberArray(parsed.cueCategoryFilter),
      setPieceFilter: parseNumberArray(parsed.setPieceFilter),
      selectedSceneIds: Array.isArray(parsed.selectedSceneIds)
        ? parseNumberArray(parsed.selectedSceneIds)
        : null,
      anchor: parseAnchor(parsed.anchor),
    };
  } catch {
    return null;
  }
}

export function saveTimelinePrefs(productionId: number, prefs: StoredTimelinePrefs) {
  localStorage.setItem(timelinePrefsStorageKey(productionId), JSON.stringify(prefs));
}
