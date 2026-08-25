import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface CharacterMultiSelectProps {
  characters: { id: number; name: string }[];
  selectedIds: number[];
  myCharacterIds?: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export default function CharacterMultiSelect({
  characters,
  selectedIds,
  myCharacterIds = [],
  onChange,
  disabled = false,
}: CharacterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allCharacterIds = useMemo(
    () => characters.map((character) => character.id),
    [characters],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const noneSelected = selectedIds.length === 0;
  const showMine = myCharacterIds.length > 0;
  const mineSelected = showMine && sameIdSet(selectedIds, myCharacterIds);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const buttonLabel = (() => {
    if (noneSelected) return "All characters";
    if (mineSelected) return "My characters";
    if (selectedIds.length === 1) {
      return characters.find((character) => character.id === selectedIds[0])?.name ?? "1 character";
    }
    return `${selectedIds.length} characters`;
  })();

  function toggleCharacter(characterId: number) {
    if (selectedSet.has(characterId)) {
      onChange(selectedIds.filter((id) => id !== characterId));
    } else {
      onChange([...selectedIds, characterId]);
    }
  }

  function selectAll() {
    onChange([...allCharacterIds]);
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
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="font-normal"
        aria-label="Filter by character"
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
            aria-label="Close character picker"
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
            {showMine && (
              <button
                type="button"
                className={cn(
                  "mb-2 w-full rounded-sm px-1 py-1.5 text-left text-sm font-normal hover:bg-accent",
                  mineSelected && "bg-accent",
                )}
                onClick={() => onChange([...myCharacterIds])}
              >
                My characters
              </button>
            )}
            <ul className="space-y-1">
              {characters.map((character) => {
                const checked = selectedSet.has(character.id);
                const id = `character-filter-${character.id}`;
                return (
                  <li key={character.id}>
                    <Label
                      htmlFor={id}
                      className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 font-normal hover:bg-accent"
                    >
                      <Checkbox
                        id={id}
                        className="mt-0.5"
                        checked={checked}
                        onCheckedChange={() => toggleCharacter(character.id)}
                      />
                      <span className="text-sm leading-snug">{character.name}</span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
