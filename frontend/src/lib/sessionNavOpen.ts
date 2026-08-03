/** Persist sidebar section open/closed for the browser tab session. */

export function readSessionNavOpen(key: string, defaultOpen: boolean): boolean {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored === null) return defaultOpen;
    return stored === "1";
  } catch {
    return defaultOpen;
  }
}

export function writeSessionNavOpen(key: string, open: boolean): void {
  try {
    sessionStorage.setItem(key, open ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures.
  }
}
