import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type {
  LavChartIssue,
  LavChartResponse,
  LavPackCell,
  LavWireCell,
} from "@/lib/types";

type SheetKind = "wires" | "packs";

function cellKey(rowKey: string, sceneId: number) {
  return `${rowKey}::${sceneId}`;
}

function buildWireMap(cells: LavWireCell[]) {
  const map = new Map<string, number | null>();
  for (const cell of cells) {
    map.set(cellKey(cell.row_key, cell.scene_id), cell.wire_id);
  }
  return map;
}

function buildPackMap(cells: LavPackCell[]) {
  const map = new Map<string, number | null>();
  for (const cell of cells) {
    map.set(cellKey(cell.row_key, cell.scene_id), cell.pack_id);
  }
  return map;
}

function issueMatches(
  issues: LavChartIssue[],
  rowKey: string,
  sceneId: number,
  codes: string[],
) {
  return issues.some(
    (issue) =>
      codes.includes(issue.code) &&
      issue.row_key === rowKey &&
      issue.scene_id === sceneId,
  );
}

export default function LavChartPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const confirm = useConfirm();
  const toast = useToast();

  const [chart, setChart] = useState<LavChartResponse | null>(null);
  const [wireMap, setWireMap] = useState<Map<string, number | null>>(new Map());
  const [packMap, setPackMap] = useState<Map<string, number | null>>(new Map());
  const [sheet, setSheet] = useState<SheetKind>("wires");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [wireIdentifier, setWireIdentifier] = useState("");
  const [packIdentifier, setPackIdentifier] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);

  async function loadChart() {
    setError(null);
    try {
      const data = await api.getLavChart(productionId);
      setChart(data);
      setWireMap(buildWireMap(data.wire_cells));
      setPackMap(buildPackMap(data.pack_cells));
      setDirty(false);
    } catch (err) {
      setError(formatApiError(err, "Failed to load lav chart"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChart();
  }, [productionId]);

  const needSetByRow = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!chart) return map;
    for (const row of chart.rows) {
      map.set(row.row_key, new Set(row.need_scene_ids));
    }
    return map;
  }, [chart]);

  function setWireCell(rowKey: string, sceneId: number, wireId: number | null) {
    setWireMap((prev) => {
      const next = new Map(prev);
      next.set(cellKey(rowKey, sceneId), wireId);
      return next;
    });
    setDirty(true);
  }

  function setPackCell(rowKey: string, sceneId: number, packId: number | null) {
    setPackMap((prev) => {
      const next = new Map(prev);
      next.set(cellKey(rowKey, sceneId), packId);
      return next;
    });
    setDirty(true);
  }

  function serializeCells(): { wire_cells: LavWireCell[]; pack_cells: LavPackCell[] } {
    const wire_cells: LavWireCell[] = [];
    const pack_cells: LavPackCell[] = [];
    if (!chart) return { wire_cells, pack_cells };
    for (const row of chart.rows) {
      for (const scene of chart.scenes) {
        const wireId = wireMap.get(cellKey(row.row_key, scene.id)) ?? null;
        if (wireId != null) {
          wire_cells.push({ row_key: row.row_key, scene_id: scene.id, wire_id: wireId });
        }
        const packId = packMap.get(cellKey(row.row_key, scene.id)) ?? null;
        if (packId != null) {
          pack_cells.push({ row_key: row.row_key, scene_id: scene.id, pack_id: packId });
        }
      }
    }
    return { wire_cells, pack_cells };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = await api.saveLavChart(productionId, serializeCells());
      setChart(data);
      setWireMap(buildWireMap(data.wire_cells));
      setPackMap(buildPackMap(data.pack_cells));
      setDirty(false);
      toast.success("Lav chart saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save lav chart"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePropose() {
    const ok = await confirm({
      title: "Propose lav chart?",
      description:
        "This replaces the current wire and pack assignments with a rule-based proposal. You can still edit afterward.",
      confirmLabel: "Propose",
    });
    if (!ok) return;

    setProposing(true);
    try {
      const data = await api.proposeLavChart(productionId, ["wires", "packs"]);
      setChart(data);
      setWireMap(buildWireMap(data.wire_cells));
      setPackMap(buildPackMap(data.pack_cells));
      setDirty(false);
      toast.success("Proposed chart applied");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to propose lav chart"));
    } finally {
      setProposing(false);
    }
  }

  async function handleAddWire(event: React.FormEvent) {
    event.preventDefault();
    if (!wireIdentifier.trim()) return;
    try {
      await api.createWire(productionId, { identifier: wireIdentifier.trim() });
      setWireIdentifier("");
      toast.success("Wire added");
      await loadChart();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to add wire"));
    }
  }

  async function handleAddPack(event: React.FormEvent) {
    event.preventDefault();
    if (!packIdentifier.trim()) return;
    try {
      await api.createPack(productionId, { identifier: packIdentifier.trim() });
      setPackIdentifier("");
      toast.success("Pack added");
      await loadChart();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to add pack"));
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !chart) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error ?? "Lav chart unavailable"}</p>
        <Button className="mt-4" variant="outline" onClick={() => void loadChart()}>
          Retry
        </Button>
      </div>
    );
  }

  const issues = chart.issues;
  const errorIssues = issues.filter((i) => i.severity === "error");
  const warningIssues = issues.filter((i) => i.severity === "warning");
  const catalog = sheet === "wires" ? chart.wires : chart.packs;

  return (
    <div className="space-y-6 pb-8">
      <div className="lav-print-hide space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lav chart</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Assign wires and packs by scene. Rows are actors (with their characters). Lav planning
              lives on this chart; Timeline change Moments come later.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 size-4" />
              Print
            </Button>
            <Button variant="outline" onClick={() => void handlePropose()} disabled={proposing}>
              {proposing ? "Proposing…" : "Propose chart"}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !dirty}>
              {saving ? "Saving…" : dirty ? "Save" : "Saved"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={sheet === "wires" ? "default" : "outline"}
            size="sm"
            onClick={() => setSheet("wires")}
          >
            Wires ({chart.wires.length})
          </Button>
          <Button
            variant={sheet === "packs" ? "default" : "outline"}
            size="sm"
            onClick={() => setSheet("packs")}
          >
            Packs ({chart.packs.length})
          </Button>
          <Link
            to={`/productions/${productionId}/reports`}
            className="inline-flex items-center rounded-md px-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Other reports
          </Link>
        </div>

        {(errorIssues.length > 0 || warningIssues.length > 0) && (
          <div className="space-y-2">
            {errorIssues.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                <p className="font-medium text-destructive">
                  {errorIssues.length} conflict{errorIssues.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-1 list-disc pl-5 text-destructive">
                  {errorIssues.slice(0, 6).map((issue, index) => (
                    <li key={`e-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {warningIssues.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {warningIssues.length} warning{warningIssues.length === 1 ? "" : "s"} — mid-act
                  or uncovered need scenes may need manual booth changes
                </p>
                <ul className="mt-1 list-disc pl-5 text-amber-900/90 dark:text-amber-100/90">
                  {warningIssues.slice(0, 8).map((issue, index) => (
                    <li key={`w-${index}`}>{issue.message}</li>
                  ))}
                  {warningIssues.length > 8 && (
                    <li>…and {warningIssues.length - 8} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <details
          className="rounded-md border border-border bg-muted/30 px-3 py-2"
          open={rulesOpen}
          onToggle={(e) => setRulesOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-sm font-medium">Lav chart rules</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {chart.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>

        <div className="grid gap-3 md:grid-cols-2">
          <form onSubmit={handleAddWire} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Add wire</span>
              <input
                className="rounded-md border border-input bg-background px-3 py-2"
                value={wireIdentifier}
                onChange={(e) => setWireIdentifier(e.target.value)}
                placeholder="Wire 1"
              />
            </label>
            <Button type="submit" variant="outline" size="sm">
              Add
            </Button>
          </form>
          <form onSubmit={handleAddPack} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Add pack</span>
              <input
                className="rounded-md border border-input bg-background px-3 py-2"
                value={packIdentifier}
                onChange={(e) => setPackIdentifier(e.target.value)}
                placeholder="Pack 1"
              />
            </label>
            <Button type="submit" variant="outline" size="sm">
              Add
            </Button>
          </form>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium print:block">
          {sheet === "wires" ? "Wire chart" : "Pack chart"}
        </h2>

        {chart.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No speaking or singing characters yet. Import a script and cast actors, then propose.
          </p>
        ) : chart.scenes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scenes in this production yet.</p>
        ) : (
          <div className="lav-chart-scroll overflow-x-auto rounded-md border border-border">
            <table className="lav-chart-table min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="lav-chart-sticky sticky left-0 z-10 border-b border-r border-border bg-muted/50 px-3 py-2 text-left font-medium">
                    Actor / characters
                  </th>
                  {chart.scenes.map((scene) => (
                    <th
                      key={scene.id}
                      className="border-b border-border px-2 py-2 text-center font-medium whitespace-nowrap"
                      title={scene.scene_title ?? undefined}
                    >
                      {scene.act_number}.{scene.scene_number}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => {
                  const needs = needSetByRow.get(row.row_key) ?? new Set();
                  return (
                    <tr key={row.row_key} className="align-middle">
                      <th className="lav-chart-sticky sticky left-0 z-10 border-b border-r border-border bg-background px-3 py-2 text-left font-normal">
                        <span className="font-medium">{row.label}</span>
                      </th>
                      {chart.scenes.map((scene) => {
                        const key = cellKey(row.row_key, scene.id);
                        const isNeed = needs.has(scene.id);
                        const value =
                          sheet === "wires"
                            ? (wireMap.get(key) ?? null)
                            : (packMap.get(key) ?? null);
                        const conflict = issueMatches(
                          issues,
                          row.row_key,
                          scene.id,
                          sheet === "wires"
                            ? ["wire_conflict", "mid_act_wire_change"]
                            : ["pack_conflict", "mid_act_pack_change"],
                        );
                        const missingNeed = isNeed && value == null;

                        return (
                          <td
                            key={scene.id}
                            className={[
                              "border-b border-border px-1 py-1 text-center",
                              isNeed ? "bg-highlight-muted/40" : "",
                              conflict || missingNeed ? "bg-amber-500/15" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <select
                              className="lav-print-hide max-w-[6.5rem] rounded border border-input bg-background px-1 py-1 text-xs"
                              value={value ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const next = raw === "" ? null : Number(raw);
                                if (sheet === "wires") {
                                  setWireCell(row.row_key, scene.id, next);
                                } else {
                                  setPackCell(row.row_key, scene.id, next);
                                }
                              }}
                              aria-label={`${row.label} ${sheet} for scene ${scene.act_number}.${scene.scene_number}`}
                            >
                              <option value="">—</option>
                              {catalog.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.identifier}
                                </option>
                              ))}
                            </select>
                            <span className="lav-print-only hidden text-xs">
                              {value == null
                                ? "—"
                                : catalog.find((item) => item.id === value)?.identifier ?? value}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {catalog.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Add {sheet === "wires" ? "wires" : "packs"} above, then run Propose chart.
          </p>
        )}
      </div>
    </div>
  );
}
