import { useCallback, useMemo, useRef, useState } from "react";
import { cn, timeInputToMinutes } from "@/lib/utils";
import {
  REHEARSAL_STRIP_NONE_LOCATION,
  REHEARSAL_TIME_SNAP_MINUTES,
  formatMinutesLabel,
  fractionToMinutes,
  hourTicks,
  minutesToTimeInput,
  normalizeDragRange,
  partitionLocationLanes,
  pointerFraction,
  snapMinutes,
  type StripLocation,
} from "@/lib/rehearsalTimeStrip";

export type TimeStripBlock = {
  key: string;
  start_time: string;
  end_time: string;
  label: string;
  location_id: string;
};

type DragMode =
  | { kind: "create"; anchor: number; locationId: string }
  | { kind: "resize-start"; key: string; end: number; locationId: string }
  | { kind: "resize-end"; key: string; start: number; locationId: string }
  | {
      kind: "move";
      key: string;
      duration: number;
      grabOffset: number;
      locationId: string;
    };

type DraftRange = {
  start: number;
  end: number;
  locationId: string;
  key?: string;
};

type RehearsalBlockTimeStripProps = {
  windowStartTime: string;
  windowEndTime: string;
  locations: StripLocation[];
  blocks: TimeStripBlock[];
  selectedKey: string | null;
  disabled?: boolean;
  onSelectBlock: (key: string) => void;
  onCreateRange: (startTime: string, endTime: string, locationId: string) => void;
  onChangeRange: (
    key: string,
    startTime: string,
    endTime: string,
    locationId: string,
  ) => void;
};

const CLICK_SLOP_PX = 5;
const DEFAULT_CLICK_DURATION = 60;

function blockIndexLabel(index: number, label: string): string {
  const trimmed = label.trim();
  return trimmed || `Block ${index + 1}`;
}

