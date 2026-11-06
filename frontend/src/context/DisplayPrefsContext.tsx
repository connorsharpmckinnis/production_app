import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDisplayPrefs,
  readDisplayPrefs,
  writeDisplayPrefs,
  type DisplayPrefs,
  type ScriptSizePx,
  type TimelineRowPadding,
  type UiTextScale,
} from "@/lib/displayPrefs";

interface DisplayPrefsContextValue {
  prefs: DisplayPrefs;
  setScriptSizePx: (size: ScriptSizePx) => void;
  setTimelineRowPadding: (padding: TimelineRowPadding) => void;
  setUiTextScale: (scale: UiTextScale) => void;
}

const DisplayPrefsContext = createContext<DisplayPrefsContextValue | null>(null);

export function DisplayPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPrefs>(() => readDisplayPrefs());

  useEffect(() => {
    applyDisplayPrefs(prefs);
  }, [prefs]);

  const update = useCallback((next: DisplayPrefs) => {
    setPrefs(next);
    writeDisplayPrefs(next);
    applyDisplayPrefs(next);
  }, []);

  const setScriptSizePx = useCallback(
    (scriptSizePx: ScriptSizePx) => {
      update({ ...prefs, scriptSizePx });
    },
    [prefs, update],
  );

  const setTimelineRowPadding = useCallback(
    (timelineRowPadding: TimelineRowPadding) => {
      update({ ...prefs, timelineRowPadding });
    },
    [prefs, update],
  );

  const setUiTextScale = useCallback(
    (uiTextScale: UiTextScale) => {
      update({ ...prefs, uiTextScale });
    },
    [prefs, update],
  );

  const value = useMemo(
    () => ({ prefs, setScriptSizePx, setTimelineRowPadding, setUiTextScale }),
    [prefs, setScriptSizePx, setTimelineRowPadding, setUiTextScale],
  );

  return (
    <DisplayPrefsContext.Provider value={value}>{children}</DisplayPrefsContext.Provider>
  );
}

export function useDisplayPrefs() {
  const context = useContext(DisplayPrefsContext);
  if (!context) {
    throw new Error("useDisplayPrefs must be used within DisplayPrefsProvider");
  }
  return context;
}
