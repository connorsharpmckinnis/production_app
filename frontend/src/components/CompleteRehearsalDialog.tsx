import { useEffect, useMemo, useState } from "react";
import RehearsalTargetPicker from "@/components/RehearsalTargetPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type {
  ActSummary,
  RehearsalBlockTargetResponse,
  RehearsalBlockTargetWrite,
  RehearsalFocus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type SongOption = {
  id: number;
  title: string;
};

type ListedTarget = {
  key: string;
  focus: RehearsalFocus | string;
  scene_id: number | null;
  song_id: number | null;
  label: string;
  onPlan: boolean;
};

function targetKey(target: {
  focus: string;
  scene_id?: number | null;
  song_id?: number | null;
}): string {
  if (target.focus === "dialog") return `dialog:${target.scene_id}`;
  return `${target.focus}:${target.song_id}`;
}

function labelForWrite(
  target: RehearsalBlockTargetWrite,
  acts: ActSummary[],
  songs: SongOption[],
): string {
  if (target.focus === "dialog" && target.scene_id != null) {
    for (const act of acts) {
      const scene = act.scenes.find((item) => item.id === target.scene_id);
      if (scene) {
        const base = scene.title
          ? `Act ${act.number} › Scene ${scene.number} — ${scene.title}`
          : `Act ${act.number} › Scene ${scene.number}`;
        return `${base} · Dialog`;
      }
    }
    return "Scene · Dialog";
  }
  const song = songs.find((item) => item.id === target.song_id);
  const kind = target.focus === "music" ? "Music" : "Choreo";
  return `${song?.title ?? "Song"} · ${kind}`;
}

function buildInitialList(
  planned: RehearsalBlockTargetResponse[],
): ListedTarget[] {
  const seen = new Set<string>();
  const items: ListedTarget[] = [];
  for (const target of planned) {
    const key = targetKey(target);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      focus: target.focus,
      scene_id: target.scene_id,
      song_id: target.song_id,
      label: target.label,
      onPlan: true,
    });
  }
  return items;
}

export interface CompleteRehearsalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acts: ActSummary[];
  songs: SongOption[];
  plannedTargets: RehearsalBlockTargetResponse[];
  busy?: boolean;
  onConfirm: (workedOn: RehearsalBlockTargetWrite[]) => void;
}

export default function CompleteRehearsalDialog({
  open,
  onOpenChange,
  acts,
  songs,
  plannedTargets,
  busy = false,
  onConfirm,
}: CompleteRehearsalDialogProps) {
  const [items, setItems] = useState<ListedTarget[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [addingOthers, setAddingOthers] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = buildInitialList(plannedTargets);
    setItems(initial);
    setCheckedKeys(new Set(initial.map((item) => item.key)));
    setAddingOthers(false);
  }, [open, plannedTargets]);

  const checkedWrites = useMemo((): RehearsalBlockTargetWrite[] => {
    return items
      .filter((item) => checkedKeys.has(item.key))
      .map((item) => ({
        focus: item.focus,
        scene_id: item.focus === "dialog" ? item.scene_id : null,
        song_id: item.focus === "dialog" ? null : item.song_id,
      }));
  }, [items, checkedKeys]);

  function toggleKey(key: string, checked: boolean) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function handlePickerChange(next: RehearsalBlockTargetWrite[]) {
    const plannedKeys = new Set(
      plannedTargets.map((target) => targetKey(target)),
    );
    const byKey = new Map(items.map((item) => [item.key, item]));
    const merged: ListedTarget[] = [];
    const seen = new Set<string>();

    for (const target of plannedTargets) {
      const key = targetKey(target);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({
        key,
        focus: target.focus,
        scene_id: target.scene_id,
        song_id: target.song_id,
        label: target.label,
        onPlan: true,
      });
    }

    for (const target of next) {
      const key = targetKey(target);
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = byKey.get(key);
      merged.push({
        key,
        focus: target.focus,
        scene_id: target.scene_id ?? null,
        song_id: target.song_id ?? null,
        label: existing?.label ?? labelForWrite(target, acts, songs),
        onPlan: plannedKeys.has(key),
      });
    }

    setItems(merged);
    setCheckedKeys(new Set(next.map((target) => targetKey(target))));
  }

  const checkedCount = checkedKeys.size;
  const planCount = items.filter((item) => item.onPlan).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What did you work on?</DialogTitle>
          <DialogDescription>
            Plan items start checked. Uncheck anything you did not get to — only
            checked items will bump rehearsal counts. Completing with nothing
            checked is allowed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing was on the plan. Use Add other items if you still want to
              record work, or complete with no counts.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {items.map((item) => {
                const id = `complete-target-${item.key}`;
                const checked = checkedKeys.has(item.key);
                return (
                  <li key={item.key}>
                    <Label
                      htmlFor={id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 font-normal hover:bg-accent",
                        item.onPlan && "bg-emerald-500/10",
                      )}
                    >
                      <Checkbox
                        id={id}
                        className="mt-0.5"
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleKey(item.key, value === true)
                        }
                      />
                      <span className="text-sm leading-snug">
                        {item.label}
                        {item.onPlan ? (
                          <span className="text-muted-foreground"> · on plan</span>
                        ) : (
                          <span className="text-muted-foreground"> · added</span>
                        )}
                      </span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-2">
            {!addingOthers ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddingOthers(true)}
              >
                Add other items
              </Button>
            ) : (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Add other items</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0"
                    onClick={() => setAddingOthers(false)}
                  >
                    Done
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Search and check anything else you worked on. Plan items stay
                  listed above.
                </p>
                <RehearsalTargetPicker
                  acts={acts}
                  songs={songs}
                  selected={checkedWrites}
                  onChange={handlePickerChange}
                  showSelectedChips={false}
                />
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {checkedCount} selected
            {planCount > 0 ? ` · ${planCount} were on the plan` : ""}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(checkedWrites)}
          >
            {busy ? "Completing…" : "Complete rehearsal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
