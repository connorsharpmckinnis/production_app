import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ActSummary } from "@/lib/types";
import { cn, formatActLabel } from "@/lib/utils";

export interface SceneMultiSelectProps {
  acts: ActSummary[];
  selectedSceneIds: number[];
  onChange: (sceneIds: number[]) => void;
}

function sceneLabel(actNumber: number, scene: { number: number; title: string | null }): string {
  const base = `Act ${actNumber} › Scene ${scene.number}`;
  return scene.title ? `${base} — ${scene.title}` : base;
}

export default function SceneMultiSelect({
  acts,
  selectedSceneIds,
  onChange,
}: SceneMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allSceneIds = useMemo(
    () => acts.flatMap((act) => act.scenes.map((scene) => scene.id)),
    [acts],
  );

  const selectedSet = useMemo(() => new Set(selectedSceneIds), [selectedSceneIds]);
  const allSelected = allSceneIds.length > 0 && allSceneIds.every((id) => selectedSet.has(id));
  const noneSelected = selectedSceneIds.length === 0;

  const buttonLabel = (() => {
    if (allSelected) return "All scenes";
    if (noneSelected) return "No scenes selected";
    if (selectedSceneIds.length === 1) {
      for (const act of acts) {
        const scene = act.scenes.find((item) => item.id === selectedSceneIds[0]);
        if (scene) return sceneLabel(act.number, scene);
      }
    }
    return `${selectedSceneIds.length} scenes`;
  })();

  function toggleScene(sceneId: number) {
    if (selectedSet.has(sceneId)) {
      onChange(selectedSceneIds.filter((id) => id !== sceneId));
    } else {
      onChange([...selectedSceneIds, sceneId]);
    }
  }

  function selectAll() {
    onChange([...allSceneIds]);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        className="font-normal"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {buttonLabel}
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close scene picker"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground">
            <div className="mb-2 flex gap-2 border-b border-border pb-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={selectAll}
                className="h-auto px-0 text-xs"
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={clearAll}
                className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
            <div className="space-y-3">
              {acts.map((act) => (
                <div key={act.id}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {formatActLabel(act)}
                  </p>
                  <ul className="space-y-1">
                    {act.scenes.map((scene) => {
                      const checked = selectedSet.has(scene.id);
                      const id = `scene-${scene.id}`;
                      return (
                        <li key={scene.id}>
                          <Label
                            htmlFor={id}
                            className={cn(
                              "flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 font-normal hover:bg-accent",
                            )}
                          >
                            <Checkbox
                              id={id}
                              className="mt-0.5"
                              checked={checked}
                              onCheckedChange={() => toggleScene(scene.id)}
                            />
                            <span className="text-sm leading-snug">
                              Scene {scene.number}
                              {scene.title ? `: ${scene.title}` : ""}
                            </span>
                          </Label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
