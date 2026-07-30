import { describe, expect, it } from "vitest";
import {
  formatMomentCode,
  humanTimelinePath,
  isPendingSceneReady,
  parseTimelineDeepLink,
  pendingFromDeepLink,
  resolvePendingMomentId,
  resolveSceneIdByNumbers,
} from "@/lib/timelineDeepLinks";
import type { ActSummary } from "@/lib/types";

const acts: ActSummary[] = [
  {
    id: 10,
    number: 1,
    title: "Act 1",
    sort_order: 1,
    scenes: [
      { id: 100, number: 1, title: "Opening", sort_order: 1 },
      { id: 101, number: 2, title: "Next", sort_order: 2 },
    ],
  },
  {
    id: 11,
    number: 2,
    title: "Act 2",
    sort_order: 2,
    scenes: [{ id: 200, number: 1, title: "Later", sort_order: 1 }],
  },
];

describe("parseTimelineDeepLink", () => {
  it("parses human act/scene/moment", () => {
    const params = new URLSearchParams("act=1&scene=2&moment=115");
    expect(parseTimelineDeepLink(params)).toEqual({
      mode: "human",
      actNumber: 1,
      sceneNumber: 2,
      momentSequence: 115,
    });
  });

  it("omits moment as first-of-scene", () => {
    const params = new URLSearchParams("act=1&scene=2");
    expect(parseTimelineDeepLink(params)).toEqual({
      mode: "human",
      actNumber: 1,
      sceneNumber: 2,
      momentSequence: "first",
    });
  });

  it("parses legacy PK links when act is absent", () => {
    const params = new URLSearchParams("scene=101&moment=891");
    expect(parseTimelineDeepLink(params)).toEqual({
      mode: "pk",
      sceneId: 101,
      momentId: 891,
    });
  });

  it("rejects human links without a scene number", () => {
    expect(parseTimelineDeepLink(new URLSearchParams("act=1"))).toBeNull();
  });

  it("rejects empty params", () => {
    expect(parseTimelineDeepLink(new URLSearchParams())).toBeNull();
  });
});

describe("resolveSceneIdByNumbers", () => {
  it("resolves act/scene numbers to scene PK", () => {
    expect(resolveSceneIdByNumbers(acts, 1, 2)).toBe(101);
    expect(resolveSceneIdByNumbers(acts, 2, 1)).toBe(200);
  });

  it("returns null when missing", () => {
    expect(resolveSceneIdByNumbers(acts, 1, 9)).toBeNull();
    expect(resolveSceneIdByNumbers(acts, 9, 1)).toBeNull();
  });
});

describe("pendingFromDeepLink + resolvePendingMomentId", () => {
  const moments = [
    { id: 501, sequence_number: 2 },
    { id: 500, sequence_number: 1 },
    { id: 502, sequence_number: 3 },
  ];

  it("resolves first by lowest sequence_number", () => {
    const pending = pendingFromDeepLink({
      mode: "human",
      actNumber: 1,
      sceneNumber: 1,
      momentSequence: "first",
    });
    expect(resolvePendingMomentId(moments, pending)).toBe(500);
  });

  it("resolves sequence to moment id", () => {
    const pending = pendingFromDeepLink({
      mode: "human",
      actNumber: 1,
      sceneNumber: 1,
      momentSequence: 3,
    });
    expect(resolvePendingMomentId(moments, pending)).toBe(502);
  });

  it("resolves legacy PK when present", () => {
    const pending = pendingFromDeepLink({
      mode: "pk",
      sceneId: 101,
      momentId: 501,
    });
    expect(resolvePendingMomentId(moments, pending)).toBe(501);
  });

  it("returns null when sequence is missing", () => {
    expect(
      resolvePendingMomentId(moments, { kind: "sequence", sequence: 99 }),
    ).toBeNull();
  });
});

describe("isPendingSceneReady", () => {
  it("waits until exactly the target scene is selected", () => {
    expect(isPendingSceneReady(101, [100, 101, 200])).toBe(false);
    expect(isPendingSceneReady(101, [101])).toBe(true);
    expect(isPendingSceneReady(null, [100, 101])).toBe(true);
  });
});

describe("humanTimelinePath", () => {
  it("builds scene-start and moment paths", () => {
    expect(humanTimelinePath(18, 1, 2)).toBe(
      "/productions/18/timeline?act=1&scene=2",
    );
    expect(humanTimelinePath(18, 1, 2, 115)).toBe(
      "/productions/18/timeline?act=1&scene=2&moment=115",
    );
  });
});

describe("formatMomentCode", () => {
  it("formats dotted act.scene.sequence codes", () => {
    expect(formatMomentCode(1, 3, 10)).toBe("1.3.10");
  });
});
