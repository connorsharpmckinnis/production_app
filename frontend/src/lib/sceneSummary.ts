import type {
  CharacterDetailResponse,
  MomentSummary,
  PropResponse,
  SetPieceResponse,
  SongDetailResponse,
} from "@/lib/types";

export interface SceneSummaryCharacter {
  id: number;
  name: string;
}

export interface SceneSummarySong {
  id: number;
  title: string;
}

export interface SceneSummaryProp {
  id: number;
  name: string;
}

export interface SceneSummarySetPiece {
  id: number;
  name: string;
}

export interface SceneSummaryData {
  characters: SceneSummaryCharacter[];
  songs: SceneSummarySong[];
  props: SceneSummaryProp[];
  setPieces: SceneSummarySetPiece[];
}

/** Derive scene-level context from already-loaded moments and catalogs — no extra API call. */
export function deriveSceneSummary(
  moments: MomentSummary[],
  characters: CharacterDetailResponse[],
  songs: SongDetailResponse[],
  props: PropResponse[],
  setPieces: SetPieceResponse[],
): SceneSummaryData {
  const characterIds = new Set<number>();
  const songIds = new Set<number>();
  const propIds = new Set<number>();
  const setPieceIds = new Set<number>();

  for (const moment of moments) {
    for (const id of moment.speaking_character_ids) {
      characterIds.add(id);
    }
    if (moment.song_id !== null) {
      songIds.add(moment.song_id);
    }
    for (const id of moment.prop_ids ?? []) {
      propIds.add(id);
    }
    for (const id of moment.set_piece_ids ?? []) {
      setPieceIds.add(id);
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

  const summaryProps = props
    .filter((prop) => propIds.has(prop.id))
    .map((prop) => ({ id: prop.id, name: prop.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const summarySetPieces = setPieces
    .filter((piece) => setPieceIds.has(piece.id))
    .map((piece) => ({ id: piece.id, name: piece.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    characters: summaryCharacters,
    songs: summarySongs,
    props: summaryProps,
    setPieces: summarySetPieces,
  };
}
