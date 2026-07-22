import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
      <Button asChild className="mt-4">
        <Link to={actionTo}>{actionLabel}</Link>
      </Button>
    );
  } else if (actionLabel && onAction) {
    action = (
      <Button type="button" onClick={onAction} className="mt-4">
        {actionLabel}
      </Button>
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
