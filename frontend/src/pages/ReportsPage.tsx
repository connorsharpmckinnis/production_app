import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type {
  ActSummary,
  BlockingSheetEntry,
  CostumesBySceneGroup,
  CueSheetCategory,
  EntranceExitSheetGroup,
  PropSheetEntry,
} from "@/lib/types";

const REPORT_SECTIONS = [
  { id: "report-prop-sheet", label: "Prop sheet" },
  { id: "report-cue-sheet", label: "Cue sheet" },
  { id: "report-costumes", label: "Costumes by scene" },
  { id: "report-entrances-exits", label: "Entrances & exits" },
  { id: "report-blocking", label: "Blocking sheet" },
] as const;

function sceneMapKey(actNumber: number, sceneNumber: number) {
  return `${actNumber}-${sceneNumber}`;
}

function buildSceneIdMap(acts: ActSummary[]) {
  const map = new Map<string, number>();
  for (const act of acts) {
    for (const scene of act.scenes) {
      map.set(sceneMapKey(act.number, scene.number), scene.id);
    }
  }
  return map;
}

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);

  const [propSheet, setPropSheet] = useState<PropSheetEntry[]>([]);
  const [cueSheet, setCueSheet] = useState<CueSheetCategory[]>([]);
  const [costumesReport, setCostumesReport] = useState<CostumesBySceneGroup[]>([]);
  const [entranceExitReport, setEntranceExitReport] = useState<EntranceExitSheetGroup[]>([]);
  const [blockingReport, setBlockingReport] = useState<BlockingSheetEntry[]>([]);
  const [sceneIdMap, setSceneIdMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api.getPropSheetReport(productionId),
      api.getCueSheetReport(productionId),
      api.getCostumesBySceneReport(productionId),
      api.getEntranceExitSheetReport(productionId),
      api.getBlockingSheetReport(productionId),
      api.listActs(productionId),
    ])
      .then(([props, cues, costumes, entranceExit, blocking, acts]) => {
        setPropSheet(props);
        setCueSheet(cues);
        setCostumesReport(costumes);
        setEntranceExitReport(entranceExit);
        setBlockingReport(blocking);
        setSceneIdMap(buildSceneIdMap(acts));
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load reports");
      })
      .finally(() => setLoading(false));
  }, [productionId]);

  const resolveSceneId = useMemo(
    () => (actNumber: number, sceneNumber: number) =>
      sceneIdMap.get(sceneMapKey(actNumber, sceneNumber)) ?? null,
    [sceneIdMap],
  );

  function MomentLink({
    sceneId,
    momentId,
    children,
  }: {
    sceneId: number | null;
    momentId: number;
    children: React.ReactNode;
  }) {
    if (sceneId === null) {
      return <span>{children}</span>;
    }
    return (
      <Link
        to={`/productions/${productionId}/timeline?scene=${sceneId}&moment=${momentId}`}
        className="text-primary hover:underline"
      >
        {children}
      </Link>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-28" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <Link
          to={`/productions/${productionId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Overview
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground">
              Read-only views derived from timeline and preparation data.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="reports-print-hide rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Print
          </button>
        </div>
      </div>

      <nav
        aria-label="Report sections"
        className="reports-toc sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 border-b border-border bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        {REPORT_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {section.label}
          </a>
        ))}
      </nav>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section id="report-prop-sheet" className="reports-section space-y-4 scroll-mt-20">
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
                  {entry.moments.map((ref) => {
                    const sceneId = resolveSceneId(ref.act_number, ref.scene_number);
                    return (
                      <li key={`${entry.prop_id}-${ref.moment_id}`}>
                        Act {ref.act_number}, Scene {ref.scene_number}
                        {ref.scene_title ? ` (${ref.scene_title})` : ""} —{" "}
                        <MomentLink sceneId={sceneId} momentId={ref.moment_id}>
                          Moment {ref.sequence_number}
                        </MomentLink>
                        {ref.character_name ? ` — ${ref.character_name}` : ""}
                        {ref.notes ? ` — ${ref.notes}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="report-cue-sheet" className="reports-section space-y-4 scroll-mt-20">
        <h2 className="text-lg font-medium">Cue sheet</h2>
        {cueSheet.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cues found.</p>
        ) : (
          <div className="space-y-6">
            {cueSheet.map((category) => (
              <div key={category.cue_category_id}>
                <h3 className="font-medium">{category.cue_category_name}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {category.cues.map((cue) => {
                    const sceneId = resolveSceneId(cue.act_number, cue.scene_number);
                    return (
                      <li key={cue.cue_id}>
                        <span className="font-medium">{cue.title}</span>
                        {" — "}
                        Act {cue.act_number}, Scene {cue.scene_number}
                        {cue.scene_title ? ` (${cue.scene_title})` : ""} —{" "}
                        <MomentLink sceneId={sceneId} momentId={cue.moment_id}>
                          Moment {cue.sequence_number}
                        </MomentLink>
                        {cue.notes ? ` — ${cue.notes}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="report-costumes" className="reports-section space-y-4 scroll-mt-20">
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

      <section id="report-entrances-exits" className="reports-section space-y-4 scroll-mt-20">
        <h2 className="text-lg font-medium">Entrances &amp; exits</h2>
        {entranceExitReport.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entrance or exit records.</p>
        ) : (
          <div className="space-y-4">
            {entranceExitReport.map((group) => (
              <div key={group.scene_id} className="rounded-lg border border-border p-4">
                <h3 className="font-medium">
                  Act {group.act_number}, Scene {group.scene_number}
                  {group.scene_title ? `: ${group.scene_title}` : ""}
                </h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {group.rows.map((row) => (
                    <li key={`${row.moment_id}-${row.movement_type}-${row.character_id}`}>
                      <MomentLink sceneId={group.scene_id} momentId={row.moment_id}>
                        Moment {row.sequence_number}
                      </MomentLink>{" "}
                      — {row.movement_type}: {row.character_name}
                      {row.notes ? ` (${row.notes})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="report-blocking" className="reports-section space-y-4 scroll-mt-20">
        <h2 className="text-lg font-medium">Blocking sheet</h2>
        {blockingReport.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blocking notes.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {blockingReport.map((entry) => {
              const sceneId = resolveSceneId(entry.act_number, entry.scene_number);
              return (
                <li
                  key={entry.moment_id + "-" + entry.character_id}
                  className="rounded-lg border border-border p-3"
                >
                  Act {entry.act_number}, Scene {entry.scene_number}
                  {entry.scene_title ? ` (${entry.scene_title})` : ""} —{" "}
                  <MomentLink sceneId={sceneId} momentId={entry.moment_id}>
                    Moment {entry.sequence_number}
                  </MomentLink>{" "}
                  — {entry.character_name}: {entry.notes}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
