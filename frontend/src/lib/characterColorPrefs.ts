/**
 * Per-user, per-production character highlight colors (this browser only).
 * Preset ids map to theme CSS variables so colors work across light/dark/brand schemes.
 */

export const CHARACTER_COLOR_PRESETS = [
  "sky",
  "teal",
  "green",
  "amber",
  "orange",
  "rose",
  "violet",
  "pink",
] as const;

export type CharacterColorPreset = (typeof CHARACTER_COLOR_PRESETS)[number];

export type CharacterColorMap = Record<number, CharacterColorPreset>;

export const CHARACTER_COLOR_PRESET_META: {
  id: CharacterColorPreset;
  label: string;
}[] = [
  { id: "sky", label: "Sky" },
  { id: "teal", label: "Teal" },
  { id: "green", label: "Green" },
  { id: "amber", label: "Amber" },
  { id: "orange", label: "Orange" },
  { id: "rose", label: "Rose" },
  { id: "violet", label: "Violet" },
  { id: "pink", label: "Pink" },
];

const PRESET_SET = new Set<string>(CHARACTER_COLOR_PRESETS);

export function isCharacterColorPreset(
  value: unknown,
): value is CharacterColorPreset {
  return typeof value === "string" && PRESET_SET.has(value);
}

export function characterColorStorageKey(
  productionId: number,
  userId: number,
): string {
  return `character-colors-${userId}-${productionId}`;
}

export function parseCharacterColorMap(raw: unknown): CharacterColorMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: CharacterColorMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const characterId = Number(key);
    if (!Number.isFinite(characterId) || characterId <= 0) continue;
    if (!isCharacterColorPreset(value)) continue;
    result[characterId] = value;
  }
  return result;
}

export function readCharacterColorMap(
  productionId: number,
  userId: number | undefined,
): CharacterColorMap {
  if (typeof window === "undefined" || userId == null) return {};
  try {
    const raw = localStorage.getItem(
      characterColorStorageKey(productionId, userId),
    );
    if (!raw) return {};
    return parseCharacterColorMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

export function writeCharacterColorMap(
  productionId: number,
  userId: number,
  colors: CharacterColorMap,
): void {
  try {
    const key = characterColorStorageKey(productionId, userId);
    if (Object.keys(colors).length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(colors));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/** Immutable update helper — omit the character when clearing. */
export function withCharacterColor(
  colors: CharacterColorMap,
  characterId: number,
  preset: CharacterColorPreset | null,
): CharacterColorMap {
  const next = { ...colors };
  if (preset == null) {
    delete next[characterId];
  } else {
    next[characterId] = preset;
  }
  return next;
}
