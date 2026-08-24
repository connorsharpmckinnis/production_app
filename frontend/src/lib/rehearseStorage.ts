import type { RehearseDisplayToggles, RehearsePresetId } from "@/lib/rehearsePresets";

export const rehearseStorageKey = (productionId: number) => `rehearse-${productionId}`;

export interface StoredRehearseState {
  rehearseMode: boolean;
  preset: RehearsePresetId;
  toggles: RehearseDisplayToggles;
}

export function loadRehearseState(productionId: number): StoredRehearseState | null {
  if (typeof window === "undefined") return null;
  const key = rehearseStorageKey(productionId);
  let raw = localStorage.getItem(key);
  if (!raw) {
    const sessionRaw = sessionStorage.getItem(key);
    if (sessionRaw) {
      localStorage.setItem(key, sessionRaw);
      sessionStorage.removeItem(key);
      raw = sessionRaw;
    }
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRehearseState>;
    if (!parsed.preset || !parsed.toggles) return null;
    return {
      rehearseMode: parsed.rehearseMode ?? false,
      preset: parsed.preset,
      toggles: parsed.toggles,
    };
  } catch {
    return null;
  }
}

export function saveRehearseState(productionId: number, state: StoredRehearseState) {
  localStorage.setItem(rehearseStorageKey(productionId), JSON.stringify(state));
}
