import ObjectLink from "@/components/object-detail/ObjectLink";
import type { SceneSummaryData } from "@/lib/sceneSummary";

interface SceneSummaryStripProps {
  summary: SceneSummaryData;
  sceneId: number;
  sceneLabel?: string;
  /** Last moment in the scene section — powers end-of-scene holdings in Character detail. */
  sceneEndMomentId?: number;
}

export default function SceneSummaryStrip({
  summary,
  sceneId,
  sceneLabel,
  sceneEndMomentId,
}: SceneSummaryStripProps) {
  const { characters, songs, propMomentCount } = summary;

  if (characters.length === 0 && songs.length === 0 && propMomentCount === 0) {
    return null;
  }

  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/20 px-3 py-2">
      {characters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Characters in this scene
          </span>
          {characters.map((character) => (
            <ObjectLink
              key={character.id}
              objectType="character"
              objectId={character.id}
              label={character.name}
              sceneId={sceneId}
              sceneLabel={sceneLabel}
              sceneEndMomentId={sceneEndMomentId}
              className="text-xs"
            />
          ))}
        </div>
      )}

      {songs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Songs
          </span>
          {songs.map((song) => (
            <ObjectLink
              key={song.id}
              objectType="song"
              objectId={song.id}
              label={song.title}
              className="text-xs"
            />
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
