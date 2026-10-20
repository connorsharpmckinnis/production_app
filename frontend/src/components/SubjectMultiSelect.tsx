import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Generic multi-select over encoded subject values (`character:1`, `prop:3`, …). */
export type SubjectMultiSelectOption = {
  value: string;
  label: string;
  hint?: string;
  /** Extra muted style for the whole option row (e.g. on-stage tint). */
  optionClassName?: string;
};

export interface SubjectMultiSelectProps {
  options: SubjectMultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
  ariaLabel?: string;
  emptyMessage?: string;
  onClose?: () => void;
  className?: string;
}

export default function SubjectMultiSelect({
  options,
  selectedValues,
  onChange,
  disabled = false,
  emptyLabel = "Add subjects",
  ariaLabel = "Select subjects",
  emptyMessage = "No options",
  onClose,
  className,
}: SubjectMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const nameByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      map.set(
        option.value,
        option.hint ? `${option.label} (${option.hint})` : option.label,
      );
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
      return nameByValue.get(selectedValues[0]) ?? "1 selected";
    }
    return `${selectedValues.length} selected`;
  })();

  function toggleValue(value: string) {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((item) => item !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
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
            aria-label="Close subject picker"
            onClick={close}
          />
          <div className="absolute top-full left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground">
            {options.length === 0 ? (
              <p className="px-1 py-1.5 text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              <ul className="space-y-1">
                {options.map((option) => {
                  const checked = selectedSet.has(option.value);
                  const id = `subject-multi-${option.value}`;
                  return (
                    <li key={option.value}>
                      <Label
                        htmlFor={id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 font-normal hover:bg-accent",
                          option.optionClassName,
                        )}
                      >
                        <Checkbox
                          id={id}
                          className="mt-0.5"
                          checked={checked}
                          onCheckedChange={() => toggleValue(option.value)}
                        />
                        <span className="text-sm leading-snug">
                          {option.label}
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
