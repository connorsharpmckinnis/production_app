import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Extra text matched by search (e.g. role group). */
  keywords?: string;
  /** Small muted hint shown after the label (e.g. "Character"). */
  hint?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  /** When true, an explicit clear row is shown at the top. */
  clearLabel?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyMessage = "No matches",
  disabled = false,
  className,
  clearLabel,
}: SearchableSelectProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectValue(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((wasOpen) => !wasOpen);
          setQuery("");
        }}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm disabled:opacity-50"
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
          {selected ? (
            <>
              {selected.label}
              {selected.hint ? (
                <span className="text-muted-foreground"> · {selected.hint}</span>
              ) : null}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-border bg-background shadow-md">
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to filter…"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-48 overflow-y-auto py-1"
          >
            {clearLabel && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === ""}
                  onClick={() => selectValue("")}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted",
                    value === "" && "bg-muted",
                  )}
                >
                  <Check
                    className={cn("size-3.5 shrink-0", value === "" ? "opacity-100" : "opacity-0")}
                  />
                  <span className="text-muted-foreground">{clearLabel}</span>
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectValue(option.value)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted",
                        isSelected && "bg-muted",
                      )}
                    >
                      <Check
                        className={cn(
                          "size-3.5 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 truncate">
                        {option.label}
                        {option.hint ? (
                          <span className="text-muted-foreground"> · {option.hint}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
