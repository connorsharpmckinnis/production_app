import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OnStagePresenceChart } from "@/components/OnStagePresenceChart";
import { api, formatApiError } from "@/lib/api";
import { humanTimelinePath } from "@/lib/timelineDeepLinks";
import type {
  BlockingSheetEntry,
  CostumeChangeEntry,
  CueSheetCategory,
  EntranceExitSheetGroup,
  OnStageChartReport,
  PropSheetEntry,
} from "@/lib/types";

const REPORT_SECTIONS = [
  { id: "report-on-stage-chart", label: "On-stage chart" },
  { id: "report-prop-sheet", label: "Prop sheet" },
  { id: "report-cue-sheet", label: "Cue sheet" },
  { id: "report-costumes", label: "Costume changes" },
  { id: "report-entrances-exits", label: "Entrances & exits" },
  { id: "report-blocking", label: "Blocking sheet" },
] as const;

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);

  const [propSheet, setPropSheet] = useState<PropSheetEntry[]>([]);
  const [cueSheet, setCueSheet] = useState<CueSheetCategory[]>([]);
  const [costumeChanges, setCostumeChanges] = useState<CostumeChangeEntry[]>([]);
  const [entranceExitReport, setEntranceExitReport] = useState<EntranceExitSheetGroup[]>([]);
  const [blockingReport, setBlockingReport] = useState<BlockingSheetEntry[]>([]);
  const [onStageChart, setOnStageChart] = useState<OnStageChartReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api.getPropSheetReport(productionId),
      api.getCueSheetReport(productionId),
      api.getCostumeChangesReport(productionId),
      api.getEntranceExitSheetReport(productionId),
      api.getBlockingSheetReport(productionId),
      api.getOnStageChartReport(productionId),
    ])
      .then(([props, cues, costumeChangeRows, entranceExit, blocking, onStage]) => {
        setPropSheet(props);
        setCueSheet(cues);
        setCostumeChanges(costumeChangeRows);
        setEntranceExitReport(entranceExit);
        setBlockingReport(blocking);
        setOnStageChart(onStage);
      })
      .catch((err: unknown) => {
        setError(formatApiError(err, "Failed to load reports"));
      })
      .finally(() => setLoading(false));
  }, [productionId]);

  function MomentLink({
    actNumber,
    sceneNumber,
    momentSequence,
    children,
  }: {
    actNumber: number;
    sceneNumber: number;
    momentSequence: number;
    children: React.ReactNode;
  }) {
    return (
      <Link
        to={humanTimelinePath(productionId, actNumber, sceneNumber, momentSequence)}
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
          {Array.from({ length: 6 }).map((_, index) => (
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
              Read-only views derived from timeline and preparation data.{" "}
              <Link
                to={`/productions/${productionId}/lav-chart`}
                className="reports-print-hide text-foreground underline-offset-4 hover:underline"
              >
                Open lav chart
              </Link>{" "}
              for editable wire/pack assignments.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="reports-print-hide"
          >
            Print
          </Button>
        </div>
      </div>

      <nav
        aria-label="Report sections"
        className="reports-toc sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 border-b border-border bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        {REPORT_SECTIONS.map((section) => (
          <Button key={section.id} variant="outline" size="sm" asChild>
            <a href={`#${section.id}`}>{section.label}</a>
          </Button>
        ))}
      </nav>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section
        id="report-on-stage-chart"
        className="reports-section reports-section-chart space-y-4 scroll-mt-20"
      >
        <h2 className="text-lg font-medium">On-stage chart</h2>
        <p className="text-sm text-muted-foreground">
          Prototype: character presence across the show, derived from entrance and exit records.
        </p>
        {onStageChart ? (
          <OnStagePresenceChart productionId={productionId} report={onStageChart} />
        ) : (
          <p className="text-sm text-muted-foreground">Chart data is unavailable.</p>
        )}
      </section>

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
                    const personLabel = ref.character_name ?? ref.user_display_name;
                    return (
                      <li
                        key={`${entry.prop_id}-${ref.moment_id}`}
                        className="flex flex-wrap items-baseline gap-x-1.5"
                      >
                        <Badge
                          variant={ref.kind === "on" ? "default" : "secondary"}
                          className="uppercase"
                        >
                          {ref.kind === "on" ? "On" : "Off"}
                        </Badge>
                        <span>
                          Act {ref.act_number}, Scene {ref.scene_number}
                          {ref.scene_title ? ` (${ref.scene_title})` : ""} —{" "}
                          <MomentLink
                            actNumber={ref.act_number}
                            sceneNumber={ref.scene_number}
                            momentSequence={ref.sequence_number}
                          >
                            Moment {ref.sequence_number}
                          </MomentLink>
                          {personLabel ? ` — ${personLabel}` : ""}
                          {ref.notes ? ` — ${ref.notes}` : ""}
                        </span>
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
                    return (
                      <li key={cue.cue_id}>
                        <span className="font-medium">{cue.title}</span>
                        {" — "}
                        Act {cue.act_number}, Scene {cue.scene_number}
                        {cue.scene_title ? ` (${cue.scene_title})` : ""} —{" "}
                        <MomentLink
                          actNumber={cue.act_number}
                          sceneNumber={cue.scene_number}
                          momentSequence={cue.sequence_number}
                        >
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
        <h2 className="text-lg font-medium">Costume changes</h2>
        {costumeChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No costume events on the timeline.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {costumeChanges.map((entry) => {
              return (
                <li
                  key={`${entry.moment_id}-${entry.character_id}`}
                  className="flex flex-wrap items-baseline gap-x-1.5"
                >
                  <Badge variant={entry.kind === "on" ? "default" : "secondary"}>
                    {entry.kind === "on" ? "Wear" : "Clear"}
                  </Badge>
                  <span>
                    <span className="font-medium">{entry.character_name}</span>
                    {entry.costume_name ? ` — ${entry.costume_name}` : ""} — Act{" "}
                    {entry.act_number}, Scene {entry.scene_number}
                    {entry.scene_title ? ` (${entry.scene_title})` : ""} —{" "}
                    <MomentLink
                      actNumber={entry.act_number}
                      sceneNumber={entry.scene_number}
                      momentSequence={entry.sequence_number}
                    >
                      Moment {entry.sequence_number}
                    </MomentLink>
                    {entry.notes ? ` — ${entry.notes}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
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
                      <MomentLink
                        actNumber={group.act_number}
                        sceneNumber={group.scene_number}
                        momentSequence={row.sequence_number}
                      >
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
              return (
                <li
                  key={entry.moment_id + "-" + entry.character_id}
                  className="rounded-lg border border-border p-3"
                >
                  Act {entry.act_number}, Scene {entry.scene_number}
                  {entry.scene_title ? ` (${entry.scene_title})` : ""} —{" "}
                  <MomentLink
                    actNumber={entry.act_number}
                    sceneNumber={entry.scene_number}
                    momentSequence={entry.sequence_number}
                  >
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
