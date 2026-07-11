import { Badge } from "@/components/ui/badge";
import type { SceneSummaryData } from "@/lib/sceneSummary";

interface SceneSummaryStripProps {
  summary: SceneSummaryData;
}

export default function SceneSummaryStrip({ summary }: SceneSummaryStripProps) {
  const { characterNames, songTitles, propMomentCount } = summary;

  if (
    characterNames.length === 0 &&
    songTitles.length === 0 &&
    propMomentCount === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 px-4 py-3">
      {characterNames.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Characters in this scene
          </span>
          {characterNames.map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
        </div>
      )}

      {songTitles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Songs
          </span>
          {songTitles.map((title) => (
            <Badge key={title} variant="outline">
              {title}
            </Badge>
          ))}
        </div>
      )}

      {propMomentCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Props used ({propMomentCount} moment{propMomentCount === 1 ? "" : "s"})
        </p>
      )}
    </div>
  );
}
