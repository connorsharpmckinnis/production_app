import type { CharacterDetailResponse, MomentSummary } from "@/lib/types";

export type HighlightGroup = {
  id: number;
  character_ids: number[];
};

function characterNamesForIds(
  characterIds: number[],
  characters: CharacterDetailResponse[],
): string[] {
  return characters
    .filter((character) => characterIds.includes(character.id))
    .map((character) => character.name);
}

function speaksViaGroup(
  moment: MomentSummary,
  myCharacterIds: number[],
  groups?: HighlightGroup[],
): boolean {
  if (!groups?.length || !moment.speaking_group_ids?.length) return false;
  return moment.speaking_group_ids.some((groupId) => {
    const group = groups.find((item) => item.id === groupId);
    return group?.character_ids.some((id) => myCharacterIds.includes(id)) ?? false;
  });
}

/** True when the user speaks this line (dialogue or lyric only — not stage directions). */
export function isMySpokenLine(
  moment: MomentSummary,
  myCharacterIds: number[],
  groups?: HighlightGroup[],
): boolean {
  if (!myCharacterIds.length) return false;
  if (moment.moment_type !== "dialogue" && moment.moment_type !== "lyric") {
    return false;
  }
  if (moment.speaking_character_ids.some((id) => myCharacterIds.includes(id))) {
    return true;
  }
  return speaksViaGroup(moment, myCharacterIds, groups);
}

/** True when a moment belongs to one of the given characters (dialogue, lyrics, or referenced stage direction). */
export function isMyMoment(
  moment: MomentSummary,
  myCharacterIds: number[],
  characters: CharacterDetailResponse[],
  groups?: HighlightGroup[],
): boolean {
  if (!myCharacterIds.length) return false;

  if (moment.speaking_character_ids.some((id) => myCharacterIds.includes(id))) {
    return true;
  }

  if (speaksViaGroup(moment, myCharacterIds, groups)) {
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
  groups?: HighlightGroup[],
): boolean {
  if (!characterIds?.length) return false;
  return isMyMoment(moment, characterIds, characters, groups);
}
