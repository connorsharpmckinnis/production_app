import { useEffect, useId, useState } from "react";
import type { SpotlightMessage } from "@/lib/types";
import {
  localDayKey,
  nextSpotlightIndex,
  previousSpotlightIndex,
  shouldRotateSpotlight,
  spotlightStartIndex,
} from "@/lib/overviewSpotlight";
import { cn } from "@/lib/utils";

interface OverviewSpotlightProps {
  productionId: number;
  messages: SpotlightMessage[];
  rotationSeconds: number;
  className?: string;
}

function kindLabel(kind: string): string {
  if (kind === "scripture") return "Scripture";
  if (kind === "announcement") return "Announcement";
  if (kind === "encouragement") return "Encouragement";
  return kind;
}

export default function OverviewSpotlight({
  productionId,
  messages,
  rotationSeconds,
  className,
}: OverviewSpotlightProps) {
  const labelId = useId();
  const [index, setIndex] = useState(() =>
    spotlightStartIndex(productionId, localDayKey(), messages.length),
  );
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(spotlightStartIndex(productionId, localDayKey(), messages.length));
    setPaused(false);
  }, [productionId, messages]);

  useEffect(() => {
    if (paused || !shouldRotateSpotlight(rotationSeconds, messages.length)) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => nextSpotlightIndex(current, messages.length));
    }, rotationSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [paused, rotationSeconds, messages.length]);

  if (messages.length === 0) {
    return null;
  }

  const safeIndex = index % messages.length;
  const message = messages[safeIndex];

  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        "rounded-lg border border-border bg-muted/30 px-4 py-4 sm:px-5",
        className,
      )}
    >
      <p
        id={labelId}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {kindLabel(message.kind)}
        {messages.length > 1 && (
          <span className="ml-2 font-normal normal-case tracking-normal">
            {safeIndex + 1} of {messages.length}
          </span>
        )}
      </p>
      {message.title && (
        <p className="mt-1 text-sm font-medium text-foreground">{message.title}</p>
      )}
      <p className="mt-1 text-base leading-relaxed text-foreground">{message.body}</p>
      {messages.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Spotlight controls">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            onClick={() =>
              setIndex((current) => previousSpotlightIndex(current, messages.length))
            }
          >
            Previous
          </button>
          {rotationSeconds > 0 && (
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              onClick={() => setPaused((current) => !current)}
              aria-pressed={paused}
            >
              {paused ? "Resume" : "Pause"}
            </button>
          )}
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            onClick={() =>
              setIndex((current) => nextSpotlightIndex(current, messages.length))
            }
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
