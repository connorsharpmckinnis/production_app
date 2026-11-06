/** User-local display density prefs (this browser only). */

export type ScriptSizePx = 12 | 13 | 14 | 15 | 16;
export type TimelineRowPadding = "comfortable" | "compact" | "dense";
/** Scales rem-based UI chrome (headers, buttons, labels). Script size is separate. */
export type UiTextScale = "default" | "compact";

export interface DisplayPrefs {
  scriptSizePx: ScriptSizePx;
  timelineRowPadding: TimelineRowPadding;
  uiTextScale: UiTextScale;
}

export const SCRIPT_SIZE_OPTIONS: ScriptSizePx[] = [12, 13, 14, 15, 16];

export const TIMELINE_ROW_PADDING_OPTIONS: {
  value: TimelineRowPadding;
  label: string;
  description: string;
}[] = [
  { value: "comfortable", label: "Comfortable", description: "More space between lines" },
  { value: "compact", label: "Compact", description: "Default — denser Timeline" },
  { value: "dense", label: "Dense", description: "Maximum lines before scrolling" },
];

export const UI_TEXT_SCALE_OPTIONS: {
  value: UiTextScale;
  label: string;
}[] = [
  { value: "default", label: "Default" },
  { value: "compact", label: "Slightly smaller" },
];

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  scriptSizePx: 13,
  timelineRowPadding: "compact",
  uiTextScale: "default",
};

const STORAGE_KEY = "display.prefs";

const ROW_PADDING_VARS: Record<
  TimelineRowPadding,
  { py: string; gap: string; minH: string }
> = {
  comfortable: { py: "0.625rem", gap: "0.75rem", minH: "2.5rem" },
  compact: { py: "0.375rem", gap: "0.5rem", minH: "2rem" },
  dense: { py: "0.25rem", gap: "0.375rem", minH: "1.75rem" },
};

const UI_TEXT_SCALE_ROOT: Record<UiTextScale, string> = {
  default: "100%",
  compact: "93.75%",
};

function isScriptSizePx(value: unknown): value is ScriptSizePx {
  return value === 12 || value === 13 || value === 14 || value === 15 || value === 16;
}

function isTimelineRowPadding(value: unknown): value is TimelineRowPadding {
  return value === "comfortable" || value === "compact" || value === "dense";
}

function isUiTextScale(value: unknown): value is UiTextScale {
  return value === "default" || value === "compact";
}

export function readDisplayPrefs(): DisplayPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_DISPLAY_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_PREFS };
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>;
    return {
      scriptSizePx: isScriptSizePx(parsed.scriptSizePx)
        ? parsed.scriptSizePx
        : DEFAULT_DISPLAY_PREFS.scriptSizePx,
      timelineRowPadding: isTimelineRowPadding(parsed.timelineRowPadding)
        ? parsed.timelineRowPadding
        : DEFAULT_DISPLAY_PREFS.timelineRowPadding,
      uiTextScale: isUiTextScale(parsed.uiTextScale)
        ? parsed.uiTextScale
        : DEFAULT_DISPLAY_PREFS.uiTextScale,
    };
  } catch {
    return { ...DEFAULT_DISPLAY_PREFS };
  }
}

export function writeDisplayPrefs(prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/** Apply CSS variables used by Timeline rows and optional UI chrome scale. */
export function applyDisplayPrefs(prefs: DisplayPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const padding = ROW_PADDING_VARS[prefs.timelineRowPadding];
  root.style.setProperty("--timeline-script-size", `${prefs.scriptSizePx}px`);
  root.style.setProperty("--timeline-row-py", padding.py);
  root.style.setProperty("--timeline-row-gap", padding.gap);
  root.style.setProperty("--timeline-row-min-h", padding.minH);
  root.style.setProperty("--app-ui-font-size", UI_TEXT_SCALE_ROOT[prefs.uiTextScale]);
}

export function initDisplayPrefsFromStorage(): void {
  applyDisplayPrefs(readDisplayPrefs());
}
