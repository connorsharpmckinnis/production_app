import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface AttributionSubjectMultiSelectProps {
  characters: { id: number; name: string }[];
  groups: { id: number; name: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
  ariaLabel?: string;
  onClose?: () => void;
}

export function encodeAttributionSubject(s: {
  character_id: number | null;
  group_id?: number | null;
}): string {
  if (s.group_id != null) return `group:${s.group_id}`;
  if (s.character_id != null) return `character:${s.character_id}`;
  return "";
}

export function decodeAttributionSubjects(
  values: string[],
): { character_id?: number; group_id?: number }[] {
  const subjects: { character_id?: number; group_id?: number }[] = [];
  for (const value of values) {
    if (value.startsWith("character:")) {
      const id = Number(value.slice("character:".length));
      if (Number.isFinite(id)) subjects.push({ character_id: id });
    } else if (value.startsWith("group:")) {
      const id = Number(value.slice("group:".length));
      if (Number.isFinite(id)) subjects.push({ group_id: id });
    }
  }
  return subjects;
}

type OptionRow = {
  value: string;
  name: string;
  hint?: string;
};

export default function AttributionSubjectMultiSelect({
  characters,
  groups,
  selectedValues,
  onChange,
  disabled = false,
  emptyLabel = "Add people",
  ariaLabel = "Select attribution subjects",
  onClose,
}: AttributionSubjectMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const options = useMemo(() => {
    const rows: OptionRow[] = [
      ...characters.map((character) => ({
        value: `character:${character.id}`,
        name: character.name,
      })),
      ...groups.map((group) => ({
        value: `group:${group.id}`,
        name: group.name,
        hint: "Group",
      })),
    ];
    return rows.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [characters, groups]);

  const nameByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      map.set(option.value, option.hint ? `${option.name} (Group)` : option.name);
    }
    return map;
  }, [options]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function close() {
    setOpen(false);
    onClose?.();
  }

  const buttonLabel = (() => {
    if (selectedValues.length === 0) return emptyLabel;
    if (selectedValues.length === 1) {
      return nameByValue.get(selectedValues[0]) ?? "1 person";
    }
    return `${selectedValues.length} people`;
  })();

  function toggleValue(value: string) {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((item) => item !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          if (open) {
            close();
          } else {
            setOpen(true);
          }
        }}
        className="font-normal"
        aria-label={ariaLabel}
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
            aria-label="Close attribution picker"
            onClick={close}
          />
          <div className="absolute top-full left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground">
            {options.length === 0 ? (
              <p className="px-1 py-1.5 text-sm text-muted-foreground">
                No characters or groups
              </p>
            ) : (
              <ul className="space-y-1">
                {options.map((option) => {
                  const checked = selectedSet.has(option.value);
                  const id = `attribution-subject-${option.value}`;
                  return (
                    <li key={option.value}>
                      <Label
                        htmlFor={id}
                        className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 font-normal hover:bg-accent"
                      >
                        <Checkbox
                          id={id}
                          className="mt-0.5"
                          checked={checked}
                          onCheckedChange={() => toggleValue(option.value)}
                        />
                        <span className="text-sm leading-snug">
                          {option.name}
                          {option.hint ? (
                            <span className="text-muted-foreground"> ({option.hint})</span>
                          ) : null}
                        </span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
