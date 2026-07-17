/** Pure helpers and shared config for catalog CSV import UI. */

export const MAX_CATALOG_CSV_BYTES = 1 * 1024 * 1024; // 1 MiB

export type CatalogCsvKind =
  | "props"
  | "microphones"
  | "set-pieces"
  | "costumes"
  | "songs"
  | "cue-categories";

export interface CatalogCsvConfig {
  kind: CatalogCsvKind;
  /** Short label used in dialog titles (e.g. "props"). */
  label: string;
  /** Path segment under /productions/{id}/… */
  pathSegment: string;
  /** Fallback download filename when Content-Disposition is missing. */
  templateFilename: string;
  /** Extra help shown in the import dialog. */
  helpText?: string;
}

export const CATALOG_CSV_CONFIGS: Record<CatalogCsvKind, CatalogCsvConfig> = {
  props: {
    kind: "props",
    label: "props",
    pathSegment: "props",
    templateFilename: "props_template.csv",
  },
  microphones: {
    kind: "microphones",
    label: "microphones",
    pathSegment: "microphones",
    templateFilename: "microphones_template.csv",
  },
  "set-pieces": {
    kind: "set-pieces",
    label: "set pieces",
    pathSegment: "set-pieces",
    templateFilename: "set_pieces_template.csv",
  },
  costumes: {
    kind: "costumes",
    label: "costumes",
    pathSegment: "costumes",
    templateFilename: "costumes_template.csv",
    helpText:
      "Scene can be the exact title, Act N / Title, shorthand like 2:1, or use act + scene number columns.",
  },
  songs: {
    kind: "songs",
    label: "songs",
    pathSegment: "songs",
    templateFilename: "songs_template.csv",
  },
  "cue-categories": {
    kind: "cue-categories",
    label: "cue categories",
    pathSegment: "cue-categories",
    templateFilename: "cue_categories_template.csv",
  },
};

export function isCatalogCsvFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".csv");
}

/** Returns an error message when the file is not acceptable, otherwise null. */
export function validateCatalogCsvFile(file: File | null): string | null {
  if (!file) {
    return "Please select a .csv file.";
  }
  if (!isCatalogCsvFilename(file.name)) {
    return "Only .csv files are accepted.";
  }
  if (file.size > MAX_CATALOG_CSV_BYTES) {
    return `CSV file exceeds maximum size of ${formatByteSize(MAX_CATALOG_CSV_BYTES)}.`;
  }
  return null;
}

/** Human-readable byte size (binary units). */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kib = bytes / 1024;
    return Number.isInteger(kib) ? `${kib} KiB` : `${kib.toFixed(1)} KiB`;
  }
  const mib = bytes / (1024 * 1024);
  return Number.isInteger(mib) ? `${mib} MiB` : `${mib.toFixed(1)} MiB`;
}

/**
 * Parse a filename from a Content-Disposition header.
 * Supports `filename="…"` and `filename*=UTF-8''…`.
 */
export function parseContentDispositionFilename(
  header: string | null | undefined,
): string | null {
  if (!header) return null;

  const starMatch = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (starMatch) {
    const raw = starMatch[1].trim().replace(/^"|"$/g, "");
    const encoded = raw.includes("''") ? raw.split("''").slice(1).join("''") : raw;
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded || null;
    }
  }

  const plainMatch = /filename\s*=\s*([^;]+)/i.exec(header);
  if (plainMatch) {
    return plainMatch[1].trim().replace(/^"|"$/g, "") || null;
  }

  return null;
}

/** True when the server accepted the CSV and returned a result payload. */
export function shouldRefreshAfterCatalogImport(result: {
  created: number;
  skipped: number;
  errors: unknown[];
}): boolean {
  // Any HTTP-success import is a success or partial success — refresh the list.
  void result;
  return true;
}
