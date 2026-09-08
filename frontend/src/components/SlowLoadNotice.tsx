import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppMark } from "@/components/AppMark";
import { cn } from "@/lib/utils";

const DEFAULT_MESSAGE =
  "Sorry for the delay — loading is a bit slower while this prototype runs on free hosting. It will get faster.";

type SlowLoadNoticeProps = {
  /** Delay before showing the free-tier explanation. */
  delayMs?: number;
  message?: string;
  className?: string;
  /** Full-page centered layout with logo (auth bootstrap). */
  fullPage?: boolean;
};

/**
 * Temporary free-tier loading empathy. Easy to remove later: drop usages of this component.
 */
export default function SlowLoadNotice({
  delayMs = 1800,
  message = DEFAULT_MESSAGE,
  className,
  fullPage = false,
}: SlowLoadNoticeProps) {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowMessage(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        fullPage && "min-h-screen px-6",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {fullPage && <AppMark className="h-10 w-10" />}
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading…</p>
      {showMessage && (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
