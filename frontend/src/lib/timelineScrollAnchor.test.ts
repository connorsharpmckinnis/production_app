import { describe, expect, it } from "vitest";
import type { TimelineSection } from "@/components/TimelineMomentList";
import { resolveNearestMomentId } from "@/lib/timelineScrollAnchor";
import type { MomentSummary } from "@/lib/types";

function moment(partial: Partial<MomentSummary> & Pick<MomentSummary, "id" | "sequence_number">): MomentSummary {
  return {
    moment_type: "dialogue",
    original_text: "",
    display_text: "",
    song_id: null,
    speaking_character_ids: [],
    has_props: false,
    has_cues: false,
    has_set_piece: false,
    has_costume: false,
    has_entrance: false,
    has_exit: false,
    has_blocking: false,
    on_stage_character_ids: [],
    ...partial,
  };
}

function sections(): TimelineSection[] {
  return [
    {
      sceneId: 10,
      label: "Act 1 Scene 1",
      moments: [moment({ id: 1, sequence_number: 1 }), moment({ id: 2, sequence_number: 2 })],
    },
    {
      sceneId: 20,
      label: "Act 1 Scene 2",
      moments: [
        moment({ id: 3, sequence_number: 1 }),
        moment({ id: 4, sequence_number: 5 }),
        moment({ id: 5, sequence_number: 9 }),
      ],
    },
  ];
}

describe("resolveNearestMomentId", () => {
  it("returns the exact moment when still present", () => {
    expect(
      resolveNearestMomentId(sections(), {
        sceneId: 20,
        momentId: 4,
        sequenceNumber: 5,
      }),
    ).toBe(4);
  });

  it("picks nearest sequence in the same scene when the moment is gone", () => {
    expect(
      resolveNearestMomentId(sections(), {
        sceneId: 20,
        momentId: 999,
        sequenceNumber: 6,
      }),
    ).toBe(4);
  });

  it("falls forward to the next scene when the scene has no moments", () => {
    expect(
      resolveNearestMomentId(sections(), {
        sceneId: 15,
        momentId: 999,
        sequenceNumber: 1,
      }),
    ).toBe(3);
  });

  it("returns null for empty sections", () => {
    expect(
      resolveNearestMomentId([], {
        sceneId: 1,
        momentId: 1,
        sequenceNumber: 1,
      }),
    ).toBeNull();
  });
});
