import type { CharacterDetailResponse, MomentSummary } from "@/lib/types";

function characterNamesForIds(
  characterIds: number[],
  characters: CharacterDetailResponse[],
): string[] {
  return characters
    .filter((character) => characterIds.includes(character.id))
    .map((character) => character.name);
}

/** True when a moment belongs to one of the given characters (dialogue, lyrics, or referenced stage direction). */
export function isMyMoment(
  moment: MomentSummary,
  myCharacterIds: number[],
  characters: CharacterDetailResponse[],
): boolean {
  if (!myCharacterIds.length) return false;

  if (moment.speaking_character_ids.some((id) => myCharacterIds.includes(id))) {
    return true;
  }

  if (moment.moment_type === "stage_direction") {
    const names = characterNamesForIds(myCharacterIds, characters);
    return names.some((name) => {
      const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      return pattern.test(moment.display_text);
    });
  }

  return false;
}

/** Timeline character filter highlight — same rules as isMyMoment but for arbitrary character IDs. */
export function isHighlightedMoment(
  moment: MomentSummary,
  characterIds: number[] | undefined,
  characters: CharacterDetailResponse[],
): boolean {
  if (!characterIds?.length) return false;
  return isMyMoment(moment, characterIds, characters);
}
