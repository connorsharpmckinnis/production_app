import { describe, expect, it } from "vitest";
import {
  CATALOG_CSV_CONFIGS,
  formatByteSize,
  isCatalogCsvFilename,
  MAX_CATALOG_CSV_BYTES,
  parseContentDispositionFilename,
  shouldRefreshAfterCatalogImport,
  validateCatalogCsvFile,
} from "@/lib/catalogCsv";

describe("isCatalogCsvFilename", () => {
  it("accepts .csv regardless of case", () => {
    expect(isCatalogCsvFilename("props.csv")).toBe(true);
    expect(isCatalogCsvFilename("PROPS.CSV")).toBe(true);
  });

  it("rejects non-csv names", () => {
    expect(isCatalogCsvFilename("props.xlsx")).toBe(false);
    expect(isCatalogCsvFilename("props.csv.bak")).toBe(false);
  });
});

describe("formatByteSize", () => {
  it("formats bytes, kibibytes, and mebibytes", () => {
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(1024)).toBe("1 KiB");
    expect(formatByteSize(MAX_CATALOG_CSV_BYTES)).toBe("1 MiB");
  });
});

describe("validateCatalogCsvFile", () => {
  it("requires a file", () => {
    expect(validateCatalogCsvFile(null)).toBe("Please select a .csv file.");
  });

  it("rejects non-csv extensions", () => {
    const file = new File(["a,b"], "data.txt", { type: "text/plain" });
    expect(validateCatalogCsvFile(file)).toBe("Only .csv files are accepted.");
  });

  it("rejects files over 1 MiB", () => {
    const oversized = new File(
      [new Uint8Array(MAX_CATALOG_CSV_BYTES + 1)],
      "big.csv",
      { type: "text/csv" },
    );
    expect(validateCatalogCsvFile(oversized)).toBe(
      "CSV file exceeds maximum size of 1 MiB.",
    );
  });

  it("accepts a valid csv under the limit", () => {
    const file = new File(["name\nSword"], "props.csv", { type: "text/csv" });
    expect(validateCatalogCsvFile(file)).toBeNull();
  });
});

describe("parseContentDispositionFilename", () => {
  it("parses quoted filename", () => {
    expect(
      parseContentDispositionFilename(
        'attachment; filename="props_template.csv"',
      ),
    ).toBe("props_template.csv");
  });

  it("parses RFC 5987 filename*", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=UTF-8''costumes_template.csv",
      ),
    ).toBe("costumes_template.csv");
  });

  it("returns null for missing or empty headers", () => {
    expect(parseContentDispositionFilename(null)).toBeNull();
    expect(parseContentDispositionFilename("inline")).toBeNull();
  });
});

describe("shouldRefreshAfterCatalogImport", () => {
  it("refreshes for any successful import result", () => {
    expect(
      shouldRefreshAfterCatalogImport({ created: 2, skipped: 0, errors: [] }),
    ).toBe(true);
    expect(
      shouldRefreshAfterCatalogImport({
        created: 0,
        skipped: 3,
        errors: [{ row: 2, message: "bad" }],
      }),
    ).toBe(true);
  });
});

describe("CATALOG_CSV_CONFIGS", () => {
  it("includes costume scene help", () => {
    expect(CATALOG_CSV_CONFIGS.costumes.helpText).toMatch(/scene title/i);
    expect(CATALOG_CSV_CONFIGS.costumes.helpText).toMatch(/Act N/i);
  });

  it("uses useful template filenames", () => {
    expect(CATALOG_CSV_CONFIGS.props.templateFilename).toBe("props_template.csv");
    expect(CATALOG_CSV_CONFIGS["cue-categories"].templateFilename).toBe(
      "cue_categories_template.csv",
    );
  });
});
