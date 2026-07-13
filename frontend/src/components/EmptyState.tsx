import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  className,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  className?: string;
}) {
  let action: ReactNode = null;
  if (actionLabel && actionTo) {
    action = (
      <Link
        to={actionTo}
        className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {actionLabel}
      </Link>
    );
  } else if (actionLabel && onAction) {
    action = (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {actionLabel}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border p-8 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
