/** Shared SearchableSelect metadata so actor names find cast characters. */

export type CharacterSearchSource = {
  name: string;
  assigned_actor?: { display_name: string } | null;
};

export function characterActorDisplayName(
  character: CharacterSearchSource,
): string | null {
  const actorName = character.assigned_actor?.display_name?.trim() || "";
  return actorName || null;
}

/** Character name, with cast actor when present (`Tiny Tim · Alex`). */
export function characterWithActorLabel(character: CharacterSearchSource): string {
  const actorName = characterActorDisplayName(character);
  if (!actorName) return character.name;
  return `${character.name} · ${actorName}`;
}

export function characterOptionSearchMeta(character: CharacterSearchSource): {
  hint: string;
  keywords: string;
} {
  const actorName = characterActorDisplayName(character);
  if (!actorName) {
    return { hint: "Character", keywords: "character" };
  }
  return {
    hint: `Character · ${actorName}`,
    keywords: `character ${actorName}`,
  };
}
