import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, formatApiError } from "@/lib/api";
import type { RehearsalDetailResponse } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils";

function sortedCallNames(
  calls: { user_id: number; display_name: string }[],
): { user_id: number; display_name: string }[] {
  return [...calls].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
  );
}

function focusLabel(focus: string): string {
  switch (focus) {
    case "dialog":
      return "Dialog";
    case "music":
      return "Music";
    case "choreo":
      return "Choreo";
    default:
      return focus;
  }
}

/** Labels from the API end with " · Dialog|Music|Choreo"; drop that in the Item column. */
function itemLabel(label: string, focus: string): string {
  const suffix = ` · ${focusLabel(focus)}`;
  return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;
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

  const printedAt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    [],
  );

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
  const totalCalled = new Set(
    rehearsal.blocks.flatMap((block) => block.calls.map((call) => call.user_id)),
  ).size;

  return (
    <div className="call-sheet space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 reports-print-hide">
        <Link
          to={`/productions/${productionId}/rehearsals/${rehearsalId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Rehearsal
        </Link>
        <Button type="button" variant="outline" onClick={() => window.print()}>
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

      <header className="call-sheet-masthead">
        <p className="call-sheet-kicker">Call sheet</p>
        <p className="call-sheet-production">
          {productionTitle ?? `Production #${productionId}`}
        </p>
        <h1 className="call-sheet-title">{heading}</h1>
        <dl className="call-sheet-meta">
          <div>
            <dt>Date</dt>
            <dd>{formatDate(rehearsal.starts_at)}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>
              {formatTime(rehearsal.starts_at)} – {formatTime(rehearsal.ends_at)}
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{rehearsal.location_name ?? "TBD"}</dd>
          </div>
          <div>
            <dt>Blocks</dt>
            <dd>{rehearsal.blocks.length}</dd>
          </div>
          <div>
            <dt>Called</dt>
            <dd>{totalCalled || "—"}</dd>
          </div>
        </dl>
      </header>

      {rehearsal.blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocks on this call sheet yet.</p>
      ) : (
        <div className="call-sheet-blocks space-y-4">
          {rehearsal.blocks.map((block, index) => {
            const called = sortedCallNames(block.calls);
            return (
              <section key={block.id} className="call-sheet-block">
                <header className="call-sheet-block-header">
                  <div className="call-sheet-block-heading">
                    <h2>
                      <span className="call-sheet-block-index">Block {index + 1}</span>
                      <span className="call-sheet-block-time">
                        {formatTime(block.starts_at)} – {formatTime(block.ends_at)}
                      </span>
                    </h2>
                    {block.label ? (
                      <p className="call-sheet-block-label">{block.label}</p>
                    ) : null}
                  </div>
                  <p className="call-sheet-block-place">
                    {block.location_name ?? "Location TBD"}
                    {called.length > 0 ? ` · ${called.length} called` : ""}
                  </p>
                </header>

                {block.notes ? (
                  <p className="call-sheet-notes whitespace-pre-wrap">{block.notes}</p>
                ) : null}

                <div className="call-sheet-block-body">
                  <div>
                    <h3 className="call-sheet-section-label">Working on</h3>
                    {block.targets.length === 0 ? (
                      <p className="call-sheet-empty">None listed</p>
                    ) : (
                      <table className="call-sheet-table">
                        <thead>
                          <tr>
                            <th scope="col">Focus</th>
                            <th scope="col">Item</th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.targets.map((target) => (
                            <tr
                              key={`${target.focus}-${target.scene_id ?? "s"}-${target.song_id ?? "g"}`}
                            >
                              <td className="call-sheet-focus">
                                {focusLabel(target.focus)}
                              </td>
                              <td>{itemLabel(target.label, target.focus)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div>
                    <h3 className="call-sheet-section-label">
                      Called
                      {called.length > 0 ? (
                        <span className="call-sheet-section-count"> ({called.length})</span>
                      ) : null}
                    </h3>
                    {called.length === 0 ? (
                      <p className="call-sheet-empty">Nobody listed</p>
                    ) : (
                      <ul className="call-sheet-called">
                        {called.map((call) => (
                          <li key={call.user_id} className="call-sheet-called-item">
                            {call.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="call-sheet-footer">
        Printed from Theater Thing · {printedAt}
      </p>
    </div>
  );
}