export default function RehearsalBlockTimeStrip({
  windowStartTime,
  windowEndTime,
  locations,
  blocks,
  selectedKey,
  disabled = false,
  onSelectBlock,
  onCreateRange,
  onChangeRange,
}: RehearsalBlockTimeStripProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const pointerOriginX = useRef(0);
  const [draft, setDraft] = useState<DraftRange | null>(null);

  const windowStart = timeInputToMinutes(windowStartTime);
  const windowEnd = timeInputToMinutes(windowEndTime);
  const span = windowEnd - windowStart;
  const usable = span >= REHEARSAL_TIME_SNAP_MINUTES;

  const { active, idle } = useMemo(
    () =>
      partitionLocationLanes(
        locations,
        blocks.map((block) => block.location_id),
      ),
    [blocks, locations],
  );

  const blockIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    blocks.forEach((block, index) => map.set(block.key, index));
    return map;
  }, [blocks]);

  const minutesFromClientX = useCallback(
    (clientX: number) => {
      const track = gridRef.current?.querySelector<HTMLElement>("[data-strip-track]");
      if (!track) return windowStart;
      const fraction = pointerFraction(clientX, track.getBoundingClientRect());
      return fractionToMinutes(fraction, windowStart, windowEnd);
    },
    [windowEnd, windowStart],
  );

  function locationIdFromPoint(clientY: number): string | null {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const midX = rect.left + Math.min(rect.width - 8, 140);
    const under = document.elementFromPoint(midX, clientY);
    return under?.closest<HTMLElement>("[data-location-id]")?.dataset.locationId ?? null;
  }

  function commitRange(
    start: number,
    end: number,
    locationId: string,
    key?: string,
  ) {
    const startTime = minutesToTimeInput(start);
    const endTime = minutesToTimeInput(end);
    if (key) {
      onChangeRange(key, startTime, endTime, locationId);
    } else {
      onCreateRange(startTime, endTime, locationId);
    }
  }

  function rangeFromMode(mode: DragMode, clientX: number, clientY: number): DraftRange {
    const minutes = minutesFromClientX(clientX);
    const hoveredLocation =
      mode.kind === "move" || mode.kind === "create"
        ? (locationIdFromPoint(clientY) ?? mode.locationId)
        : mode.locationId;

    if (mode.kind === "create") {
      return {
        locationId: hoveredLocation,
        ...normalizeDragRange(mode.anchor, minutes, windowStart, windowEnd),
      };
    }
    if (mode.kind === "resize-start") {
      const start = Math.min(
        snapMinutes(minutes),
        mode.end - REHEARSAL_TIME_SNAP_MINUTES,
      );
      return {
        key: mode.key,
        locationId: mode.locationId,
        ...normalizeDragRange(start, mode.end, windowStart, windowEnd),
      };
    }
    if (mode.kind === "resize-end") {
      const end = Math.max(
        snapMinutes(minutes),
        mode.start + REHEARSAL_TIME_SNAP_MINUTES,
      );
      return {
        key: mode.key,
        locationId: mode.locationId,
        ...normalizeDragRange(mode.start, end, windowStart, windowEnd),
      };
    }
    const startRaw = minutes - mode.grabOffset;
    const start = snapMinutes(
      Math.max(windowStart, Math.min(startRaw, windowEnd - mode.duration)),
    );
    return {
      key: mode.key,
      locationId: hoveredLocation,
      start,
      end: Math.min(windowEnd, start + mode.duration),
    };
  }

  function endDrag(clientX: number, clientY: number) {
    const mode = dragRef.current;
    if (!mode) return;
    const isClick = Math.abs(clientX - pointerOriginX.current) < CLICK_SLOP_PX;
    const range = rangeFromMode(mode, clientX, clientY);
    dragRef.current = null;
    setDraft(null);

    if (mode.kind === "create") {
      if (isClick) {
        const slot = snapMinutes(
          Math.min(minutesFromClientX(clientX), windowEnd - DEFAULT_CLICK_DURATION),
        );
        const start = Math.max(windowStart, slot);
        const end = Math.min(windowEnd, start + DEFAULT_CLICK_DURATION);
        if (end - start >= REHEARSAL_TIME_SNAP_MINUTES) {
          commitRange(start, end, range.locationId);
        }
        return;
      }
      commitRange(range.start, range.end, range.locationId);
      return;
    }

    if (isClick) return;

    if (range.key) {
      commitRange(range.start, range.end, range.locationId, range.key);
    }
  }

  function beginDrag(event: React.PointerEvent, mode: DragMode) {
    if (disabled || !usable) return;
    if (event.button !== 0) return;
    pointerOriginX.current = event.clientX;
    dragRef.current = mode;
    gridRef.current?.setPointerCapture(event.pointerId);
    setDraft(rangeFromMode(mode, event.clientX, event.clientY));
  }

  function onGridPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const mode = dragRef.current;
    if (!mode) return;
    setDraft(rangeFromMode(mode, event.clientX, event.clientY));
  }

  function onGridPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released
    }
    endDrag(event.clientX, event.clientY);
  }

  if (!usable) {
    return (
      <p className="text-sm text-muted-foreground">
        Set a longer rehearsal window to use the time strip.
      </p>
    );
  }

  const ticks = hourTicks(windowStart, windowEnd);

  function renderLane(location: StripLocation, compact: boolean) {
    const laneBlocks = blocks.filter((block) => {
      if (draft?.key === block.key) {
        return draft.locationId === location.id;
      }
      return block.location_id === location.id;
    });
    const showCreateDraft = Boolean(
      draft && !draft.key && draft.locationId === location.id,
    );

    return (
      <div
        key={location.id}
        data-location-id={location.id}
        className={cn(
          "grid grid-cols-[7rem_minmax(0,1fr)] gap-2 border-t border-border/60 first:border-t-0",
          compact ? "bg-muted/25" : "bg-background/40",
        )}
      >
        <div
          className={cn(
            "flex items-center px-2 text-xs font-medium",
            compact ? "py-1 text-muted-foreground" : "py-2",
          )}
          title={location.name}
        >
          <span className="truncate">{location.name}</span>
        </div>
        <div
          data-strip-track
          role="presentation"
          className={cn(
            "relative",
            compact ? "h-7 cursor-crosshair" : "h-12 cursor-crosshair",
            disabled && "cursor-default",
          )}
          onPointerDown={(event) => {
            if (disabled) return;
            if (event.button !== 0) return;
            const target = event.target as HTMLElement;
            if (target.closest("[data-strip-block]")) return;
            const minutes = minutesFromClientX(event.clientX);
            beginDrag(event, {
              kind: "create",
              anchor: snapMinutes(minutes),
              locationId: location.id,
            });
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            {ticks.map((tick) => {
              const left = ((tick - windowStart) / span) * 100;
              return (
                <div
                  key={tick}
                  className="absolute inset-y-0 border-l border-border/50"
                  style={{ left: `${left}%` }}
                />
              );
            })}
          </div>

          {laneBlocks.map((block) => {
            const start = timeInputToMinutes(block.start_time);
            const end = timeInputToMinutes(block.end_time);
            if (end <= start) return null;
            const live =
              draft?.key === block.key ? draft : { start, end, locationId: location.id };
            const left = ((live.start - windowStart) / span) * 100;
            const width = ((live.end - live.start) / span) * 100;
            const selected = block.key === selectedKey;
            const index = blockIndexByKey.get(block.key) ?? 0;

            return (
              <div
                key={block.key}
                data-strip-block
                className={cn(
                  "absolute flex items-stretch overflow-hidden rounded-md border text-xs shadow-sm",
                  compact ? "top-0.5 h-6" : "top-1 h-10",
                  selected
                    ? "z-20 border-primary bg-primary/25"
                    : "z-10 border-border bg-background/95",
                  disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                )}
                style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                title={`${blockIndexLabel(index, block.label)} · ${location.name} · ${formatMinutesLabel(live.start)} – ${formatMinutesLabel(live.end)}`}
                onPointerDown={(event) => {
                  if (disabled) return;
                  event.stopPropagation();
                  onSelectBlock(block.key);
                  const duration = end - start;
                  const grab = minutesFromClientX(event.clientX) - start;
                  beginDrag(event, {
                    kind: "move",
                    key: block.key,
                    duration,
                    grabOffset: grab,
                    locationId: location.id,
                  });
                }}
              >
                {!disabled && !compact && (
                  <button
                    type="button"
                    data-strip-block
                    aria-label="Resize start"
                    className="w-2 shrink-0 cursor-ew-resize bg-primary/30 hover:bg-primary/50"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onSelectBlock(block.key);
                      beginDrag(event, {
                        kind: "resize-start",
                        key: block.key,
                        end,
                        locationId: location.id,
                      });
                    }}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center px-1.5 py-0.5">
                  <span className="truncate font-medium">
                    {blockIndexLabel(index, block.label)}
                  </span>
                  {!compact && (
                    <span className="truncate text-[10px] text-muted-foreground">
                      {formatMinutesLabel(live.start)} – {formatMinutesLabel(live.end)}
                    </span>
                  )}
                </div>
                {!disabled && !compact && (
                  <button
                    type="button"
                    data-strip-block
                    aria-label="Resize end"
                    className="w-2 shrink-0 cursor-ew-resize bg-primary/30 hover:bg-primary/50"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onSelectBlock(block.key);
                      beginDrag(event, {
                        kind: "resize-end",
                        key: block.key,
                        start,
                        locationId: location.id,
                      });
                    }}
                  />
                )}
              </div>
            );
          })}

          {showCreateDraft && draft && (
            <div
              className={cn(
                "pointer-events-none absolute z-30 rounded-md border border-dashed border-primary bg-primary/15",
                compact ? "top-0.5 h-6" : "top-1 h-10",
              )}
              style={{
                left: `${((draft.start - windowStart) / span) * 100}%`,
                width: `${((draft.end - draft.start) / span) * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {disabled
            ? "Rehearsal schedule by room"
            : "Drag to add · drag between rows to change room · edges resize (10 min)"}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatMinutesLabel(windowStart)} – {formatMinutesLabel(windowEnd)}
        </p>
      </div>

      <div
        ref={gridRef}
        className={cn(
          "select-none overflow-hidden rounded-md border border-border",
          disabled && "opacity-70",
        )}
        onPointerMove={onGridPointerMove}
        onPointerUp={onGridPointerUp}
        onPointerCancel={onGridPointerUp}
      >
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 border-b border-border/60 bg-muted/30 pb-4 pt-1">
          <div />
          <div className="relative h-4">
            {ticks.map((tick) => {
              const left = ((tick - windowStart) / span) * 100;
              return (
                <span
                  key={tick}
                  className="absolute top-0 -translate-x-1/2 text-[10px] text-muted-foreground"
                  style={{ left: `${left}%` }}
                >
                  {formatMinutesLabel(tick)}
                </span>
              );
            })}
          </div>
        </div>

        {active.map((location) => renderLane(location, false))}
        {idle.map((location) => renderLane(location, true))}
      </div>
    </div>
  );
}

export { REHEARSAL_STRIP_NONE_LOCATION };
