import { describe, expect, it } from "vitest";
import {
  REHEARSAL_STRIP_NONE_LOCATION,
  clampRangeToWindow,
  formatMinutesLabel,
  minutesToTimeInput,
  nextDefaultRange,
  normalizeDragRange,
  partitionLocationLanes,
  snapMinutes,
} from "./rehearsalTimeStrip";

describe("rehearsalTimeStrip helpers", () => {
  it("snaps to 10-minute increments", () => {
    expect(snapMinutes(0)).toBe(0);
    expect(snapMinutes(4)).toBe(0);
    expect(snapMinutes(5)).toBe(10);
    expect(snapMinutes(14)).toBe(10);
    expect(snapMinutes(15)).toBe(20);
  });

  it("formats time inputs and labels", () => {
    expect(minutesToTimeInput(9 * 60 + 30)).toBe("09:30");
    expect(formatMinutesLabel(9 * 60)).toBe("9 AM");
    expect(formatMinutesLabel(13 * 60 + 30)).toBe("1:30 PM");
  });

  it("normalizes drag ranges inside the window", () => {
    const range = normalizeDragRange(18 * 60 + 4, 19 * 60 + 7, 18 * 60, 21 * 60);
    expect(range).toEqual({ start: 18 * 60, end: 19 * 60 + 10 });
  });

  it("clamps short ranges to the minimum duration", () => {
    expect(clampRangeToWindow(19 * 60, 19 * 60 + 5, 18 * 60, 21 * 60)).toEqual({
      start: 19 * 60,
      end: 19 * 60 + 10,
    });
  });

  it("picks the next free default slot after existing blocks", () => {
    expect(
      nextDefaultRange(18 * 60, 21 * 60, [
        { startMinutes: 18 * 60, endMinutes: 19 * 60 },
      ]),
    ).toEqual({ start: 19 * 60, end: 20 * 60 });
  });

  it("partitions active vs idle location lanes", () => {
    const { active, idle } = partitionLocationLanes(
      [
        { id: "1", name: "Studio B" },
        { id: "2", name: "Mainstage" },
      ],
      ["2"],
    );
    expect(active.map((row) => row.name)).toEqual(["Mainstage"]);
    expect(idle.map((row) => row.id).sort()).toEqual(
      ["1", REHEARSAL_STRIP_NONE_LOCATION].sort(),
    );
  });

  it("keeps No location active when used, and when nothing else is active", () => {
    const empty = partitionLocationLanes([{ id: "1", name: "Hall" }], []);
    expect(empty.active.map((row) => row.id)).toEqual([REHEARSAL_STRIP_NONE_LOCATION]);
    expect(empty.idle.map((row) => row.id)).toEqual(["1"]);

    const withNone = partitionLocationLanes(
      [{ id: "1", name: "Hall" }],
      [REHEARSAL_STRIP_NONE_LOCATION],
    );
    expect(withNone.active.map((row) => row.id)).toContain(REHEARSAL_STRIP_NONE_LOCATION);
    expect(withNone.active.map((row) => row.id)).not.toContain("1");
  });
});
