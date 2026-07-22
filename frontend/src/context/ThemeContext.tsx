import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system" | "color" | "footlights";

const STORAGE_KEY = "theme";
const PALETTE_CLASSES = ["color", "footlights"] as const;

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isThemePreference(value: string | null): value is ThemePreference {
  return (
    value === "light" ||
    value === "dark" ||
    value === "system" ||
    value === "color" ||
    value === "footlights"
  );
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isThemePreference(stored)) return stored;
  return "system";
}

function usesSystemBrightness(preference: ThemePreference): boolean {
  return preference === "system" || preference === "color" || preference === "footlights";
}

function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return getSystemTheme();
}

function applyThemeClasses(preference: ThemePreference, resolved: "light" | "dark") {
  const root = document.documentElement;
  for (const className of PALETTE_CLASSES) {
    root.classList.remove(className);
  }
  if (preference === "color" || preference === "footlights") {
    root.classList.add(preference);
  }
  root.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(readStoredPreference()),
  );

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    localStorage.setItem(STORAGE_KEY, next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyThemeClasses(next, resolved);
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(preference);
    setResolvedTheme(resolved);
    applyThemeClasses(preference, resolved);
  }, [preference]);

  useEffect(() => {
    if (!usesSystemBrightness(preference)) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = resolveTheme(preference);
      setResolvedTheme(resolved);
      applyThemeClasses(preference, resolved);
    };

    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, [preference]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

/** Apply stored theme before React paints to avoid a flash of the wrong mode. */
export function initThemeFromStorage() {
  const preference = readStoredPreference();
  const resolved = resolveTheme(preference);
  applyThemeClasses(preference, resolved);
}
