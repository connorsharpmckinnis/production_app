import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import ObjectLink from "@/components/object-detail/ObjectLink";
import {
  chartMinWidthPx,
  intervalWidthPercent,
  onStageBarColor,
  spinePercent,
} from "@/lib/onStageChart";
import { formatMomentCode, humanTimelinePath } from "@/lib/timelineDeepLinks";
import type {
  OnStageChartInterval,
  OnStageChartMomentRef,
  OnStageChartReport,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL_COL = "w-36";

type HoverState = {
  characterName: string;
  interval: OnStageChartInterval;
  x: number;
  y: number;
};

function momentLabel(ref: OnStageChartMomentRef): string {
  return formatMomentCode(ref.act_number, ref.scene_number, ref.sequence_number);
}

function tooltipPoint(clientX: number, clientY: number): { x: number; y: number } {
  const width = 280;
  const height = 140;
  return {
    x: Math.max(8, Math.min(clientX + 12, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(clientY + 12, window.innerHeight - height - 8)),
  };
}

export function OnStagePresenceChart({
  productionId,
  report,
}: {
  productionId: number;
  report: OnStageChartReport;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  function cancelHide() {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function scheduleHide() {
    cancelHide();
    hideTimer.current = window.setTimeout(() => setHover(null), 160);
  }

  function showHover(
    point: { clientX: number; clientY: number },
    characterName: string,
    interval: OnStageChartInterval,
  ) {
    cancelHide();
    const placed = tooltipPoint(point.clientX, point.clientY);
    setHover({ characterName, interval, x: placed.x, y: placed.y });
  }

  if (report.moment_count === 0) {
    return <p className="text-sm text-muted-foreground">No moments in this production yet.</p>;
  }

  if (report.characters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No entrance or exit records. Add them on the Timeline to see who is on stage across the
        show.
      </p>
    );
  }

  const n = report.moment_count;
  const minWidth = chartMinWidthPx(n);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Each thin bar is one on-stage stretch (entrance to exit). Presence resets at every scene,
        same as the Timeline: a character who never exits is drawn only through the end of that
        scene. Hover a bar for details; click to open the entrance moment.
      </p>
      <div className="onstage-chart-scroll overflow-x-auto rounded-lg border border-border">
        <div style={{ minWidth }}>
          <div className="flex border-b border-border bg-muted/40">
            <div
              className={cn(
                LABEL_COL,
                "sticky left-0 z-20 shrink-0 border-r border-border bg-muted/90 px-2 py-1 text-xs font-medium text-muted-foreground",
              )}
            >
              Act
            </div>
            <div className="relative h-7 min-w-0 flex-1">
              {report.acts.map((act) => (
                <div
                  key={act.act_id}
                  className="absolute inset-y-0 flex items-center overflow-hidden border-l border-border px-1 text-xs font-medium"
                  style={{
                    left: `${spinePercent(act.start_index, n)}%`,
                    width: `${spinePercent(act.moment_count, n)}%`,
                  }}
                  title={act.act_title ?? `Act ${act.act_number}`}
                >
                  Act {act.act_number}
                </div>
              ))}
            </div>
          </div>
          <div className="flex border-b border-border">
            <div
              className={cn(
                LABEL_COL,
                "sticky left-0 z-20 shrink-0 border-r border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground",
              )}
            >
              Scene
            </div>
            <div className="relative h-7 min-w-0 flex-1">
              {report.scenes.map((scene) => (
                <div
                  key={scene.scene_id}
                  className="absolute inset-y-0 flex items-center overflow-hidden border-l border-border px-1 text-[11px] text-muted-foreground"
                  style={{
                    left: `${spinePercent(scene.start_index, n)}%`,
                    width: `${spinePercent(scene.moment_count, n)}%`,
                  }}
                  title={
                    scene.scene_title
                      ? `Act ${scene.act_number}, Scene ${scene.scene_number}: ${scene.scene_title}`
                      : `Act ${scene.act_number}, Scene ${scene.scene_number}`
                  }
                >
                  {scene.act_number}.{scene.scene_number}
                </div>
              ))}
            </div>
          </div>
          {report.characters.map((row, rowIndex) => {
            const color = onStageBarColor(rowIndex);
            return (
              <div
                key={row.character_id}
                className="flex border-b border-border/70 last:border-b-0"
              >
                <div
                  className={cn(
                    LABEL_COL,
                    "sticky left-0 z-10 shrink-0 truncate border-r border-border bg-background px-2 py-0.5 text-xs font-medium",
                  )}
                  title={row.character_name}
                >
                  <ObjectLink
                    objectType="character"
                    objectId={row.character_id}
                    label={row.character_name}
                    className="max-w-full px-1 py-0 text-xs"
                  />
                </div>
                <div className="relative h-5 min-w-0 flex-1">
                  {report.scenes.map((scene) => (
                    <div
                      key={`${row.character_id}-grid-${scene.scene_id}`}
                      className="pointer-events-none absolute inset-y-0 border-l border-border/50"
                      style={{
                        left: `${spinePercent(scene.start_index, n)}%`,
                        width: `${spinePercent(scene.moment_count, n)}%`,
                      }}
                    />
                  ))}
                  {row.intervals.map((interval) => (
                    <Link
                      key={`${row.character_id}-${interval.start_index}-${interval.end_index}`}
                      to={humanTimelinePath(
                        productionId,
                        interval.entrance.act_number,
                        interval.entrance.scene_number,
                        interval.entrance.sequence_number,
                      )}
                      className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full outline-none hover:brightness-110 focus-visible:ring-1 focus-visible:ring-ring"
                      style={{
                        left: `${spinePercent(interval.start_index, n)}%`,
                        width: `max(${intervalWidthPercent(interval.start_index, interval.end_index, n)}%, 3px)`,
                        backgroundColor: color,
                      }}
                      aria-label={`${row.character_name} on stage from ${momentLabel(interval.entrance)}${
                        interval.exit
                          ? ` to ${momentLabel(interval.exit)}`
                          : " through end of scene"
                      }`}
                      onMouseEnter={(event) =>
                        showHover(event, row.character_name, interval)
                      }
                      onMouseMove={(event) =>
                        showHover(event, row.character_name, interval)
                      }
                      onMouseLeave={scheduleHide}
                      onFocus={(event) => {
                        const box = event.currentTarget.getBoundingClientRect();
                        showHover(
                          { clientX: box.left, clientY: box.bottom },
                          row.character_name,
                          interval,
                        );
                      }}
                      onBlur={scheduleHide}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {hover &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground"
            style={{ left: hover.x, top: hover.y }}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          >
            <p className="font-medium">{hover.characterName}</p>
            <p className="mt-1">
              Entrance: {momentLabel(hover.interval.entrance)}
              {hover.interval.entrance_notes ? ` — ${hover.interval.entrance_notes}` : ""}
            </p>
            {hover.interval.exit ? (
              <p>
                Exit: {momentLabel(hover.interval.exit)}
                {hover.interval.exit_notes ? ` — ${hover.interval.exit_notes}` : ""}
              </p>
            ) : (
              <p>Exit: end of scene (no recorded exit)</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
