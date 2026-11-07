import { useState } from "react";

const DETAIL_PANEL_WIDTH_KEY = "timelineDetailPanelWidth";
/** Compact default (~expanded nav width) so more Timeline script stays visible. */
const DEFAULT_DETAIL_PANEL_WIDTH = 224;
const MIN_DETAIL_PANEL_WIDTH = 200;
const MAX_DETAIL_PANEL_WIDTH = 720;

export function useDetailPanelWidth() {
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_DETAIL_PANEL_WIDTH;
    const stored = sessionStorage.getItem(DETAIL_PANEL_WIDTH_KEY);
    const parsed = stored ? Number(stored) : DEFAULT_DETAIL_PANEL_WIDTH;
    return Number.isFinite(parsed) ? parsed : DEFAULT_DETAIL_PANEL_WIDTH;
  });

  function persistWidth(nextWidth: number) {
    const clamped = Math.min(MAX_DETAIL_PANEL_WIDTH, Math.max(MIN_DETAIL_PANEL_WIDTH, nextWidth));
    setWidth(clamped);
    sessionStorage.setItem(DETAIL_PANEL_WIDTH_KEY, String(clamped));
  }

  return { width, persistWidth };
}
