import { describe, expect, it } from "vitest";
import {
  bandLabel,
  dimensionHref,
  hashSpotlightSeed,
  isValidRotationSeconds,
  localDayKey,
  nextSpotlightIndex,
  previousSpotlightIndex,
  shouldRotateSpotlight,
  spotlightStartIndex,
} from "@/lib/overviewSpotlight";

describe("localDayKey", () => {
  it("formats a local calendar day as YYYY-MM-DD", () => {
    expect(localDayKey(new Date(2026, 6, 16))).toBe("2026-07-16");
  });
});

describe("spotlightStartIndex", () => {
  it("returns 0 for an empty queue", () => {
    expect(spotlightStartIndex(1, "2026-07-16", 0)).toBe(0);
  });

  it("is deterministic for the same production and day", () => {
    const a = spotlightStartIndex(42, "2026-07-16", 5);
    const b = spotlightStartIndex(42, "2026-07-16", 5);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(5);
  });

  it("can differ across days for the same production", () => {
    const day1 = spotlightStartIndex(7, "2026-07-16", 8);
    const day2 = spotlightStartIndex(7, "2026-07-17", 8);
    // Not guaranteed different, but seed hashes should differ.
    expect(hashSpotlightSeed(7, "2026-07-16")).not.toBe(
      hashSpotlightSeed(7, "2026-07-17"),
    );
    expect(day1).toBe(hashSpotlightSeed(7, "2026-07-16") % 8);
    expect(day2).toBe(hashSpotlightSeed(7, "2026-07-17") % 8);
  });
});

describe("shouldRotateSpotlight", () => {
  it("does not rotate when rotation is 0", () => {
    expect(shouldRotateSpotlight(0, 3)).toBe(false);
  });

  it("does not rotate for a single item", () => {
    expect(shouldRotateSpotlight(20, 1)).toBe(false);
  });

  it("rotates when seconds are positive and there are multiple items", () => {
    expect(shouldRotateSpotlight(20, 2)).toBe(true);
  });
});

describe("nextSpotlightIndex", () => {
  it("wraps around the queue", () => {
    expect(nextSpotlightIndex(0, 3)).toBe(1);
    expect(nextSpotlightIndex(2, 3)).toBe(0);
  });
});

describe("previousSpotlightIndex", () => {
  it("wraps backward around the queue", () => {
    expect(previousSpotlightIndex(2, 3)).toBe(1);
    expect(previousSpotlightIndex(0, 3)).toBe(2);
    expect(previousSpotlightIndex(0, 0)).toBe(0);
  });
});

describe("dimensionHref", () => {
  it("maps known hints to production routes", () => {
    expect(dimensionHref(9, "costumes")).toBe("/productions/9/costumes");
    expect(dimensionHref(9, "cue-categories")).toBe(
      "/productions/9/cue-categories",
    );
    expect(dimensionHref(9, "lav_chart")).toBe("/productions/9/lav-chart");
    expect(dimensionHref(9, "microphones")).toBe("/productions/9/lav-chart");
  });

  it("falls back to the production overview for unknown hints", () => {
    expect(dimensionHref(9, "unknown")).toBe("/productions/9");
  });
});

describe("band and rotation helpers", () => {
  it("labels readiness bands for display", () => {
    expect(bandLabel("0")).toBe("0%");
    expect(bandLabel("75-89")).toBe("75-89%");
    expect(bandLabel("100")).toBe("100%");
  });

  it("accepts 0 or 5–300 for rotation seconds", () => {
    expect(isValidRotationSeconds(0)).toBe(true);
    expect(isValidRotationSeconds(5)).toBe(true);
    expect(isValidRotationSeconds(300)).toBe(true);
    expect(isValidRotationSeconds(4)).toBe(false);
    expect(isValidRotationSeconds(301)).toBe(false);
  });
});
