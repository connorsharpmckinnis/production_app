import { describe, expect, it } from "vitest";
import {
  chartMinWidthPx,
  intervalWidthPercent,
  onStageBarColor,
  spinePercent,
} from "@/lib/onStageChart";

describe("spinePercent", () => {
  it("maps indexes onto a 0–100 axis", () => {
    expect(spinePercent(0, 10)).toBe(0);
    expect(spinePercent(5, 10)).toBe(50);
    expect(spinePercent(10, 10)).toBe(100);
  });

  it("returns 0 when the spine is empty", () => {
    expect(spinePercent(0, 0)).toBe(0);
  });
});

describe("intervalWidthPercent", () => {
  it("uses exclusive end indexes", () => {
    expect(intervalWidthPercent(0, 5, 10)).toBe(50);
    expect(intervalWidthPercent(2, 3, 10)).toBe(10);
  });

  it("keeps a same-moment bar one slot wide", () => {
    expect(intervalWidthPercent(4, 4, 10)).toBe(10);
  });
});

describe("chartMinWidthPx", () => {
  it("grows with moment count but stays readable when short", () => {
    expect(chartMinWidthPx(10)).toBe(640);
    expect(chartMinWidthPx(300)).toBe(900);
  });
});

describe("onStageBarColor", () => {
  it("repeats a stable palette", () => {
    expect(onStageBarColor(0)).toBe(onStageBarColor(12));
    expect(onStageBarColor(0)).not.toBe(onStageBarColor(1));
  });
});
