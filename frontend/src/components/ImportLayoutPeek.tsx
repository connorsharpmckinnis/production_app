import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Letter-size PDF defaults used only for the crosshair scale. */
const PAGE_WIDTH_PT = 612;
const PAGE_HEIGHT_PT = 792;

export type LayoutPeekTarget = {
  label: string;
  page: number | null;
  line_number: number | null;
  x0: number | null | undefined;
  y0: number | null | undefined;
  x1?: number | null | undefined;
};

function formatPt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(1);
}

/**
 * Sticky layout peek for import preview: numbers + a simple page crosshair.
 * Coordinates are PDF points from the top-left of the page.
 */
export function ImportLayoutPeek({
  target,
  pinned = false,
  onUnpin,
  className,
}: {
  target: LayoutPeekTarget | null;
  pinned?: boolean;
  onUnpin?: () => void;
  className?: string;
}) {
  const hasCoords = target != null && (target.x0 != null || target.y0 != null);
  const xPct =
    target?.x0 != null
      ? Math.min(100, Math.max(0, (target.x0 / PAGE_WIDTH_PT) * 100))
      : null;
  const yPct =
    target?.y0 != null
      ? Math.min(100, Math.max(0, (target.y0 / PAGE_HEIGHT_PT) * 100))
      : null;
  const x1Pct =
    target?.x1 != null
      ? Math.min(100, Math.max(0, (target.x1 / PAGE_WIDTH_PT) * 100))
      : null;

  return (
    <div
      className={cn(
        "sticky top-0 z-10 rounded-md border bg-card p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Layout peek</h3>
          <p className="text-xs text-muted-foreground">
            Hover or click a preview row. Values are PDF points from the
            top-left of the page (letter ≈ {PAGE_WIDTH_PT}×{PAGE_HEIGHT_PT}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pinned && target && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onUnpin}
            >
              Unpin
            </Button>
          )}
          {target && (
            <p className="font-mono text-xs text-muted-foreground">
              {target.page != null ? `p.${target.page}` : "p.—"}
              {target.line_number != null ? ` · line ${target.line_number}` : ""}
              {pinned ? " · pinned" : ""}
            </p>
          )}
        </div>
      </div>

      {!target && (
        <p className="mt-2 text-sm text-muted-foreground">
          No row selected yet.
        </p>
      )}

      {target && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
          <div className="space-y-1.5 text-sm">
            <p className="truncate font-medium">{target.label}</p>
            <dl className="grid grid-cols-3 gap-2 font-mono text-xs">
              <div className="rounded-md bg-muted px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  x0
                </dt>
                <dd>{formatPt(target.x0)}</dd>
              </div>
              <div className="rounded-md bg-muted px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  y0
                </dt>
                <dd>{formatPt(target.y0)}</dd>
              </div>
              <div className="rounded-md bg-muted px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  x1
                </dt>
                <dd>{formatPt(target.x1)}</dd>
              </div>
            </dl>
            {!hasCoords && (
              <p className="text-xs text-muted-foreground">
                No layout for this row (typical for Markdown/DOCX).
              </p>
            )}
          </div>

          <div
            className="relative mx-auto aspect-[612/792] w-full max-w-[7.5rem] rounded border bg-muted/40"
            aria-hidden
          >
            {xPct != null && (
              <div
                className="absolute inset-y-0 w-px bg-primary"
                style={{ left: `${xPct}%` }}
              />
            )}
            {yPct != null && (
              <div
                className="absolute inset-x-0 h-px bg-primary"
                style={{ top: `${yPct}%` }}
              />
            )}
            {xPct != null && yPct != null && (
              <div
                className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
              />
            )}
            {xPct != null && x1Pct != null && x1Pct > xPct && (
              <div
                className="absolute h-1 -translate-y-1/2 rounded-sm bg-primary/40"
                style={{
                  left: `${xPct}%`,
                  width: `${x1Pct - xPct}%`,
                  top: yPct != null ? `${yPct}%` : "50%",
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
