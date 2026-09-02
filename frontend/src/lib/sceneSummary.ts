import type { CharacterDetailResponse, MomentSummary, SongDetailResponse } from "@/lib/types";

export interface SceneSummaryCharacter {
  id: number;
  name: string;
}

export interface SceneSummarySong {
  id: number;
  title: string;
}

export interface SceneSummaryData {
  characters: SceneSummaryCharacter[];
  songs: SceneSummarySong[];
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

  const summaryCharacters = characters
    .filter((character) => characterIds.has(character.id))
    .map((character) => ({ id: character.id, name: character.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const summarySongs = songs
    .filter((song) => songIds.has(song.id))
    .map((song) => ({ id: song.id, title: song.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    characters: summaryCharacters,
    songs: summarySongs,
    propMomentCount,
  };
}
