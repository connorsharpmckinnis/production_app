import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type {
  LocationResponse,
  MyCallResponse,
  RehearsalKind,
  RehearsalSummaryResponse,
} from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  formatTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/utils";

const NO_LOCATION = "__none__";

const ACTOR_PUBLISHED_STATUSES = new Set(["published", "in_progress", "completed"]);

function isPublishedStatus(status: string): boolean {
  return ACTOR_PUBLISHED_STATUSES.has(status);
}

function statusBadgeVariant(
  status: string,
): "outline" | "secondary" | "info" | "warning" | "success" | "destructive" {
  switch (status) {
    case "planned":
      return "secondary";
    case "published":
      return "info";
    case "in_progress":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function kindLabel(kind: string): string {
  return kind === "all_call" ? "All call" : "Called";
}

function defaultEndsAt(startsLocal: string): string {
  if (!startsLocal) return "";
  const start = new Date(startsLocal);
  if (Number.isNaN(start.getTime())) return "";
  start.setHours(start.getHours() + 3);
  return toDatetimeLocalValue(start.toISOString());
}

export default function RehearsalsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [rehearsals, setRehearsals] = useState<RehearsalSummaryResponse[]>([]);
  const [myCalls, setMyCalls] = useState<MyCallResponse[]>([]);
  const [locations, setLocations] = useState<LocationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RehearsalSummaryResponse | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [kind, setKind] = useState<RehearsalKind>("called");
  const [title, setTitle] = useState("");
  const [locationId, setLocationId] = useState(NO_LOCATION);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const [rehearsalData, myCallData, locationData] = await Promise.all([
        api.listRehearsals(productionId),
        api.listMyCalls(productionId),
        api.listLocations(productionId),
      ]);
      setRehearsals(rehearsalData);
      setMyCalls(myCallData);
      setLocations(locationData);
    } catch (err) {
      setError(formatApiError(err, "Failed to load rehearsals"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  const sortedRehearsals = useMemo(
    () =>
      [...rehearsals].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    [rehearsals],
  );

  function openCreateDialog() {
    setEditing(null);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const startLocal = toDatetimeLocalValue(now.toISOString());
    setStartsAt(startLocal);
    setEndsAt(defaultEndsAt(startLocal));
    setKind("called");
    setTitle("");
    setLocationId(NO_LOCATION);
    setDialogOpen(true);
  }

  function openEditDialog(rehearsal: RehearsalSummaryResponse) {
    setEditing(rehearsal);
    setStartsAt(toDatetimeLocalValue(rehearsal.starts_at));
    setEndsAt(toDatetimeLocalValue(rehearsal.ends_at));
    setKind((rehearsal.kind as RehearsalKind) || "called");
    setTitle(rehearsal.title ?? "");
    setLocationId(
      rehearsal.location_id != null ? String(rehearsal.location_id) : NO_LOCATION,
    );
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!startsAt || !endsAt) return;

    setSaving(true);
    try {
      const body = {
        starts_at: fromDatetimeLocalValue(startsAt),
        ends_at: fromDatetimeLocalValue(endsAt),
        kind,
        title: title.trim() || null,
        location_id: locationId === NO_LOCATION ? null : Number(locationId),
      };
      if (editing) {
        await api.updateRehearsal(productionId, editing.id, body);
        toast.success("Rehearsal updated");
      } else {
        await api.createRehearsal(productionId, body);
        toast.success("Rehearsal created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        formatApiError(
          err,
          editing ? "Failed to update rehearsal" : "Failed to create rehearsal",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rehearsal: RehearsalSummaryResponse) {
    const ok = await confirm({
      title: "Delete this rehearsal?",
      description: `${formatDateTime(rehearsal.starts_at)} will be removed.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteRehearsal(productionId, rehearsal.id);
      toast.success("Rehearsal deleted");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete rehearsal"));
    }
  }

  if (loading) {
    return <CatalogPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/productions/${productionId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Rehearsals</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Schedule rehearsal slots, plan calls, and publish call sheets."
            : "See upcoming rehearsals and when you are called."}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!canManagePreparation && sortedRehearsals.some((r) => !isPublishedStatus(r.status)) && (
        <Alert>
          <AlertDescription>
            Rehearsals marked as draft are on the calendar but your call times are not
            official until the director publishes the plan.
          </AlertDescription>
        </Alert>
      )}

      {myCalls.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">My calls</h2>
          <ul className="space-y-2">
            {myCalls.map((call) => (
              <li
                key={call.rehearsal_id}
                className="rounded-lg border border-border px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/productions/${productionId}/rehearsals/${call.rehearsal_id}`}
                      className="font-medium hover:underline"
                    >
                      {call.title?.trim() || formatDate(call.starts_at)}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(call.starts_at)} – {formatTime(call.ends_at)}
                      {call.location_name ? ` · ${call.location_name}` : ""}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(call.status)}>
                    {statusLabel(call.status)}
                  </Badge>
                </div>
                {call.blocks.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {call.blocks.map((block) => (
                      <li key={block.block_id}>
                        {formatTime(block.starts_at)}–{formatTime(block.ends_at)}
                        {block.location_name ? ` · ${block.location_name}` : ""}
                        {block.label ? ` · ${block.label}` : ""}
                        {block.scenes.length > 0
                          ? ` · ${block.scenes
                              .map((scene) =>
                                scene.act_number != null
                                  ? `${scene.act_number}.${scene.number}`
                                  : `Sc ${scene.number}`,
                              )
                              .join(", ")}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManagePreparation && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={openCreateDialog}>
            Add rehearsal
          </Button>
        </div>
      )}

      {sortedRehearsals.length === 0 ? (
        <EmptyState
          title="No rehearsals yet"
          description={
            canManagePreparation
              ? "Add reserved nights or ad-hoc rehearsals for this production."
              : "Rehearsals will appear here when they are scheduled."
          }
          actionLabel={canManagePreparation ? "Add rehearsal" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table storageKey="rehearsals">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                {canManagePreparation && <TableHead>Blocks</TableHead>}
                {canManagePreparation && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRehearsals.map((rehearsal) => {
                const draftForActor =
                  !canManagePreparation && !isPublishedStatus(rehearsal.status);
                return (
                  <TableRow
                    key={rehearsal.id}
                    className={draftForActor ? "bg-muted/30" : undefined}
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      <Link
                        to={`/productions/${productionId}/rehearsals/${rehearsal.id}`}
                        className="hover:underline"
                      >
                        {formatDateTime(rehearsal.starts_at)}
                      </Link>
                      <div className="text-xs font-normal text-muted-foreground">
                        until {formatTime(rehearsal.ends_at)}
                      </div>
                      {draftForActor && (
                        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Draft — not published yet
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {rehearsal.title ? (
                        <Link
                          to={`/productions/${productionId}/rehearsals/${rehearsal.id}`}
                          className="hover:underline"
                        >
                          {rehearsal.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{kindLabel(rehearsal.kind)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {rehearsal.location_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(rehearsal.status)}>
                        {statusLabel(rehearsal.status)}
                      </Badge>
                    </TableCell>
                    {canManagePreparation && (
                      <TableCell className="text-muted-foreground">
                        {rehearsal.block_count}
                      </TableCell>
                    )}
                    {canManagePreparation && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditDialog(rehearsal)}
                            aria-label="Edit rehearsal"
                            title="Edit"
                            disabled={rehearsal.status === "completed"}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => void handleDelete(rehearsal)}
                            aria-label="Delete rehearsal"
                            title="Delete"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit rehearsal" : "Add rehearsal"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update this rehearsal slot."
                  : "Reserve a night or create an ad-hoc rehearsal."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rehearsal-starts">Starts</Label>
                  <Input
                    id="rehearsal-starts"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStartsAt(next);
                      if (!editing || !endsAt) {
                        setEndsAt(defaultEndsAt(next));
                      }
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rehearsal-ends">Ends</Label>
                  <Input
                    id="rehearsal-ends"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rehearsal-kind">Kind</Label>
                <Select
                  value={kind}
                  onValueChange={(value) => setKind(value as RehearsalKind)}
                >
                  <SelectTrigger id="rehearsal-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="called">Called</SelectItem>
                    <SelectItem value="all_call">All call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rehearsal-title">Title</Label>
                <Input
                  id="rehearsal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Optional (e.g. Music night)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rehearsal-location">Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger id="rehearsal-location" className="w-full">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LOCATION}>No location</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={String(location.id)}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !startsAt || !endsAt}>
                {editing ? "Save" : "Add rehearsal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
