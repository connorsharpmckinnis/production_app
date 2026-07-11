import type { CharacterDetailResponse, MomentSummary, SongDetailResponse } from "@/lib/types";

export interface SceneSummaryData {
  characterNames: string[];
  songTitles: string[];
  propMomentCount: number;
}

/** Derive scene-level context from already-loaded moments and catalogs — no extra API call. */
export function deriveSceneSummary(
  moments: MomentSummary[],
  characters: CharacterDetailResponse[],
  songs: SongDetailResponse[],
): SceneSummaryData {
  const characterIds = new Set<number>();
  const songIds = new Set<number>();
  let propMomentCount = 0;

  for (const moment of moments) {
    for (const id of moment.speaking_character_ids) {
      characterIds.add(id);
    }
    if (moment.song_id !== null) {
      songIds.add(moment.song_id);
    }
    if (moment.has_props) {
      propMomentCount += 1;
    }
  }

  const characterNames = characters
    .filter((character) => characterIds.has(character.id))
    .map((character) => character.name)
    .sort((a, b) => a.localeCompare(b));

  const songTitles = songs
    .filter((song) => songIds.has(song.id))
    .map((song) => song.title)
    .sort((a, b) => a.localeCompare(b));

  return { characterNames, songTitles, propMomentCount };
}
