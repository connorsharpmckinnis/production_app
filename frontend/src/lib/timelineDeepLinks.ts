/** Pure helpers for Timeline deep-link parse and resolve. */

import type { ActSummary } from "@/lib/types";

/** Human show-position link: ?act=&scene=&moment= (moment optional → first). */
export type HumanTimelineDeepLink = {
  mode: "human";
  actNumber: number;
  sceneNumber: number;
  /** Per-scene sequence_number, or first moment in the scene. */
  momentSequence: number | "first";
};

/** Legacy PK link: ?scene=<sceneId>&moment=<momentId>. */
export type PkTimelineDeepLink = {
  mode: "pk";
  sceneId: number | null;
  momentId: number;
};

export type TimelineDeepLink = HumanTimelineDeepLink | PkTimelineDeepLink;

export type PendingMomentSelection =
  | { kind: "id"; id: number }
  | { kind: "sequence"; sequence: number }
  | { kind: "first" };

/** Scene + moment target; moment resolve waits until this scene is selected. */
export type PendingDeepLink = {
  sceneId: number | null;
  moment: PendingMomentSelection;
};

function parsePositiveInt(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * Parse Timeline search params.
 * Presence of `act` selects human mode; otherwise legacy PK mode when `moment` is set.
 */
export function parseTimelineDeepLink(
  params: URLSearchParams,
): TimelineDeepLink | null {
  const actParam = params.get("act");
  const sceneParam = params.get("scene");
  const momentParam = params.get("moment");

  if (actParam != null && actParam !== "") {
    const actNumber = parsePositiveInt(actParam);
    const sceneNumber = parsePositiveInt(sceneParam);
    if (actNumber == null || sceneNumber == null) return null;

    if (momentParam == null || momentParam === "") {
      return {
        mode: "human",
        actNumber,
        sceneNumber,
        momentSequence: "first",
      };
    }
    const momentSequence = parsePositiveInt(momentParam);
    if (momentSequence == null) return null;
    return {
      mode: "human",
      actNumber,
      sceneNumber,
      momentSequence,
    };
  }

  const momentId = parsePositiveInt(momentParam);
  if (momentId == null) return null;

  return {
    mode: "pk",
    sceneId: parsePositiveInt(sceneParam),
    momentId,
  };
}

/** Resolve act.number + scene.number to scene PK within loaded acts. */
export function resolveSceneIdByNumbers(
  acts: ActSummary[],
  actNumber: number,
  sceneNumber: number,
): number | null {
  const act = acts.find((item) => item.number === actNumber);
  if (!act) return null;
  const scene = act.scenes.find((item) => item.number === sceneNumber);
  return scene?.id ?? null;
}

export function pendingFromDeepLink(link: TimelineDeepLink): PendingMomentSelection {
  if (link.mode === "pk") {
    return { kind: "id", id: link.momentId };
  }
  if (link.momentSequence === "first") {
    return { kind: "first" };
  }
  return { kind: "sequence", sequence: link.momentSequence };
}

/** True when loaded moments belong to the pending deep-link scene (or scene is unconstrained). */
export function isPendingSceneReady(
  pendingSceneId: number | null,
  selectedSceneIds: number[],
): boolean {
  if (pendingSceneId == null) return true;
  return selectedSceneIds.length === 1 && selectedSceneIds[0] === pendingSceneId;
}

/** Map a pending selection to a moment PK once moments for the scene are loaded. */
export function resolvePendingMomentId(
  moments: Array<{ id: number; sequence_number: number }>,
  pending: PendingMomentSelection,
): number | null {
  if (moments.length === 0) return null;

  if (pending.kind === "id") {
    return moments.some((moment) => moment.id === pending.id) ? pending.id : null;
  }

  if (pending.kind === "first") {
    let first = moments[0];
    for (const moment of moments) {
      if (moment.sequence_number < first.sequence_number) {
        first = moment;
      }
    }
    return first.id;
  }

  const match = moments.find(
    (moment) => moment.sequence_number === pending.sequence,
  );
  return match?.id ?? null;
}

/** Build a human Timeline path for CTAs / share links. */
export function humanTimelinePath(
  productionId: number,
  actNumber: number,
  sceneNumber: number,
  momentSequence?: number,
): string {
  const base = `/productions/${productionId}/timeline?act=${actNumber}&scene=${sceneNumber}`;
  if (momentSequence == null) return base;
  return `${base}&moment=${momentSequence}`;
}

/** Display code matching bookmarks: act.scene.sequence (e.g. 1.3.10). */
export function formatMomentCode(
  actNumber: number,
  sceneNumber: number,
  sequenceNumber: number,
): string {
  return `${actNumber}.${sceneNumber}.${sequenceNumber}`;
}
