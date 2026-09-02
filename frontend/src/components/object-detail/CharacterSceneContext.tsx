import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ObjectLink from "@/components/object-detail/ObjectLink";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { api, formatApiError } from "@/lib/api";
import { formatMomentCode, humanTimelinePath } from "@/lib/timelineDeepLinks";
import type {
  CostumeWearingResponse,
  PropInPlayResponse,
  SetPieceInPlayResponse,
} from "@/lib/types";

interface CharacterSceneContextProps {
  productionId: number;
  characterId: number;
  sceneId: number;
  sceneLabel?: string;
  sceneEndMomentId?: number;
}

interface SceneMovement {
  momentId: number;
  sequenceNumber: number;
  actNumber: number;
  sceneNumber: number;
  movementType: "entrance" | "exit";
  notes: string | null;
}

/**
 * Scene-filtered extras for Character detail opened from a Timeline scene summary.
 * Entrances/exits use the entrance-exit report when available; end-of-scene holdings
 * come from getMoment on the last moment in the section.
 */
export default function CharacterSceneContext({
  productionId,
  characterId,
  sceneId,
  sceneLabel,
  sceneEndMomentId,
}: CharacterSceneContextProps) {
  const { hasCapability } = useProductionAccess();
  const canReadReports = hasCapability("reports", "read");
  const canReadTimeline = hasCapability("timeline", "read");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movements, setMovements] = useState<SceneMovement[]>([]);
  const [propsHeld, setPropsHeld] = useState<PropInPlayResponse[]>([]);
  const [setsHeld, setSetsHeld] = useState<SetPieceInPlayResponse[]>([]);
  const [costumes, setCostumes] = useState<CostumeWearingResponse[]>([]);
  const [onStage, setOnStage] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const movementPromise = canReadReports
          ? api.getEntranceExitSheetReport(productionId).then((groups) => {
              const group = groups.find((row) => row.scene_id === sceneId);
              if (!group) return [] as SceneMovement[];
              return group.rows
                .filter((row) => row.character_id === characterId)
                .map((row) => ({
                  momentId: row.moment_id,
                  sequenceNumber: row.sequence_number,
                  actNumber: group.act_number,
                  sceneNumber: group.scene_number,
                  movementType: row.movement_type,
                  notes: row.notes,
                }));
            })
          : Promise.resolve([] as SceneMovement[]);

        const momentPromise =
          canReadTimeline && sceneEndMomentId != null
            ? api.getMoment(productionId, sceneEndMomentId)
            : Promise.resolve(null);

        const [movementRows, moment] = await Promise.all([
          movementPromise,
          momentPromise,
        ]);

        if (cancelled) return;

        setMovements(movementRows);
        if (moment) {
          setPropsHeld(
            moment.props_in_play.filter((item) => item.character_id === characterId),
          );
          setSetsHeld(
            moment.set_pieces_in_play.filter(
              (item) => item.character_id === characterId,
            ),
          );
          setCostumes(
            moment.costumes_wearing.filter((item) => item.character_id === characterId),
          );
          setOnStage(
            moment.on_stage_characters.some((item) => item.id === characterId),
          );
        } else {
          setPropsHeld([]);
          setSetsHeld([]);
          setCostumes([]);
          setOnStage(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, "Failed to load scene context"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    canReadReports,
    canReadTimeline,
    characterId,
    productionId,
    sceneEndMomentId,
    sceneId,
  ]);

  if (!canReadReports && !canReadTimeline) {
    return null;
  }

  const heading = sceneLabel?.trim() ? `In ${sceneLabel}` : "In this scene";

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 px-3 py-3">
      <div>
        <h3 className="text-sm font-medium">{heading}</h3>
        <p className="text-xs text-muted-foreground">
          Scene-specific view. Holdings below are as of the end of this scene.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading scene details…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="space-y-3 text-sm">
          {canReadTimeline && sceneEndMomentId != null ? (
            <p className="text-muted-foreground">
              On stage at end of scene:{" "}
              <span className="font-medium text-foreground">
                {onStage ? "Yes" : "No"}
              </span>
            </p>
          ) : null}

          {canReadReports ? (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Entrances &amp; exits
              </p>
              {movements.length === 0 ? (
                <p className="text-muted-foreground">None recorded in this scene.</p>
              ) : (
                <ul className="space-y-1">
                  {movements.map((row) => {
                    const code = formatMomentCode(
                      row.actNumber,
                      row.sceneNumber,
                      row.sequenceNumber,
                    );
                    return (
                      <li key={`${row.momentId}-${row.movementType}`}>
                        <span className="font-medium capitalize">
                          {row.movementType}
                        </span>
                        {" — "}
                        <Link
                          to={humanTimelinePath(
                            productionId,
                            row.actNumber,
                            row.sceneNumber,
                            row.sequenceNumber,
                          )}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {code}
                        </Link>
                        {row.notes ? (
                          <span className="text-muted-foreground"> — {row.notes}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {canReadTimeline && sceneEndMomentId != null ? (
            <>
              <AssetList
                title="Props held"
                empty="None"
                items={propsHeld.map((item) => ({
                  key: `prop-${item.prop_id}`,
                  node: (
                    <ObjectLink
                      objectType="prop"
                      objectId={item.prop_id}
                      label={item.prop_name}
                      className="text-xs"
                    />
                  ),
                }))}
              />
              <AssetList
                title="Set pieces"
                empty="None"
                items={setsHeld.map((item) => ({
                  key: `set-${item.set_piece_id}`,
                  node: (
                    <ObjectLink
                      objectType="set_piece"
                      objectId={item.set_piece_id}
                      label={item.set_piece_name}
                      className="text-xs"
                    />
                  ),
                }))}
              />
              <AssetList
                title="Costume wearing"
                empty="None"
                items={costumes.map((item) => ({
                  key: `costume-${item.costume_id}`,
                  node: (
                    <ObjectLink
                      objectType="costume"
                      objectId={item.costume_id}
                      label={item.costume_name}
                      className="text-xs"
                    />
                  ),
                }))}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AssetList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { key: string; node: ReactNode }[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item.key}>{item.node}</span>
          ))}
        </div>
      )}
    </div>
  );
}
