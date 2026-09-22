import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CatalogDeleteImpact,
  CatalogReassignTarget,
  CatalogSubjectType,
  CharacterDetailResponse,
  GroupResponse,
} from "@/lib/types";

const REASSIGNABLE_LABELS: Record<string, string> = {
  dialogue: "dialogue lines",
  lyric_lines: "lyric lines",
  song_attributions: "song attributions",
  entrances: "entrances",
  exits: "exits",
  blocking: "blocking notes",
};

const BLOCKER_LABELS: Record<string, string> = {
  costumes: "costumes",
  costume_events: "costume events",
  lav_pack_assignments: "lav pack assignments",
  lav_wire_assignments: "lav wire assignments",
  prop_events: "prop affiliations",
  set_piece_events: "set-piece affiliations",
};

const AUTO_REMOVED_LABELS: Record<string, string> = {
  casting: "cast assignment",
  notes: "notes",
  group_memberships: "group memberships",
  character_memberships: "character memberships",
  user_memberships: "actor memberships",
};

function formatCountMap(
  counts: Record<string, number>,
  labels: Record<string, string>,
): string[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${labels[key] ?? key.replaceAll("_", " ")}`);
}

export interface CatalogSubjectDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: CatalogSubjectType;
  entityName: string;
  impact: CatalogDeleteImpact | null;
  loadingImpact: boolean;
  characters: CharacterDetailResponse[];
  groups: GroupResponse[];
  /** Exclude the entity being deleted from the target list. */
  excludeId: number;
  submitting: boolean;
  onConfirm: (reassignTo: CatalogReassignTarget | null) => void;
}

export default function CatalogSubjectDeleteDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  impact,
  loadingImpact,
  characters,
  groups,
  excludeId,
  submitting,
  onConfirm,
}: CatalogSubjectDeleteDialogProps) {
  const [targetKey, setTargetKey] = useState<string>("");

  useEffect(() => {
    if (open) setTargetKey("");
  }, [open, excludeId]);

  const needsReassignment = Boolean(impact && !impact.can_delete_without_reassignment);
  const hasBlockers = Boolean(impact && Object.keys(impact.character_only_blockers).length > 0);
  const characterOnlyTargetsRequired = hasBlockers && entityType === "character";

  const characterOptions = useMemo(
    () =>
      characters.filter(
        (character) => !(entityType === "character" && character.id === excludeId),
      ),
    [characters, entityType, excludeId],
  );
  const groupOptions = useMemo(
    () =>
      groups.filter((group) => !(entityType === "group" && group.id === excludeId)),
    [groups, entityType, excludeId],
  );

  const parsedTarget: CatalogReassignTarget | null = useMemo(() => {
    if (!targetKey) return null;
    const [type, idText] = targetKey.split(":");
    const id = Number(idText);
    if ((type !== "character" && type !== "group") || !Number.isFinite(id)) return null;
    return { type, id };
  }, [targetKey]);

  const groupTargetBlocked =
    characterOnlyTargetsRequired && parsedTarget?.type === "group";

  const canSubmit =
    !loadingImpact &&
    impact != null &&
    !submitting &&
    (!needsReassignment || (parsedTarget != null && !groupTargetBlocked));

  const reassignableLines = impact
    ? formatCountMap(impact.reassignable, REASSIGNABLE_LABELS)
    : [];
  const blockerLines = impact
    ? formatCountMap(impact.character_only_blockers, BLOCKER_LABELS)
    : [];
  const autoRemovedLines = impact
    ? formatCountMap(impact.auto_removed, AUTO_REMOVED_LABELS)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Delete {entityType === "character" ? "character" : "group"} “{entityName}”?
          </DialogTitle>
        </DialogHeader>

        {loadingImpact || !impact ? (
          <p className="text-sm text-muted-foreground">Checking what this is used for…</p>
        ) : (
          <div className="space-y-4 text-sm">
            {reassignableLines.length > 0 && (
              <div>
                <p className="font-medium">Attributed on Moments</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {reassignableLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {blockerLines.length > 0 && (
              <div>
                <p className="font-medium">Character-only records</p>
                <p className="mt-1 text-muted-foreground">
                  These can move to another character, but not to a group.
                </p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {blockerLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {autoRemovedLines.length > 0 && (
              <div>
                <p className="font-medium">Also cleared on delete</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {autoRemovedLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {!needsReassignment && (
              <p className="text-muted-foreground">
                Nothing on the Timeline references this {entityType}. It can be deleted
                directly.
              </p>
            )}

            {needsReassignment && (
              <div className="space-y-2">
                <Label htmlFor="reassign-target">
                  {characterOnlyTargetsRequired
                    ? "Reassign to character"
                    : "Reassign Moments to"}
                </Label>
                <Select value={targetKey || undefined} onValueChange={setTargetKey}>
                  <SelectTrigger id="reassign-target" className="w-full">
                    <SelectValue
                      placeholder={
                        characterOnlyTargetsRequired
                          ? "Choose a character…"
                          : "Choose a character or group…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {characterOptions.map((character) => (
                      <SelectItem
                        key={`character:${character.id}`}
                        value={`character:${character.id}`}
                      >
                        Character: {character.name}
                      </SelectItem>
                    ))}
                    {!characterOnlyTargetsRequired &&
                      groupOptions.map((group) => (
                        <SelectItem key={`group:${group.id}`} value={`group:${group.id}`}>
                          Group: {group.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {characterOnlyTargetsRequired && characterOptions.length === 0 && (
                  <p className="text-sm text-destructive">
                    No other characters available. Remove costumes/lav affiliations
                    first, or create a target character.
                  </p>
                )}
                {groupTargetBlocked && (
                  <p className="text-sm text-destructive">
                    Choose a character instead — character-only records cannot move to a
                    group.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => onConfirm(needsReassignment ? parsedTarget : null)}
          >
            {submitting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
