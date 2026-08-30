/** Derive the announcements route_filter key from the current path. */
export function routeKeyFromPath(pathname: string, search = ""): string | null {
  const match = pathname.match(/^\/productions\/\d+(?:\/([^/?#]+))?/);
  if (!match) return null;
  const route = match[1] ?? "overview";
  if (route === "rehearse") return "rehearse";
  if (route === "timeline") {
    const params = new URLSearchParams(search);
    return params.get("rehearse") === "1" ? "rehearse" : "timeline";
  }
  // Rehearsal detail and call-sheet are nested under the same route family.
  return route === "rehearsals" ? "rehearsals" : route;
}

export function productionIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/productions\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export const SEVERITY_BANNER_CLASSES: Record<string, string> = {
  info: "border-info/40 bg-info/10 text-foreground",
  success: "border-success/40 bg-success/10 text-foreground",
  warning: "border-warning/40 bg-warning/10 text-foreground",
  urgent: "border-destructive/40 bg-destructive/10 text-foreground",
};

export const ROUTE_FILTER_OPTIONS = [
  { value: "", label: "All pages in scope" },
  { value: "overview", label: "Overview" },
  { value: "rehearse", label: "Rehearse" },
  { value: "timeline", label: "Timeline" },
  { value: "rehearsals", label: "Rehearsals (including call sheets)" },
  { value: "characters", label: "Characters" },
  { value: "songs", label: "Songs" },
  { value: "props", label: "Props" },
  { value: "costumes", label: "Costumes" },
  { value: "set-pieces", label: "Set Pieces" },
  { value: "cue-categories", label: "Cue Categories" },
  { value: "people", label: "People" },
  { value: "groups", label: "Groups" },
  { value: "lav-chart", label: "Lav Chart" },
  { value: "reports", label: "Reports" },
] as const;
