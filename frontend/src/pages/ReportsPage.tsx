import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type {
  CostumesBySceneGroup,
  CueSheetCategory,
  PropSheetEntry,
} from "@/lib/types";

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);

  const [propSheet, setPropSheet] = useState<PropSheetEntry[]>([]);
  const [cueSheet, setCueSheet] = useState<CueSheetCategory[]>([]);
  const [costumesReport, setCostumesReport] = useState<CostumesBySceneGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api.getPropSheetReport(productionId),
      api.getCueSheetReport(productionId),
      api.getCostumesBySceneReport(productionId),
    ])
      .then(([props, cues, costumes]) => {
        setPropSheet(props);
        setCueSheet(cues);
        setCostumesReport(costumes);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load reports");
      })
      .finally(() => setLoading(false));
  }, [productionId]);

  if (loading) {
    return <p className="text-muted-foreground">Loading reports…</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <Link
          to={`/productions/${productionId}/timeline`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Timeline
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Read-only views derived from timeline and preparation data.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Prop sheet</h2>
        {propSheet.length === 0 ? (
          <p className="text-sm text-muted-foreground">No props with moment references.</p>
        ) : (
          <div className="space-y-4">
            {propSheet.map((entry) => (
              <div key={entry.prop_id} className="rounded-lg border border-border p-4">
                <h3 className="font-medium">{entry.prop_name}</h3>
                {entry.description && (
                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                )}
                <ul className="mt-2 space-y-1 text-sm">
                  {entry.moments.map((ref) => (
                    <li key={`${entry.prop_id}-${ref.moment_id}`}>
                      Act {ref.act_number}, Scene {ref.scene_number}
                      {ref.scene_title ? ` (${ref.scene_title})` : ""} — Moment{" "}
                      {ref.sequence_number}
                      {ref.character_name ? ` — ${ref.character_name}` : ""}
                      {ref.notes ? ` — ${ref.notes}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Cue sheet</h2>
        {cueSheet.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cues found.</p>
        ) : (
          <div className="space-y-6">
            {cueSheet.map((category) => (
              <div key={category.cue_category_id}>
                <h3 className="font-medium">{category.cue_category_name}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {category.cues.map((cue) => (
                    <li key={cue.cue_id}>
                      <span className="font-medium">{cue.title}</span>
                      {" — "}
                      Act {cue.act_number}, Scene {cue.scene_number}
                      {cue.scene_title ? ` (${cue.scene_title})` : ""} — Moment{" "}
                      {cue.sequence_number}
                      {cue.notes ? ` — ${cue.notes}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Costumes by scene</h2>
        {costumesReport.length === 0 ? (
          <p className="text-sm text-muted-foreground">No costume assignments.</p>
        ) : (
          <div className="space-y-4">
            {costumesReport.map((group) => (
              <div key={group.scene_id} className="rounded-lg border border-border p-4">
                <h3 className="font-medium">
                  Act {group.act_number}, Scene {group.scene_number}
                  {group.scene_title ? `: ${group.scene_title}` : ""}
                </h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {group.costumes.map((costume) => (
                    <li key={costume.costume_id}>
                      <span className="font-medium">{costume.character_name}</span> —{" "}
                      {costume.name}
                      {costume.description ? ` (${costume.description})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
