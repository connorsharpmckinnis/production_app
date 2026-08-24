import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, formatApiError } from "@/lib/api";
import type { RehearsalDetailResponse } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils";

function sceneLabel(scene: {
  act_number: number | null;
  number: number;
  title: string | null;
}): string {
  const base =
    scene.act_number != null ? `${scene.act_number}.${scene.number}` : `Scene ${scene.number}`;
  return scene.title ? `${base} — ${scene.title}` : base;
}

export default function CallSheetPage() {
  const { id, rehearsalId: rehearsalIdParam } = useParams<{
    id: string;
    rehearsalId: string;
  }>();
  const productionId = Number(id);
  const rehearsalId = Number(rehearsalIdParam);

  const [productionTitle, setProductionTitle] = useState<string | null>(null);
  const [rehearsal, setRehearsal] = useState<RehearsalDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api.getProduction(productionId),
      api.getCallSheet(productionId, rehearsalId),
    ])
      .then(([production, detail]) => {
        setProductionTitle(production.title);
        setRehearsal(detail);
      })
      .catch((err: unknown) => {
        setError(formatApiError(err, "Failed to load call sheet"));
      })
      .finally(() => setLoading(false));
  }, [productionId, rehearsalId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !rehearsal) {
    return (
      <div className="space-y-4">
        <Link
          to={`/productions/${productionId}/rehearsals/${rehearsalId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Rehearsal
        </Link>
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Call sheet not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const heading = rehearsal.title?.trim() || "Call sheet";
  const published = ["published", "in_progress", "completed"].includes(rehearsal.status);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to={`/productions/${productionId}/rehearsals/${rehearsalId}`}
            className="reports-print-hide text-sm text-muted-foreground hover:text-foreground"
          >
            ← Rehearsal
          </Link>
          <p className="mt-2 text-sm uppercase tracking-wide text-muted-foreground">
            {productionTitle ?? `Production #${productionId}`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(rehearsal.starts_at)} · {formatTime(rehearsal.starts_at)} –{" "}
            {formatTime(rehearsal.ends_at)}
            {rehearsal.location_name ? ` · ${rehearsal.location_name}` : ""}
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

      {!published && (
        <Alert className="reports-print-hide">
          <AlertDescription>
            This call sheet is not published yet. Nothing here is official until the
            director publishes the rehearsal plan.
          </AlertDescription>
        </Alert>
      )}

      {rehearsal.blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocks on this call sheet yet.</p>
      ) : (
        <div className="space-y-6">
          {rehearsal.blocks.map((block, index) => (
            <section
              key={block.id}
              className="break-inside-avoid space-y-2 border-b border-border pb-4 last:border-b-0"
            >
              <h2 className="text-lg font-medium">
                Block {index + 1}: {formatTime(block.starts_at)} – {formatTime(block.ends_at)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {block.location_name ?? "Location TBD"}
                {block.label ? ` · ${block.label}` : ""}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium">Scenes</h3>
                  {block.scenes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None listed</p>
                  ) : (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                      {block.scenes.map((scene) => (
                        <li key={scene.id}>{sceneLabel(scene)}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium">Called</h3>
                  {block.calls.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nobody listed</p>
                  ) : (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                      {block.calls.map((call) => (
                        <li key={call.user_id}>{call.display_name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
