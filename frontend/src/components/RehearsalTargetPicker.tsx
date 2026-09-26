import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActSummary, RehearsalBlockTargetWrite, RehearsalFocus } from "@/lib/types";
import { cn, formatActLabel } from "@/lib/utils";

export type SongOption = {
  id: number;
  title: string;
};

export interface RehearsalTargetPickerProps {
  acts: ActSummary[];
  songs: SongOption[];
  selected: RehearsalBlockTargetWrite[];
  onChange: (targets: RehearsalBlockTargetWrite[]) => void;
  disabled?: boolean;
}

function targetKey(target: RehearsalBlockTargetWrite): string {
  if (target.focus === "dialog") return `dialog:${target.scene_id}`;
  return `${target.focus}:${target.song_id}`;
}

function hasTarget(
  selected: RehearsalBlockTargetWrite[],
  focus: RehearsalFocus,
  sceneId?: number | null,
  songId?: number | null,
): boolean {
  return selected.some((target) => {
    if (target.focus !== focus) return false;
    if (focus === "dialog") return target.scene_id === sceneId;
    return target.song_id === songId;
  });
}

function sceneLabel(actNumber: number, scene: { number: number; title: string | null }): string {
  const base = `Act ${actNumber} › Scene ${scene.number}`;
  return scene.title ? `${base} — ${scene.title}` : base;
}

export default function RehearsalTargetPicker({
  acts,
  songs,
  selected,
  onChange,
  disabled = false,
}: RehearsalTargetPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredActs = useMemo(() => {
    if (!normalizedQuery) return acts;
    return acts
      .map((act) => ({
        ...act,
        scenes: act.scenes.filter((scene) => {
          const haystack = `${act.number} ${scene.number} ${scene.title ?? ""}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((act) => act.scenes.length > 0);
  }, [acts, normalizedQuery]);

  const filteredSongs = useMemo(() => {
    if (!normalizedQuery) return songs;
    return songs.filter((song) => song.title.toLowerCase().includes(normalizedQuery));
  }, [songs, normalizedQuery]);

  const buttonLabel = (() => {
    if (selected.length === 0) return "No targets selected";
    if (selected.length === 1) {
      const only = selected[0];
      if (only.focus === "dialog" && only.scene_id != null) {
        for (const act of acts) {
          const scene = act.scenes.find((item) => item.id === only.scene_id);
          if (scene) return `${sceneLabel(act.number, scene)} · Dialog`;
        }
      }
      if (only.song_id != null) {
        const song = songs.find((item) => item.id === only.song_id);
        const kind = only.focus === "music" ? "Music" : "Choreo";
        if (song) return `${song.title} · ${kind}`;
      }
    }
    return `${selected.length} targets`;
  })();

  function setSelected(next: RehearsalBlockTargetWrite[]) {
    const seen = new Set<string>();
    const deduped: RehearsalBlockTargetWrite[] = [];
    for (const target of next) {
      const key = targetKey(target);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(target);
    }
    onChange(deduped);
  }

  function toggleScene(sceneId: number) {
    if (hasTarget(selected, "dialog", sceneId, null)) {
      setSelected(selected.filter((target) => !(target.focus === "dialog" && target.scene_id === sceneId)));
      return;
    }
    setSelected([...selected, { focus: "dialog", scene_id: sceneId, song_id: null }]);
  }

  function toggleSongFocus(songId: number, focus: "music" | "choreo") {
    if (hasTarget(selected, focus, null, songId)) {
      setSelected(
        selected.filter((target) => !(target.focus === focus && target.song_id === songId)),
      );
      return;
    }
    setSelected([...selected, { focus, scene_id: null, song_id: songId }]);
  }

  function clearAll() {
    setSelected([]);
  }

  function removeChip(target: RehearsalBlockTargetWrite) {
    const key = targetKey(target);
    setSelected(selected.filter((item) => targetKey(item) !== key));
  }

  function chipLabel(target: RehearsalBlockTargetWrite): string {
    if (target.focus === "dialog" && target.scene_id != null) {
      for (const act of acts) {
        const scene = act.scenes.find((item) => item.id === target.scene_id);
        if (scene) {
          const base =
            scene.title != null
              ? `${act.number}.${scene.number} ${scene.title}`
              : `${act.number}.${scene.number}`;
          return `${base} · Dialog`;
        }
      }
      return `Scene · Dialog`;
    }
    const song = songs.find((item) => item.id === target.song_id);
    const kind = target.focus === "music" ? "Music" : "Choreo";
    return `${song?.title ?? "Song"} · ${kind}`;
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          className="h-8 font-normal"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {buttonLabel}
        </Button>

        {open && !disabled && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-20 cursor-default"
              aria-label="Close target picker"
              onClick={() => setOpen(false)}
            />
            <div className="absolute top-full left-0 z-30 mt-1 w-80 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
              <div className="mb-2 space-y-2 border-b border-border pb-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search scenes or songs…"
                  className="h-8"
                  autoFocus
                />
                <div className="flex gap-2">
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
              </div>

              <div className="max-h-72 space-y-3 overflow-y-auto">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Scenes</p>
                  {filteredActs.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">No matching scenes</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredActs.map((act) => (
                        <div key={act.id}>
                          <p className="mb-1 text-xs text-muted-foreground">{formatActLabel(act)}</p>
                          <ul className="space-y-1">
                            {act.scenes.map((scene) => {
                              const checked = hasTarget(selected, "dialog", scene.id, null);
                              const id = `target-scene-${scene.id}`;
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
                                      <span className="text-muted-foreground"> · Dialog</span>
                                    </span>
                                  </Label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Songs</p>
                  {filteredSongs.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">No matching songs</p>
                  ) : (
                    <ul className="space-y-2">
                      {filteredSongs.map((song) => {
                        const musicChecked = hasTarget(selected, "music", null, song.id);
                        const choreoChecked = hasTarget(selected, "choreo", null, song.id);
                        return (
                          <li key={song.id} className="rounded-sm px-1 py-1">
                            <p className="text-sm font-medium leading-snug">{song.title}</p>
                            <div className="mt-1 flex flex-wrap gap-3 pl-1">
                              <Label
                                htmlFor={`target-song-${song.id}-music`}
                                className="flex cursor-pointer items-center gap-2 font-normal"
                              >
                                <Checkbox
                                  id={`target-song-${song.id}-music`}
                                  checked={musicChecked}
                                  onCheckedChange={() => toggleSongFocus(song.id, "music")}
                                />
                                <span className="text-xs">Music</span>
                              </Label>
                              <Label
                                htmlFor={`target-song-${song.id}-choreo`}
                                className="flex cursor-pointer items-center gap-2 font-normal"
                              >
                                <Checkbox
                                  id={`target-song-${song.id}-choreo`}
                                  checked={choreoChecked}
                                  onCheckedChange={() => toggleSongFocus(song.id, "choreo")}
                                />
                                <span className="text-xs">Choreo</span>
                              </Label>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((target) => (
            <li key={targetKey(target)}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeChip(target)}
                className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted disabled:cursor-default disabled:opacity-70"
                title={disabled ? undefined : "Remove"}
              >
                {chipLabel(target)}
                {!disabled ? <span className="ml-1 text-muted-foreground">×</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
