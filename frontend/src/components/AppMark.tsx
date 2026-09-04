import { cn } from "@/lib/utils";

type AppMarkProps = {
  className?: string;
};

/** Black silhouette mark; inverted in dark mode so it stays visible. */
export function AppMark({ className }: AppMarkProps) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={32}
      height={32}
      className={cn("h-7 w-7 shrink-0 dark:invert", className)}
      decoding="async"
    />
  );
}
