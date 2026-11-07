import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface CatalogMultiSelectProps {
  label: string;
  items: { id: number; name: string }[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}

export default function CatalogMultiSelect({
  label,
  items,
  selectedIds,
  onChange,
  disabled = false,
}: CatalogMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const buttonLabel =
    selectedIds.length === 0
      ? `All ${label.toLowerCase()}`
      : selectedIds.length === 1
        ? items.find((item) => item.id === selectedIds[0])?.name ?? `1 ${label.toLowerCase()}`
        : `${selectedIds.length} ${label.toLowerCase()}`;

  function toggle(id: number) {
    onChange(selected.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="h-8 font-normal"
        aria-label={`Filter by ${label.toLowerCase()}`}
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
            aria-label={`Close ${label.toLowerCase()} picker`}
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground">
            <div className="mb-2 flex gap-2 border-b border-border pb-2">
              <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => onChange(items.map((item) => item.id))}>
                Select all
              </Button>
              <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange([])}>
                Clear
              </Button>
            </div>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Label htmlFor={`${label}-filter-${item.id}`} className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 font-normal hover:bg-accent">
                    <Checkbox
                      id={`${label}-filter-${item.id}`}
                      className="mt-0.5"
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                    />
                    <span className="text-sm leading-snug">{item.name}</span>
                  </Label>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
