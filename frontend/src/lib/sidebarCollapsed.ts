/** Persist desktop sidebar collapsed/expanded preference. */

const STORAGE_KEY = "sidebar.collapsed";

export function readSidebarCollapsed(defaultCollapsed = false): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return defaultCollapsed;
    return stored === "1";
  } catch {
    return defaultCollapsed;
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures.
  }
}
