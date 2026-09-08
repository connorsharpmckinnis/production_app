import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MobileListCardProps = {
  children: ReactNode;
  className?: string;
  /** Footer actions (edit/delete). Clicks inside stop card-level propagation if needed. */
  actions?: ReactNode;
};

/**
 * Shared mobile list card shell for catalog pages (md:hidden companion to tables).
 */
export default function MobileListCard({
  children,
  className,
  actions,
}: MobileListCardProps) {
  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-card px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">{children}</div>
      {actions ? (
        <div
          className="mt-3 flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </li>
  );
}
