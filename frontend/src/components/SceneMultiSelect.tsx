import { useMemo, useRef, useState } from "react";
import type { ActSummary } from "@/lib/types";
import { formatActLabel } from "@/lib/utils";

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
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {buttonLabel}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close scene picker"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-border bg-background p-2 shadow-md">
            <div className="mb-2 flex gap-2 border-b border-border pb-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-primary hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="space-y-3">
              {acts.map((act) => (
                <div key={act.id}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {formatActLabel(act)}
                  </p>
                  <ul className="space-y-1">
                    {act.scenes.map((scene) => (
                      <li key={scene.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={selectedSet.has(scene.id)}
                            onChange={() => toggleScene(scene.id)}
                          />
                          <span>
                            Scene {scene.number}
                            {scene.title ? `: ${scene.title}` : ""}
                          </span>
                        </label>
                      </li>
                    ))}
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
