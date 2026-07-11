import type { CharacterDetailResponse, MomentSummary } from "@/lib/types";
import { isMyMoment } from "@/lib/momentHighlight";

export type RehearsePresetId = "scene_run_through" | "my_lines" | "line_cues" | "custom";

export const REHEARSE_PRESET_LABELS: Record<Exclude<RehearsePresetId, "custom">, string> = {
  scene_run_through: "Scene run-through",
  my_lines: "My lines",
  line_cues: "Line cues",
};

const SONG_MOMENT_TYPES = new Set(["song_header", "song_attribution", "lyric"]);

export interface RehearseDisplayToggles {
  highlightMyLines: boolean;
  showStageDirections: boolean;
  showLyricsAndSongs: boolean;
  showPrepBadges: boolean;
  blurMyLines: boolean;
}

export const PRESET_DEFAULT_TOGGLES: Record<
  Exclude<RehearsePresetId, "custom">,
  RehearseDisplayToggles
> = {
  scene_run_through: {
    highlightMyLines: true,
    showStageDirections: true,
    showLyricsAndSongs: true,
    showPrepBadges: false,
    blurMyLines: false,
  },
  my_lines: {
    highlightMyLines: false,
    showStageDirections: false,
    showLyricsAndSongs: true,
    showPrepBadges: false,
    blurMyLines: false,
  },
  line_cues: {
    highlightMyLines: false,
    showStageDirections: true,
    showLyricsAndSongs: true,
    showPrepBadges: false,
    blurMyLines: false,
  },
};

export function togglesMatchPreset(
  preset: Exclude<RehearsePresetId, "custom">,
  toggles: RehearseDisplayToggles,
): boolean {
  const defaults = PRESET_DEFAULT_TOGGLES[preset];
  return (
    toggles.highlightMyLines === defaults.highlightMyLines &&
    toggles.showStageDirections === defaults.showStageDirections &&
    toggles.showLyricsAndSongs === defaults.showLyricsAndSongs &&
    toggles.showPrepBadges === defaults.showPrepBadges &&
    toggles.blurMyLines === defaults.blurMyLines
  );
}

/** Full scene — all moments; highlighting applied separately in the list. */
export function filterSceneRunThrough(
  moments: MomentSummary[],
  _myCharacterIds: number[],
): MomentSummary[] {
  return moments;
}

/** Dialogue and lyric moments where the actor speaks. */
export function filterMyLines(
  moments: MomentSummary[],
  myCharacterIds: number[],
  characters: CharacterDetailResponse[],
): MomentSummary[] {
  return moments.filter((moment) => {
    if (moment.moment_type === "dialogue" || moment.moment_type === "lyric") {
      return isMyMoment(moment, myCharacterIds, characters);
    }
    if (moment.moment_type === "stage_direction") {
      return isMyMoment(moment, myCharacterIds, characters);
    }
    return false;
  });
}

/** Each of the actor's lines plus the moment immediately before it in sequence. */
export function filterLineCues(
  moments: MomentSummary[],
  myCharacterIds: number[],
  characters: CharacterDetailResponse[],
): MomentSummary[] {
  const myLineMoments = moments.filter((moment) =>
    isMyMoment(moment, myCharacterIds, characters),
  );
  const idsToShow = new Set<number>();

  for (const moment of myLineMoments) {
    idsToShow.add(moment.id);
    const index = moments.findIndex((item) => item.id === moment.id);
    if (index > 0) {
      idsToShow.add(moments[index - 1].id);
    }
  }

  return moments.filter((moment) => idsToShow.has(moment.id));
}

export function applyRehearsePreset(
  preset: Exclude<RehearsePresetId, "custom">,
  moments: MomentSummary[],
  myCharacterIds: number[],
  characters: CharacterDetailResponse[],
): MomentSummary[] {
  switch (preset) {
    case "scene_run_through":
      return filterSceneRunThrough(moments, myCharacterIds);
    case "my_lines":
      return filterMyLines(moments, myCharacterIds, characters);
    case "line_cues":
      return filterLineCues(moments, myCharacterIds, characters);
  }
}

export function applyRehearseToggles(
  moments: MomentSummary[],
  toggles: RehearseDisplayToggles,
): MomentSummary[] {
  let result = moments;

  if (!toggles.showStageDirections) {
    result = result.filter((moment) => moment.moment_type !== "stage_direction");
  }

  if (!toggles.showLyricsAndSongs) {
    result = result.filter((moment) => !SONG_MOMENT_TYPES.has(moment.moment_type));
  }

  return result;
}
