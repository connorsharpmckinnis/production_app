import type {
  CharacterColorMap,
  CharacterColorPreset,
} from "@/lib/characterColorPrefs";
import { isMyMoment } from "@/lib/momentHighlight";
import type { CharacterDetailResponse, MomentSummary } from "@/lib/types";

/**
 * Pick a personal highlight color for a moment, if a colored character matches.
 *
 * Only direct speaking characters and stage-direction name hits count.
 * Group-attributed lines (e.g. "All") do not inherit a member's color.
 */
export function characterColorForMoment(
  moment: MomentSummary,
  colors: CharacterColorMap,
  characters: CharacterDetailResponse[],
): CharacterColorPreset | null {
  const coloredIds = Object.keys(colors)
    .map(Number)
    .filter((id) => colors[id] != null);
  if (coloredIds.length === 0) return null;

  for (const characterId of moment.speaking_character_ids) {
    const preset = colors[characterId];
    if (preset) return preset;
  }

  if (moment.moment_type === "stage_direction") {
    for (const characterId of coloredIds) {
      if (isMyMoment(moment, [characterId], characters)) {
        return colors[characterId] ?? null;
      }
    }
  }

  return null;
}
