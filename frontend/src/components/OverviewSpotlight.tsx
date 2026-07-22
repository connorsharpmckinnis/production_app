import { useEffect, useId, useState } from "react";
import type { SpotlightMessage } from "@/lib/types";
import {
  localDayKey,
  nextSpotlightIndex,
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
  const showKindLabel = message.kind === "announcement";

  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        "rounded-lg bg-muted/25 px-4 py-3 sm:px-5",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {showKindLabel ? (
        <p
          id={labelId}
          className="text-xs font-medium text-muted-foreground"
        >
          Announcement
        </p>
      ) : (
        <span id={labelId} className="sr-only">
          {message.kind === "scripture" ? "Scripture" : "Encouragement"}
        </span>
      )}
      {message.title && (
        <p
          className={cn(
            "text-sm font-medium text-foreground",
            showKindLabel ? "mt-1" : undefined,
          )}
        >
          {message.title}
        </p>
      )}
      <p
        className={cn(
          "text-base leading-relaxed text-foreground",
          message.title || showKindLabel ? "mt-1" : undefined,
        )}
      >
        {message.body}
      </p>
    </section>
  );
}
