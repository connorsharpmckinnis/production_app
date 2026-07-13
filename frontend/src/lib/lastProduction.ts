const LAST_PRODUCTION_KEY = "last-production-id";
const LAST_PRODUCTION_TITLE_KEY = "last-production-title";

export function rememberLastProduction(id: number, title: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_PRODUCTION_KEY, String(id));
  if (title) {
    localStorage.setItem(LAST_PRODUCTION_TITLE_KEY, title);
  }
}

export function getLastProduction(): { id: number; title: string | null } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_PRODUCTION_KEY);
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    title: localStorage.getItem(LAST_PRODUCTION_TITLE_KEY),
  };
}
