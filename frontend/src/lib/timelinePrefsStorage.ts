/** Persist Timeline reading prefs, filters, and scroll anchor per production. */

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
  showSequenceNumbers: boolean;
  searchInput: string;
  selectedCharacterIds: number[];
  costumeOnly: boolean;
  entranceOnly: boolean;
  exitOnly: boolean;
  blockingOnly: boolean;
  groupFilter: string;
  blockingCharacterFilter: string;
  songFilter: string;
  propFilter: string;
  cueCategoryFilter: string;
  setPieceFilter: string;
  selectedSceneIds: number[] | null;
  anchor: TimelineScrollAnchor | null;
}

export const DEFAULT_TIMELINE_PREFS: StoredTimelinePrefs = {
  showPrepBadges: false,
  showSequenceNumbers: false,
  searchInput: "",
  selectedCharacterIds: [],
  costumeOnly: false,
  entranceOnly: false,
  exitOnly: false,
  blockingOnly: false,
  groupFilter: "all",
  blockingCharacterFilter: "all",
  songFilter: "all",
  propFilter: "all",
  cueCategoryFilter: "all",
  setPieceFilter: "all",
  selectedSceneIds: null,
  anchor: null,
};

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
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

export function loadTimelinePrefs(productionId: number): StoredTimelinePrefs | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(timelinePrefsStorageKey(productionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTimelinePrefs>;
    return {
      showPrepBadges: Boolean(parsed.showPrepBadges),
      showSequenceNumbers: Boolean(parsed.showSequenceNumbers),
      searchInput: typeof parsed.searchInput === "string" ? parsed.searchInput : "",
      selectedCharacterIds: parseNumberArray(parsed.selectedCharacterIds),
      costumeOnly: Boolean(parsed.costumeOnly),
      entranceOnly: Boolean(parsed.entranceOnly),
      exitOnly: Boolean(parsed.exitOnly),
      blockingOnly: Boolean(parsed.blockingOnly),
      groupFilter:
        typeof parsed.groupFilter === "string" ? parsed.groupFilter : "all",
      blockingCharacterFilter:
        typeof parsed.blockingCharacterFilter === "string"
          ? parsed.blockingCharacterFilter
          : "all",
      songFilter: typeof parsed.songFilter === "string" ? parsed.songFilter : "all",
      propFilter: typeof parsed.propFilter === "string" ? parsed.propFilter : "all",
      cueCategoryFilter:
        typeof parsed.cueCategoryFilter === "string"
          ? parsed.cueCategoryFilter
          : "all",
      setPieceFilter:
        typeof parsed.setPieceFilter === "string" ? parsed.setPieceFilter : "all",
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
