import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AttachmentRowAction = {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Destructive styling (e.g. Remove). */
  destructive?: boolean;
};

interface AttachmentRowActionsProps {
  /** Optional attribution / provenance lines shown above actions. */
  details?: ReactNode;
  actions: AttachmentRowAction[];
  /** Accessible name for the menu trigger (e.g. attachment label). */
  label: string;
  className?: string;
}

/**
 * Single ⋯ control for Moment Detail attachment rows.
 * Hidden until the row is hovered/focused (stays visible while the menu is open).
 */
export default function AttachmentRowActions({
  details,
  actions,
  label,
  className,
}: AttachmentRowActionsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (actions.length === 0 && details == null) return null;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative shrink-0",
        // Passive read: hide until row hover/focus; stay visible while menu open.
        "opacity-0 transition-opacity group-hover/attach-row:opacity-100 group-focus-within/attach-row:opacity-100",
        open && "opacity-100",
        // Touch / no-hover: always show the single control.
        "[@media(hover:none)]:opacity-100",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Actions"
        className="text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          onClick={(event) => event.stopPropagation()}
        >
          {details != null && (
            <div className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
              {details}
            </div>
          )}
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
                action.destructive && "text-destructive hover:bg-destructive/10",
              )}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact attribution lines for the actions menu (no separate info icon). */
export function attachmentAttributionDetails(parts: {
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  rehearsalLabel?: string | null;
}): ReactNode {
  const createdBy = parts.createdBy?.trim();
  const createdAt = parts.createdAt?.trim();
  const updatedBy = parts.updatedBy?.trim();
  const updatedAt = parts.updatedAt?.trim();
  const rehearsalLabel = parts.rehearsalLabel?.trim();

  const created =
    createdBy && createdAt
      ? `Created by ${createdBy}`
      : createdBy
        ? `Created by ${createdBy}`
        : null;
  const updated =
    updatedBy && updatedAt && updatedAt !== createdAt
      ? `Updated by ${updatedBy}`
      : null;

  if (!created && !updated && !rehearsalLabel) return null;

  return (
    <div className="space-y-0.5">
      {created ? <p>{created}</p> : null}
      {updated ? <p>{updated}</p> : null}
      {rehearsalLabel ? <p>During {rehearsalLabel}</p> : null}
    </div>
  );
}
