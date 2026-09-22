/** Shared SearchableSelect metadata so actor names find cast characters. */

export type CharacterSearchSource = {
  name: string;
  assigned_actor?: { display_name: string } | null;
};

export function characterOptionSearchMeta(character: CharacterSearchSource): {
  hint: string;
  keywords: string;
} {
  const actorName = character.assigned_actor?.display_name?.trim() || "";
  if (!actorName) {
    return { hint: "Character", keywords: "character" };
  }
  return {
    hint: `Character · ${actorName}`,
    keywords: `character ${actorName}`,
  };
}
