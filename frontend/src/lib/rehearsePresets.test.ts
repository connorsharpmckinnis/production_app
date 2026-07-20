import { describe, expect, it } from "vitest";
import type { MomentSummary } from "@/lib/types";
import {
  applyRehearsePreset,
  applyRehearseToggles,
  filterLineCues,
  filterMyLines,
  filterSceneRunThrough,
  PRESET_DEFAULT_TOGGLES,
  togglesMatchPreset,
} from "@/lib/rehearsePresets";
import { isMyMoment, isMySpokenLine } from "@/lib/momentHighlight";

const characters = [
  { id: 1, name: "ALICE" },
  { id: 2, name: "BOB" },
] as const;

const moments: MomentSummary[] = [
  {
    id: 1,
    sequence_number: 1,
    moment_type: "stage_direction",
    original_text: "ALICE enters.",
    display_text: "ALICE enters.",
    song_id: null,
    speaking_character_ids: [],
    has_props: false,
    has_cues: false,
    has_microphone: false,
    has_set_piece: false,
    has_costume: false,
    has_entrance: false,
    has_exit: false,
    has_blocking: false,
    on_stage_character_ids: [],
  },
  {
    id: 2,
    sequence_number: 2,
    moment_type: "dialogue",
    original_text: "BOB: Hello.",
    display_text: "BOB: Hello.",
    song_id: null,
    speaking_character_ids: [2],
    has_props: false,
    has_cues: false,
    has_microphone: false,
    has_set_piece: false,
    has_costume: false,
    has_entrance: false,
    has_exit: false,
    has_blocking: false,
    on_stage_character_ids: [],
  },
  {
    id: 3,
    sequence_number: 3,
    moment_type: "dialogue",
    original_text: "ALICE: Hi there.",
    display_text: "ALICE: Hi there.",
    song_id: null,
    speaking_character_ids: [1],
    has_props: false,
    has_cues: false,
    has_microphone: false,
    has_set_piece: false,
    has_costume: false,
    has_entrance: false,
    has_exit: false,
    has_blocking: false,
    on_stage_character_ids: [],
  },
];

describe("isMyMoment", () => {
  it("matches dialogue speaking character", () => {
    expect(isMyMoment(moments[2], [1], characters as never)).toBe(true);
    expect(isMyMoment(moments[1], [1], characters as never)).toBe(false);
  });

  it("matches stage direction referencing character name", () => {
    expect(isMyMoment(moments[0], [1], characters as never)).toBe(true);
  });
});

describe("isMySpokenLine", () => {
  it("matches dialogue speaking character only", () => {
    expect(isMySpokenLine(moments[2], [1])).toBe(true);
    expect(isMySpokenLine(moments[1], [1])).toBe(false);
  });

  it("does not match stage directions that name the character", () => {
    expect(isMySpokenLine(moments[0], [1])).toBe(false);
  });
});

describe("rehearse presets", () => {
  const myIds = [1];

  it("scene run-through keeps all moments", () => {
    expect(filterSceneRunThrough(moments, myIds)).toHaveLength(3);
  });

  it("my lines keeps actor dialogue and referencing stage directions", () => {
    const result = filterMyLines(moments, myIds, characters as never);
    expect(result.map((moment) => moment.id)).toEqual([1, 3]);
  });

  it("line cues includes predecessor for each my-line moment", () => {
    const result = filterLineCues(moments, myIds, characters as never);
    expect(result.map((moment) => moment.id)).toEqual([1, 2, 3]);
  });

  it("applyRehearseToggles hides stage directions", () => {
    const result = applyRehearseToggles(moments, {
      ...PRESET_DEFAULT_TOGGLES.scene_run_through,
      showStageDirections: false,
    });
    expect(result).toHaveLength(2);
  });

  it("preset toggles detect custom state", () => {
    expect(togglesMatchPreset("scene_run_through", PRESET_DEFAULT_TOGGLES.scene_run_through)).toBe(
      true,
    );
    expect(
      togglesMatchPreset("scene_run_through", {
        ...PRESET_DEFAULT_TOGGLES.scene_run_through,
        showPrepBadges: true,
      }),
    ).toBe(false);
  });

  it("blur my lines does not force custom away from a filtering preset", () => {
    expect(
      togglesMatchPreset("line_cues", {
        ...PRESET_DEFAULT_TOGGLES.line_cues,
        blurMyLines: true,
      }),
    ).toBe(true);
  });

  it("applyRehearsePreset preserves order", () => {
    const result = applyRehearsePreset("line_cues", moments, myIds, characters as never);
    expect(result.map((moment) => moment.sequence_number)).toEqual([1, 2, 3]);
  });
});
