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
  const { characters, songs, props, setPieces } = summary;

  if (
    characters.length === 0 &&
    songs.length === 0 &&
    props.length === 0 &&
    setPieces.length === 0
  ) {
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

      {props.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Props
          </span>
          {props.map((prop) => (
            <ObjectLink
              key={prop.id}
              objectType="prop"
              objectId={prop.id}
              label={prop.name}
              className="text-xs"
            />
          ))}
        </div>
      )}

      {setPieces.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Set pieces
          </span>
          {setPieces.map((piece) => (
            <ObjectLink
              key={piece.id}
              objectType="set_piece"
              objectId={piece.id}
              label={piece.name}
              className="text-xs"
            />
          ))}
        </div>
      )}
    </div>
  );
}
