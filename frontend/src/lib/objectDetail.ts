/** Shared types for the ephemeral object-detail sheet host. */

export type ObjectDetailType =
  | "character"
  | "prop"
  | "song"
  | "set_piece"
  | "costume"
  | "group"
  | "cue"
  | "person"
  | "cue_category";

export interface ObjectDetailTarget {
  type: ObjectDetailType;
  id: number;
  /** Required for moment-scoped types (cue). */
  momentId?: number;
  /** Optional scene filter for Layer F (e.g. Character from scene summary). */
  sceneId?: number;
  /** Display label for the scene context section (e.g. "Act 1, Scene 2"). */
  sceneLabel?: string;
  /** Last moment in the scene — used for end-of-scene asset state via getMoment. */
  sceneEndMomentId?: number;
}

export interface ObjectDetailTypeMeta {
  /** Capability resource key, e.g. "characters". */
  resource: string;
  /** Short type label for the sheet title, e.g. "Character". */
  typeLabel: string;
}

export const OBJECT_DETAIL_TYPE_META: Record<ObjectDetailType, ObjectDetailTypeMeta> = {
  character: { resource: "characters", typeLabel: "Character" },
  prop: { resource: "props", typeLabel: "Prop" },
  song: { resource: "songs", typeLabel: "Song" },
  set_piece: { resource: "set_pieces", typeLabel: "Set piece" },
  costume: { resource: "costumes", typeLabel: "Costume" },
  group: { resource: "groups", typeLabel: "Group" },
  cue: { resource: "cues", typeLabel: "Cue" },
  person: { resource: "people", typeLabel: "Person" },
  cue_category: { resource: "cue_categories", typeLabel: "Cue category" },
};

export function isObjectDetailType(value: string): value is ObjectDetailType {
  return value in OBJECT_DETAIL_TYPE_META;
}
