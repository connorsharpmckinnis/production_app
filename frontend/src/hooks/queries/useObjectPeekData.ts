import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { momentDetailQueryOptions } from "@/hooks/queries/useMomentDetail";
import {
  useCharactersCatalog,
  useCostumesCatalog,
  useCueCategoriesCatalog,
  useGroupsCatalog,
  usePropsCatalog,
  useSetPiecesCatalog,
  useSongsCatalog,
} from "@/hooks/queries/useProductionCatalogs";
import type { ObjectDetailType } from "@/lib/objectDetail";

export interface ObjectPeekContent {
  typeLabel: string;
  title: string;
  eyebrow?: string;
  lines: string[];
  ready: boolean;
  pending: boolean;
}

function clampLines(text: string | null | undefined, maxChars = 160): string | null {
  if (!text?.trim()) return null;
  const compact = text.trim().replace(/\s+/g, " ");
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars).trimEnd()}…`;
}

export function useObjectPeekData(
  productionId: number | null,
  objectType: ObjectDetailType,
  objectId: number,
  momentId?: number,
): ObjectPeekContent {
  const enabled = productionId != null;

  const characters = useCharactersCatalog(
    productionId ?? 0,
    enabled && objectType === "character",
  );
  const props = usePropsCatalog(productionId ?? 0, enabled && objectType === "prop");
  const songs = useSongsCatalog(productionId ?? 0, enabled && objectType === "song");
  const setPieces = useSetPiecesCatalog(
    productionId ?? 0,
    enabled && objectType === "set_piece",
  );
  const costumes = useCostumesCatalog(
    productionId ?? 0,
    enabled && objectType === "costume",
  );
  const groups = useGroupsCatalog(productionId ?? 0, enabled && objectType === "group");
  const cueCategories = useCueCategoriesCatalog(
    productionId ?? 0,
    enabled && (objectType === "cue_category" || objectType === "cue"),
  );
  const momentQuery = useQuery({
    ...momentDetailQueryOptions(productionId ?? 0, momentId ?? 0),
    enabled: enabled && objectType === "cue" && momentId != null,
  });

  return useMemo((): ObjectPeekContent => {
    if (productionId == null) {
      return {
        typeLabel: "Object",
        title: "…",
        lines: [],
        ready: false,
        pending: false,
      };
    }

    switch (objectType) {
      case "character": {
        const row = characters.data?.find((item) => item.id === objectId);
        const pending = characters.isPending && !row;
        if (!row) {
          return {
            typeLabel: "Character",
            title: "Character",
            lines: pending ? [] : ["Not found in this production."],
            ready: !pending,
            pending,
          };
        }
        const cast = row.assigned_actor?.display_name
          ? `Cast: ${row.assigned_actor.display_name}`
          : "Cast: unassigned";
        const description = clampLines(row.description);
        return {
          typeLabel: "Character",
          title: row.name,
          eyebrow: `${row.scene_count} scene${row.scene_count === 1 ? "" : "s"}`,
          lines: [cast, ...(description ? [description] : ["No description yet."])],
          ready: true,
          pending: false,
        };
      }
      case "prop": {
        const row = props.data?.find((item) => item.id === objectId);
        const pending = props.isPending && !row;
        if (!row) {
          return {
            typeLabel: "Prop",
            title: "Prop",
            lines: pending ? [] : ["Not found."],
            ready: !pending,
            pending,
          };
        }
        const description = clampLines(row.description);
        const notes = clampLines(row.notes, 100);
        return {
          typeLabel: "Prop",
          title: row.name,
          lines: [
            ...(description ? [description] : ["No description yet."]),
            ...(notes ? [`Notes: ${notes}`] : []),
          ],
          ready: true,
          pending: false,
        };
      }
      case "song": {
        const row = songs.data?.find((item) => item.id === objectId);
        const pending = songs.isPending && !row;
        if (!row) {
          return {
            typeLabel: "Song",
            title: "Song",
            lines: pending ? [] : ["Not found."],
            ready: !pending,
            pending,
          };
        }
        const credit = [row.composer, row.lyricist].filter(Boolean).join(" · ");
        const description = clampLines(row.description);
        return {
          typeLabel: "Song",
          title: row.title,
          eyebrow: credit || undefined,
          lines: description ? [description] : ["No description yet."],
          ready: true,
          pending: false,
        };
      }
      case "set_piece": {
        const row = setPieces.data?.find((item) => item.id === objectId);
        const pending = setPieces.isPending && !row;
        if (!row) {
          return {
            typeLabel: "Set piece",
            title: "Set piece",
            lines: pending ? [] : ["Not found."],
            ready: !pending,
            pending,
          };
        }
        const description = clampLines(row.description);
        return {
          typeLabel: "Set piece",
          title: row.name,
          lines: description ? [description] : ["No description yet."],
          ready: true,
          pending: false,
        };
      }
      case "costume": {
        const row = costumes.data?.find((item) => item.id === objectId);
        const pending = costumes.isPending && !row;
        if (!row) {
          return {
            typeLabel: "Costume",
            title: "Costume",
            lines: pending ? [] : ["Not found."],
            ready: !pending,
            pending,
          };
        }
        const description = clampLines(row.description);
        return {
          typeLabel: "Costume",
          title: row.name,
          eyebrow: `For ${row.character_name}`,
          lines: description ? [description] : ["No description yet."],
          ready: true,
          pending: false,
        };
      }
      case "group": {
        const row = groups.data?.find((item) => item.id === objectId);
        const pending = groups.isPending && !row;
        if (!row) {
          return {
            typeLabel: "Group",
            title: "Group",
            lines: pending ? [] : ["Not found."],
            ready: !pending,
            pending,
          };
        }
        const description = clampLines(row.description);
        return {
          typeLabel: "Group",
          title: row.name,
          eyebrow: `${row.character_ids.length} character${
            row.character_ids.length === 1 ? "" : "s"
          }`,
          lines: description ? [description] : ["No description yet."],
          ready: true,
          pending: false,
        };
      }
      case "cue_category": {
        const row = cueCategories.data?.find((item) => item.id === objectId);
        const pending = cueCategories.isPending && !row;
        if (!row) {
          return {
            typeLabel: "Cue category",
            title: "Cue category",
            lines: pending ? [] : ["Not found."],
            ready: !pending,
            pending,
          };
        }
        const description = clampLines(row.description);
        return {
          typeLabel: "Cue category",
          title: row.name,
          lines: description ? [description] : ["Category for cues"],
          ready: true,
          pending: false,
        };
      }
      case "cue": {
        const cue = momentQuery.data?.cues.find((item) => item.id === objectId);
        const pending = momentQuery.isPending && !cue;
        if (!cue) {
          return {
            typeLabel: "Cue",
            title: "Cue",
            lines: pending ? [] : ["Needs a moment context."],
            ready: !pending,
            pending,
          };
        }
        const notes = clampLines(cue.notes, 100);
        return {
          typeLabel: "Cue",
          title: cue.title,
          eyebrow: cue.cue_category_name,
          lines: notes ? [notes] : ["No notes yet."],
          ready: true,
          pending: false,
        };
      }
      case "person":
        return {
          typeLabel: "Person",
          title: "Person",
          lines: ["Open for full details."],
          ready: true,
          pending: false,
        };
      default:
        return {
          typeLabel: "Object",
          title: "Peek",
          lines: [],
          ready: false,
          pending: false,
        };
    }
  }, [
    characters.data,
    characters.isPending,
    costumes.data,
    costumes.isPending,
    cueCategories.data,
    cueCategories.isPending,
    groups.data,
    groups.isPending,
    momentId,
    momentQuery.data,
    momentQuery.isPending,
    objectId,
    objectType,
    productionId,
    props.data,
    props.isPending,
    setPieces.data,
    setPieces.isPending,
    songs.data,
    songs.isPending,
  ]);
}
