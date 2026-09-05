import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { Lock, LockOpen, MoreHorizontal, Pencil, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/context/ConfirmContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type {
  LavChartCatalogItem,
  LavChartIssue,
  LavChartResponse,
  LavChartSceneColumn,
  LavPackCell,
  LavWireCell,
  PackResponse,
  WireResponse,
} from "@/lib/types";

const NO_ASSET_VALUE = "__none__";

type SheetKind = "wires" | "packs";
type InventoryKind = "wire" | "pack";
type FillDialogState =
  | { mode: "row"; rowKey: string; label: string }
  | { mode: "act"; rowKey: string; label: string; actNumber: number }
  | null;

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

/** Act number → contiguous scene columns (for header spans + fill-act). */
function groupScenesByAct(scenes: LavChartSceneColumn[]) {
  const groups: { actNumber: number; actTitle: string | null; scenes: LavChartSceneColumn[] }[] =
    [];
  for (const scene of scenes) {
    const last = groups[groups.length - 1];
    if (last && last.actNumber === scene.act_number) {
      last.scenes.push(scene);
    } else {
      groups.push({
        actNumber: scene.act_number,
        actTitle: scene.act_title,
        scenes: [scene],
      });
    }
  }
  return groups;
}

function uniqueActNumbers(scenes: LavChartSceneColumn[]) {
  return [...new Set(scenes.map((s) => s.act_number))];
}

/**
 * Live wire/pack double-assign detection. Emits an issue for every conflicting
 * wearer so each cell can highlight.
 */
function detectAssignmentConflicts(
  chart: LavChartResponse,
  wireMap: Map<string, number | null>,
  packMap: Map<string, number | null>,
): LavChartIssue[] {
  const issues: LavChartIssue[] = [];
  for (const scene of chart.scenes) {
    const wireOwners = new Map<number, string[]>();
    const packOwners = new Map<number, string[]>();
    for (const row of chart.rows) {
      const wireId = wireMap.get(cellKey(row.row_key, scene.id));
      if (wireId != null) {
        const keys = wireOwners.get(wireId) ?? [];
        keys.push(row.row_key);
        wireOwners.set(wireId, keys);
      }
      const packId = packMap.get(cellKey(row.row_key, scene.id));
      if (packId != null) {
        const keys = packOwners.get(packId) ?? [];
        keys.push(row.row_key);
        packOwners.set(packId, keys);
      }
    }
    for (const [assetId, keys] of wireOwners) {
      if (keys.length > 1) {
        for (const rowKey of keys) {
          issues.push({
            code: "wire_conflict",
            severity: "error",
            message: "Wire assigned to multiple wearers in the same scene.",
            scene_id: scene.id,
            asset_id: assetId,
            row_key: rowKey,
          });
        }
      }
    }
    for (const [assetId, keys] of packOwners) {
      if (keys.length > 1) {
        for (const rowKey of keys) {
          issues.push({
            code: "pack_conflict",
            severity: "error",
            message: "Pack assigned to multiple wearers in the same scene.",
            scene_id: scene.id,
            asset_id: assetId,
            row_key: rowKey,
          });
        }
      }
    }
  }
  return issues;
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

/** Per scene: asset id → owning row_key (current sheet). */
function buildSceneAssetOwners(
  chart: LavChartResponse,
  sheet: SheetKind,
  wireMap: Map<string, number | null>,
  packMap: Map<string, number | null>,
) {
  const byScene = new Map<number, Map<number, string>>();
  for (const scene of chart.scenes) {
    const owners = new Map<number, string>();
    for (const row of chart.rows) {
      const assetId =
        sheet === "wires"
          ? wireMap.get(cellKey(row.row_key, scene.id))
          : packMap.get(cellKey(row.row_key, scene.id));
      if (assetId != null && !owners.has(assetId)) {
        owners.set(assetId, row.row_key);
      }
    }
    byScene.set(scene.id, owners);
  }
  return byScene;
}

export default function LavChartPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const confirm = useConfirm();
  const {
    access,
    loading: accessLoading,
    error: accessError,
    hasCapability,
  } = useProductionAccess();
  const canReadLavChart = hasCapability("lav_chart", "read");
  const canEditLavChart = ["create", "update", "delete"].some((action) =>
    hasCapability("lav_chart", action),
  );
  const toast = useToast();

  const [chart, setChart] = useState<LavChartResponse | null>(null);
  const [wireMap, setWireMap] = useState<Map<string, number | null>>(new Map());
  const [packMap, setPackMap] = useState<Map<string, number | null>>(new Map());
  const [lockedRows, setLockedRows] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<SheetKind>("wires");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [rowMenuPos, setRowMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rowMenuButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [fillDialog, setFillDialog] = useState<FillDialogState>(null);
  const [fillAssetId, setFillAssetId] = useState("");
  const [clearActDialog, setClearActDialog] = useState<{
    rowKey: string;
    label: string;
  } | null>(null);
  const [clearActNumber, setClearActNumber] = useState("");
  const [editKind, setEditKind] = useState<InventoryKind | null>(null);
  const [editingItem, setEditingItem] = useState<WireResponse | PackResponse | null>(null);

  function applyChart(data: LavChartResponse) {
    setChart(data);
    setWireMap(buildWireMap(data.wire_cells));
    setPackMap(buildPackMap(data.pack_cells));
    setLockedRows(new Set(data.locked_row_keys ?? []));
    setDirty(false);
  }

  async function loadChart() {
    setError(null);
    try {
      const data = await api.getLavChart(productionId);
      applyChart(data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load lav chart"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChart();
  }, [productionId]);

  function updateRowMenuPosition(rowKey: string) {
    const button = rowMenuButtonRefs.current.get(rowKey);
    if (!button) {
      setRowMenuPos(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    setRowMenuPos({ top: rect.bottom + 4, left: rect.left });
  }

  useLayoutEffect(() => {
    if (openRowMenu == null) {
      setRowMenuPos(null);
      return;
    }
    updateRowMenuPosition(openRowMenu);
  }, [openRowMenu]);

  useEffect(() => {
    if (openRowMenu == null) return;
    const activeRow = openRowMenu;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-lav-row-menu]")) return;
      setOpenRowMenu(null);
    }
    function onReposition() {
      updateRowMenuPosition(activeRow);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onReposition);
    // Capture scroll from the chart scroller and any ancestors.
    document.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("scroll", onReposition, true);
    };
  }, [openRowMenu]);

  const needSetByRow = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!chart) return map;
    for (const row of chart.rows) {
      map.set(row.row_key, new Set(row.need_scene_ids));
    }
    return map;
  }, [chart]);

  const actGroups = useMemo(
    () => (chart ? groupScenesByAct(chart.scenes) : []),
    [chart],
  );

  const rowLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    if (!chart) return map;
    for (const row of chart.rows) {
      map.set(row.row_key, row.label);
    }
    return map;
  }, [chart]);

  const sceneOwners = useMemo(() => {
    if (!chart) return new Map<number, Map<number, string>>();
    return buildSceneAssetOwners(chart, sheet, wireMap, packMap);
  }, [chart, sheet, wireMap, packMap]);

  function setWireCell(rowKey: string, sceneId: number, wireId: number | null) {
    if (lockedRows.has(rowKey)) return;
    setWireMap((prev) => {
      const next = new Map(prev);
      next.set(cellKey(rowKey, sceneId), wireId);
      return next;
    });
    setDirty(true);
  }

  function setPackCell(rowKey: string, sceneId: number, packId: number | null) {
    if (lockedRows.has(rowKey)) return;
    setPackMap((prev) => {
      const next = new Map(prev);
      next.set(cellKey(rowKey, sceneId), packId);
      return next;
    });
    setDirty(true);
  }

  function fillRowScenes(rowKey: string, sceneIds: number[], assetId: number | null) {
    if (lockedRows.has(rowKey)) return;
    if (sheet === "wires") {
      setWireMap((prev) => {
        const next = new Map(prev);
        for (const sceneId of sceneIds) {
          next.set(cellKey(rowKey, sceneId), assetId);
        }
        return next;
      });
    } else {
      setPackMap((prev) => {
        const next = new Map(prev);
        for (const sceneId of sceneIds) {
          next.set(cellKey(rowKey, sceneId), assetId);
        }
        return next;
      });
    }
    setDirty(true);
  }

  function toggleRowLock(rowKey: string) {
    setLockedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
    setDirty(true);
    setOpenRowMenu(null);
  }

  function serializeCells(): {
    wire_cells: LavWireCell[];
    pack_cells: LavPackCell[];
    locked_row_keys: string[];
  } {
    const wire_cells: LavWireCell[] = [];
    const pack_cells: LavPackCell[] = [];
    if (!chart) return { wire_cells, pack_cells, locked_row_keys: [...lockedRows] };
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
    return {
      wire_cells,
      pack_cells,
      locked_row_keys: [...lockedRows].sort(),
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = await api.saveLavChart(productionId, serializeCells());
      applyChart(data);
      toast.success("Lav chart saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save lav chart"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePropose() {
    const sheetLabel = sheet === "wires" ? "wire" : "pack";
    const ok = await confirm({
      title: `Overwrite ${sheetLabel} chart?`,
      description:
        `Propose clears every ${sheetLabel} assignment on this sheet (including locked rows) ` +
        "and replaces them with a fresh rule-based chart. The other sheet is not changed. " +
        "Use this once after inventory and cast are set, then tweak cells manually.",
      confirmLabel: "Overwrite & propose",
    });
    if (!ok) return;

    if (dirty) {
      const saveFirst = await confirm({
        title: "Save changes first?",
        description:
          "You have unsaved edits. Propose overwrites the saved chart for this sheet. Save now, then propose?",
        confirmLabel: "Save & propose",
      });
      if (!saveFirst) return;
      setSaving(true);
      try {
        const saved = await api.saveLavChart(productionId, serializeCells());
        applyChart(saved);
      } catch (err) {
        toast.error(formatApiError(err, "Failed to save lav chart"));
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    setProposing(true);
    try {
      const data = await api.proposeLavChart(productionId, [sheet], {
        preserve_filled_and_locked: false,
      });
      applyChart(data);
      toast.success(`${sheetLabel.charAt(0).toUpperCase()}${sheetLabel.slice(1)} chart replaced`);
    } catch (err) {
      toast.error(formatApiError(err, "Failed to propose lav chart"));
    } finally {
      setProposing(false);
    }
  }

  function openFillDialog(state: Exclude<FillDialogState, null>) {
    setOpenRowMenu(null);
    setFillAssetId("");
    setFillDialog(state);
  }

  function applyFillDialog() {
    if (!chart || !fillDialog || !fillAssetId) return;
    const assetId = Number(fillAssetId);
    const sceneIds =
      fillDialog.mode === "row"
        ? chart.scenes.map((s) => s.id)
        : chart.scenes.filter((s) => s.act_number === fillDialog.actNumber).map((s) => s.id);
    fillRowScenes(fillDialog.rowKey, sceneIds, assetId);
    setFillDialog(null);
  }

  function clearRow(rowKey: string) {
    if (!chart || lockedRows.has(rowKey)) return;
    setOpenRowMenu(null);
    fillRowScenes(
      rowKey,
      chart.scenes.map((s) => s.id),
      null,
    );
  }

  function openClearAct(rowKey: string, label: string) {
    setOpenRowMenu(null);
    const acts = chart ? uniqueActNumbers(chart.scenes) : [];
    setClearActNumber(acts[0] != null ? String(acts[0]) : "");
    setClearActDialog({ rowKey, label });
  }

  function applyClearAct() {
    if (!chart || !clearActDialog || !clearActNumber) return;
    const actNumber = Number(clearActNumber);
    const sceneIds = chart.scenes.filter((s) => s.act_number === actNumber).map((s) => s.id);
    fillRowScenes(clearActDialog.rowKey, sceneIds, null);
    setClearActDialog(null);
  }

  async function handleAddWire(identifier: string, notes: string | null): Promise<boolean> {
    try {
      const created = await api.createWire(productionId, { identifier, notes });
      setChart((prev) => {
        if (!prev) return prev;
        const item: LavChartCatalogItem = {
          id: created.id,
          identifier: created.identifier,
          notes: created.notes,
        };
        return {
          ...prev,
          wires: [...prev.wires, item].sort((a, b) =>
            a.identifier.localeCompare(b.identifier),
          ),
        };
      });
      toast.success("Wire added");
      return true;
    } catch (err) {
      toast.error(formatApiError(err, "Failed to add wire"));
      return false;
    }
  }

  async function handleAddPack(identifier: string, notes: string | null): Promise<boolean> {
    try {
      const created = await api.createPack(productionId, { identifier, notes });
      setChart((prev) => {
        if (!prev) return prev;
        const item: LavChartCatalogItem = {
          id: created.id,
          identifier: created.identifier,
          notes: created.notes,
        };
        return {
          ...prev,
          packs: [...prev.packs, item].sort((a, b) =>
            a.identifier.localeCompare(b.identifier),
          ),
        };
      });
      toast.success("Pack added");
      return true;
    } catch (err) {
      toast.error(formatApiError(err, "Failed to add pack"));
      return false;
    }
  }

  function openEditDialog(kind: InventoryKind, item: WireResponse | PackResponse) {
    setEditKind(kind);
    setEditingItem(item);
  }

  function closeEditDialog() {
    setEditKind(null);
    setEditingItem(null);
  }

  async function handleEditSave(identifier: string, notes: string | null): Promise<boolean> {
    if (!editingItem || !editKind) return false;

    setInventoryBusy(true);
    try {
      const body = { identifier, notes };
      const updated =
        editKind === "wire"
          ? await api.updateWire(productionId, editingItem.id, body)
          : await api.updatePack(productionId, editingItem.id, body);
      const item: LavChartCatalogItem = {
        id: updated.id,
        identifier: updated.identifier,
        notes: updated.notes,
      };
      setChart((prev) => {
        if (!prev) return prev;
        if (editKind === "wire") {
          return {
            ...prev,
            wires: prev.wires
              .map((w) => (w.id === item.id ? item : w))
              .sort((a, b) => a.identifier.localeCompare(b.identifier)),
          };
        }
        return {
          ...prev,
          packs: prev.packs
            .map((p) => (p.id === item.id ? item : p))
            .sort((a, b) => a.identifier.localeCompare(b.identifier)),
        };
      });
      toast.success(editKind === "wire" ? "Wire updated" : "Pack updated");
      closeEditDialog();
      return true;
    } catch (err) {
      toast.error(
        formatApiError(err, editKind === "wire" ? "Failed to update wire" : "Failed to update pack"),
      );
      return false;
    } finally {
      setInventoryBusy(false);
    }
  }

  async function handleDelete(kind: InventoryKind, item: WireResponse | PackResponse) {
    const label = kind === "wire" ? "wire" : "pack";
    const ok = await confirm({
      title: `Delete this ${label}?`,
      description: `Clears this ${label} from any chart cells that use it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setInventoryBusy(true);
    try {
      if (kind === "wire") {
        await api.deleteWire(productionId, item.id);
        toast.success("Wire deleted");
      } else {
        await api.deletePack(productionId, item.id);
        toast.success("Pack deleted");
      }
      await loadChart();
    } catch (err) {
      toast.error(
        formatApiError(err, kind === "wire" ? "Failed to delete wire" : "Failed to delete pack"),
      );
    } finally {
      setInventoryBusy(false);
    }
  }

  if (accessLoading || loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (accessError || !access || !canReadLavChart) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          {accessError ?? "You do not have access to the lav chart."}
        </p>
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

  const errorIssues = detectAssignmentConflicts(chart, wireMap, packMap);
  const warningIssues = chart.issues.filter((i) => i.severity === "warning");
  const issues = [...errorIssues, ...warningIssues];
  const catalog = sheet === "wires" ? chart.wires : chart.packs;
  const assetNoun = sheet === "wires" ? "wire" : "pack";
  const actNumbers = uniqueActNumbers(chart.scenes);

  return (
    <div className="space-y-4 pb-8">
      <div className="lav-print-hide space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lav chart</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Assign wires and packs by scene. Run Propose once for a full-sheet starting chart, then
              tweak with fill-row and cell edits. Lock rows to prevent accidental edits (Propose still
              overwrites locked rows).
            </p>
          </div>
          <Link
            to={`/productions/${productionId}/reports`}
            className="inline-flex items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
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
                  {[...new Map(errorIssues.map((i) => [i.message + i.scene_id + i.asset_id, i])).values()]
                    .slice(0, 6)
                    .map((issue, index) => (
                      <li key={`e-${index}`}>{issue.message}</li>
                    ))}
                </ul>
              </div>
            )}
            {warningIssues.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                <p className="font-medium text-warning-foreground">
                  {warningIssues.length} warning{warningIssues.length === 1 ? "" : "s"} — mid-act
                  or uncovered need scenes may need manual booth changes
                </p>
                <ul className="mt-1 list-disc pl-5 text-warning-foreground/90">
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

        {canEditLavChart && (
          <details
            className="rounded-md border border-border bg-muted/30 px-3 py-2"
            open={inventoryOpen}
            onToggle={(e) => setInventoryOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium">
              Manage wires &amp; packs ({chart.wires.length} wires, {chart.packs.length} packs)
            </summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <InventoryColumn
                title="Wires"
                emptyLabel="No wires yet."
                items={chart.wires}
                identifierPlaceholder="Wire 1"
                addLabel="Add wire"
                busy={inventoryBusy}
                onAdd={handleAddWire}
                onEdit={(item) => openEditDialog("wire", item)}
                onDelete={(item) => void handleDelete("wire", item)}
              />
              <InventoryColumn
                title="Packs"
                emptyLabel="No packs yet."
                items={chart.packs}
                identifierPlaceholder="Pack 1"
                addLabel="Add pack"
                busy={inventoryBusy}
                onAdd={handleAddPack}
                onEdit={(item) => openEditDialog("pack", item)}
                onDelete={(item) => void handleDelete("pack", item)}
              />
            </div>
          </details>
        )}
      </div>

      <div>
        <div className="lav-chart-toolbar lav-print-hide mb-0 flex flex-wrap items-center justify-between gap-2 rounded-t-md border border-b-0 border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="text-sm font-medium text-muted-foreground">
              {sheet === "wires" ? "Wire chart" : "Pack chart"}
            </span>
            {(errorIssues.length > 0 || warningIssues.length > 0) && (
              <span className="text-xs text-muted-foreground">
                {errorIssues.length > 0 && (
                  <span className="text-destructive">{errorIssues.length} conflicts</span>
                )}
                {errorIssues.length > 0 && warningIssues.length > 0 && " · "}
                {warningIssues.length > 0 && (
                  <span className="text-warning">
                    {warningIssues.length} warnings
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 size-4" />
              Print
            </Button>
            {canEditLavChart && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePropose()}
                  disabled={proposing || saving}
                >
                  {proposing ? "Proposing…" : `Propose ${assetNoun}s`}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving || !dirty || errorIssues.length > 0}
                  title={
                    errorIssues.length > 0
                      ? "Resolve wire/pack conflicts before saving"
                      : undefined
                  }
                >
                  {saving ? "Saving…" : dirty ? "Save" : "Saved"}
                </Button>
              </>
            )}
          </div>
        </div>

        <h2 className="lav-print-only mb-3 hidden text-lg font-medium">
          {sheet === "wires" ? "Wire chart" : "Pack chart"}
        </h2>

        {chart.rows.length === 0 ? (
          <p className="rounded-b-md border border-border px-3 py-4 text-sm text-muted-foreground">
            No speaking or singing characters yet. Import a script and cast actors, then propose.
          </p>
        ) : chart.scenes.length === 0 ? (
          <p className="rounded-b-md border border-border px-3 py-4 text-sm text-muted-foreground">
            No scenes in this production yet.
          </p>
        ) : (
          <div className="lav-chart-scroll rounded-b-md border border-border">
            <Table
              storageKey="lav-chart"
              className="lav-chart-table min-w-full border-collapse"
            >
              <TableHeader>
                {actGroups.length > 1 && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="lav-chart-sticky sticky left-0 z-10 border-r border-border bg-muted/40 px-3 py-1" />
                    {actGroups.map((group) => (
                      <TableHead
                        key={group.actNumber}
                        colSpan={group.scenes.length}
                        className="text-center text-xs font-medium text-muted-foreground"
                      >
                        Act {group.actNumber}
                        {group.actTitle ? ` · ${group.actTitle}` : ""}
                      </TableHead>
                    ))}
                  </TableRow>
                )}
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="lav-chart-sticky sticky left-0 z-10 border-r border-border bg-muted/50 px-3 py-2 text-left">
                    Actor / characters
                  </TableHead>
                  {chart.scenes.map((scene) => (
                    <TableHead
                      key={scene.id}
                      className="text-center whitespace-nowrap"
                      title={scene.scene_title ?? undefined}
                    >
                      {scene.act_number}.{scene.scene_number}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {chart.rows.map((row) => {
                  const needs = needSetByRow.get(row.row_key) ?? new Set();
                  const locked = lockedRows.has(row.row_key);
                  return (
                    <TableRow key={row.row_key} className="align-middle">
                      <TableHead className="lav-chart-sticky sticky left-0 z-10 border-r border-border bg-background px-2 py-2 text-left font-normal">
                        <div className="flex min-w-[10rem] items-start gap-1">
                          {canEditLavChart && <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="lav-print-hide mt-0.5 text-muted-foreground hover:text-foreground"
                            title={locked ? "Unlock row" : "Lock row"}
                            aria-label={locked ? `Unlock ${row.label}` : `Lock ${row.label}`}
                            onClick={() => toggleRowLock(row.row_key)}
                          >
                            {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                          </Button>}
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">
                              {row.label}
                              {locked && (
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  (locked)
                                </span>
                              )}
                            </span>
                          </div>
                          {canEditLavChart && <div className="lav-print-hide" data-lav-row-menu>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={locked}
                              aria-label={`Row actions for ${row.label}`}
                              title={locked ? "Unlock row to edit" : "Row actions"}
                              ref={(el) => {
                                if (el) rowMenuButtonRefs.current.set(row.row_key, el);
                                else rowMenuButtonRefs.current.delete(row.row_key);
                              }}
                              onClick={() =>
                                setOpenRowMenu((prev) =>
                                  prev === row.row_key ? null : row.row_key,
                                )
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </div>}
                        </div>
                      </TableHead>
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
                        const owners = sceneOwners.get(scene.id) ?? new Map();

                        return (
                          <TableCell
                            key={scene.id}
                            className={[
                              "px-1 py-1 text-center",
                              isNeed ? "bg-highlight-muted/40" : "",
                              conflict || missingNeed ? "bg-warning/15" : "",
                              locked ? "opacity-80" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Select
                              value={value != null ? String(value) : NO_ASSET_VALUE}
                              disabled={locked || !canEditLavChart}
                              onValueChange={(raw) => {
                                const next = raw === NO_ASSET_VALUE ? null : Number(raw);
                                if (sheet === "wires") {
                                  setWireCell(row.row_key, scene.id, next);
                                } else {
                                  setPackCell(row.row_key, scene.id, next);
                                }
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                className="lav-print-hide h-7 max-w-[7.5rem] px-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label={`${row.label} ${sheet} for scene ${scene.act_number}.${scene.scene_number}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_ASSET_VALUE}>—</SelectItem>
                                {catalog.map((item) => {
                                  const ownerKey = owners.get(item.id);
                                  const takenByOther =
                                    ownerKey != null && ownerKey !== row.row_key;
                                  const ownerLabel = ownerKey
                                    ? (rowLabelByKey.get(ownerKey) ?? ownerKey)
                                    : "";
                                  return (
                                    <SelectItem
                                      key={item.id}
                                      value={String(item.id)}
                                      disabled={takenByOther}
                                    >
                                      {takenByOther
                                        ? `${item.identifier} (in use by ${ownerLabel})`
                                        : item.identifier}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <span className="lav-print-only hidden text-xs">
                              {value == null
                                ? "—"
                                : catalog.find((item) => item.id === value)?.identifier ?? value}
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {catalog.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Add {sheet === "wires" ? "wires" : "packs"} in Manage wires &amp; packs, then run Propose.
          </p>
        )}
      </div>

      {openRowMenu != null &&
        rowMenuPos != null &&
        !lockedRows.has(openRowMenu) &&
        createPortal(
          <div
            data-lav-row-menu
            className="fixed z-50 w-44 rounded-md border border-border bg-background py-1"
            style={{ top: rowMenuPos.top, left: rowMenuPos.left }}
          >
            <RowMenuButton
              onClick={() => {
                const row = chart.rows.find((r) => r.row_key === openRowMenu);
                if (!row) return;
                openFillDialog({
                  mode: "row",
                  rowKey: row.row_key,
                  label: row.label,
                });
              }}
            >
              Fill all scenes…
            </RowMenuButton>
            {actNumbers.map((actNumber) => (
              <RowMenuButton
                key={actNumber}
                onClick={() => {
                  const row = chart.rows.find((r) => r.row_key === openRowMenu);
                  if (!row) return;
                  openFillDialog({
                    mode: "act",
                    rowKey: row.row_key,
                    label: row.label,
                    actNumber,
                  });
                }}
              >
                Fill Act {actNumber}…
              </RowMenuButton>
            ))}
            <RowMenuButton onClick={() => clearRow(openRowMenu)}>Clear all scenes</RowMenuButton>
            {actNumbers.length > 0 && (
              <RowMenuButton
                onClick={() => {
                  const row = chart.rows.find((r) => r.row_key === openRowMenu);
                  if (!row) return;
                  openClearAct(row.row_key, row.label);
                }}
              >
                Clear act…
              </RowMenuButton>
            )}
          </div>,
          document.body,
        )}

      <Dialog
        open={fillDialog != null}
        onOpenChange={(open) => {
          if (!open) setFillDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fillDialog?.mode === "act"
                ? `Fill Act ${fillDialog.actNumber}`
                : "Fill all scenes"}
            </DialogTitle>
            <DialogDescription>
              Assign one {assetNoun} to {fillDialog?.label ?? "this row"}
              {fillDialog?.mode === "act" ? ` for Act ${fillDialog.actNumber}` : " for every scene"}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="mb-1" htmlFor="lav-fill-asset">
              {sheet === "wires" ? "Wire" : "Pack"}
            </Label>
            <Select value={fillAssetId} onValueChange={setFillAssetId}>
              <SelectTrigger id="lav-fill-asset" className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.identifier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFillDialog(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={!fillAssetId} onClick={applyFillDialog}>
              Fill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={clearActDialog != null}
        onOpenChange={(open) => {
          if (!open) setClearActDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear act</DialogTitle>
            <DialogDescription>
              Clear {assetNoun} assignments for {clearActDialog?.label ?? "this row"} in one act.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="mb-1" htmlFor="lav-clear-act">
              Act
            </Label>
            <Select value={clearActNumber} onValueChange={setClearActNumber}>
              <SelectTrigger id="lav-clear-act" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actNumbers.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Act {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClearActDialog(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={!clearActNumber} onClick={applyClearAct}>
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditInventoryDialog
        kind={editKind}
        item={editingItem}
        busy={inventoryBusy}
        onClose={closeEditDialog}
        onSave={handleEditSave}
      />
    </div>
  );
}

function RowMenuButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-left font-normal"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function EditInventoryDialog({
  kind,
  item,
  busy,
  onClose,
  onSave,
}: {
  kind: InventoryKind | null;
  item: WireResponse | PackResponse | null;
  busy: boolean;
  onClose: () => void;
  onSave: (identifier: string, notes: string | null) => Promise<boolean>;
}) {
  const open = kind != null && item != null;
  const [identifier, setIdentifier] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (item && open) {
      setIdentifier(item.identifier);
      setNotes(item.notes ?? "");
    }
  }, [item, open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!identifier.trim()) return;
    await onSave(identifier.trim(), notes.trim() || null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{kind === "wire" ? "Edit wire" : "Edit pack"}</DialogTitle>
            <DialogDescription>
              Update the identifier and optional notes for this inventory item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Identifier"
              autoFocus
            />
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !identifier.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InventoryColumn({
  title,
  emptyLabel,
  items,
  identifierPlaceholder,
  addLabel,
  busy,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  emptyLabel: string;
  items: Array<WireResponse | PackResponse | LavChartCatalogItem>;
  identifierPlaceholder: string;
  addLabel: string;
  busy: boolean;
  onAdd: (identifier: string, notes: string | null) => Promise<boolean>;
  onEdit: (item: WireResponse | PackResponse) => void;
  onDelete: (item: WireResponse | PackResponse) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!identifier.trim()) return;
    const ok = await onAdd(identifier.trim(), notes.trim() || null);
    if (ok) {
      setIdentifier("");
      setNotes("");
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="rounded-lg border border-border bg-background">
          <Table storageKey="lav-inventory">
            <TableHeader>
              <TableRow>
                <TableHead>Identifier</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.identifier}</TableCell>
                  <TableCell className="text-muted-foreground">{item.notes ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(item as WireResponse | PackResponse)}
                        aria-label={`Edit ${item.identifier}`}
                        title="Edit"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={() => onDelete(item as WireResponse | PackResponse)}
                        aria-label={`Delete ${item.identifier}`}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={identifierPlaceholder}
          aria-label={`${title} identifier`}
        />
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          aria-label={`${title} notes`}
        />
        <Button type="submit" variant="outline" size="sm" disabled={!identifier.trim()}>
          {addLabel}
        </Button>
      </form>
    </div>
  );
}
