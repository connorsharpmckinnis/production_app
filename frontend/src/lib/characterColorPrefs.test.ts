import { describe, expect, it } from "vitest";
import {
  isCharacterColorPreset,
  parseCharacterColorMap,
  withCharacterColor,
} from "@/lib/characterColorPrefs";
import { characterColorForMoment } from "@/lib/characterColorResolve";
import type { CharacterDetailResponse, MomentSummary } from "@/lib/types";

function moment(partial: Partial<MomentSummary> & Pick<MomentSummary, "id">): MomentSummary {
  return {
    sequence_number: 1,
    moment_type: "dialogue",
    original_text: "Hello",
    display_text: "Hello",
    song_id: null,
    speaking_character_ids: [],
    speaking_group_ids: [],
    has_props: false,
    has_cues: false,
    has_set_piece: false,
    has_costume: false,
    has_entrance: false,
    has_exit: false,
    has_blocking: false,
    on_stage_character_ids: [],
    prop_ids: [],
    set_piece_ids: [],
    ...partial,
  };
}

describe("characterColorPrefs", () => {
  it("validates presets", () => {
    expect(isCharacterColorPreset("sky")).toBe(true);
    expect(isCharacterColorPreset("neon")).toBe(false);
  });

  it("parses only valid character id → preset pairs", () => {
    expect(
      parseCharacterColorMap({
        "12": "teal",
        "nope": "sky",
        "3": "neon",
        "4": "amber",
      }),
    ).toEqual({ 12: "teal", 4: "amber" });
  });

  it("clears a color with withCharacterColor", () => {
    expect(withCharacterColor({ 1: "rose", 2: "sky" }, 1, null)).toEqual({
      2: "sky",
    });
  });
});

describe("characterColorForMoment", () => {
  const characters = [
    { id: 1, name: "Ebenezer" },
    { id: 2, name: "Marley" },
  ] as CharacterDetailResponse[];

  it("uses speaking character color first", () => {
    const color = characterColorForMoment(
      moment({ id: 10, speaking_character_ids: [2, 1] }),
      { 1: "green", 2: "violet" },
      characters,
    );
    expect(color).toBe("violet");
  });

  it("does not color group-attributed lines from member colors", () => {
    const color = characterColorForMoment(
      moment({
        id: 13,
        speaking_character_ids: [],
        speaking_group_ids: [99],
        display_text: "All: Hurrah!",
      }),
      { 1: "green", 2: "violet" },
      characters,
    );
    expect(color).toBeNull();
  });

  it("matches stage direction by character name", () => {
    const color = characterColorForMoment(
      moment({
        id: 11,
        moment_type: "stage_direction",
        display_text: "Marley enters upstage.",
        speaking_character_ids: [],
      }),
      { 2: "amber" },
      characters,
    );
    expect(color).toBe("amber");
  });

  it("returns null when no colored character matches", () => {
    const color = characterColorForMoment(
      moment({ id: 12, speaking_character_ids: [1] }),
      { 2: "pink" },
      characters,
    );
    expect(color).toBeNull();
  });
});
