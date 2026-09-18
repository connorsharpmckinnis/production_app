import type { ObjectPeekContent as PeekData } from "@/hooks/queries/useObjectPeekData";
import { cn } from "@/lib/utils";

/** Compact body for ObjectLink hover cards — content only, no chrome. */
export default function ObjectPeekBody({ content }: { content: PeekData }) {
  return (
    <div className="space-y-1.5 text-left">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {content.typeLabel}
      </p>
      <h3 className="text-sm font-semibold leading-snug tracking-tight">
        {content.title}
      </h3>
      {content.eyebrow ? (
        <p className="text-xs text-muted-foreground">{content.eyebrow}</p>
      ) : null}
      {content.pending ? (
        <p className="text-sm italic text-muted-foreground">Loading…</p>
      ) : (
        content.lines.map((line, index) => (
          <p
            key={`${index}-${line.slice(0, 24)}`}
            className={cn(
              "text-sm leading-snug text-foreground/90",
              index === 0 && content.typeLabel === "Character"
                ? "font-medium"
                : "line-clamp-3",
            )}
          >
            {line}
          </p>
        ))
      )}
      <p className="pt-1 text-[0.65rem] text-muted-foreground">
        Click for full details
      </p>
    </div>
  );
}
