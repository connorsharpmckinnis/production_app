import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import CatalogCsvImport from "@/components/CatalogCsvImport";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { PropResponse } from "@/lib/types";

export default function PropsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { hasCapability } = useProductionAccess();
  const canManagePreparation = ["create", "update", "delete"].some((action) =>
    hasCapability("props", action),
  );
  const confirm = useConfirm();
  const toast = useToast();

  const [props, setProps] = useState<PropResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<PropResponse | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const propData = await api.listProps(productionId);
      setProps(propData);
    } catch (err) {
      setError(formatApiError(err, "Failed to load props"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  function openCreateDialog() {
    setEditingProp(null);
    setName("");
    setDescription("");
    setNotes("");
    setDialogOpen(true);
  }

  function openEditDialog(prop: PropResponse) {
    setEditingProp(prop);
    setName(prop.name);
    setDescription(prop.description ?? "");
    setNotes(prop.notes ?? "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingProp(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editingProp) {
        await api.updateProp(productionId, editingProp.id, {
          name: name.trim(),
          description: description.trim() || null,
          notes: notes.trim() || null,
        });
        toast.success("Prop updated");
      } else {
        await api.createProp(productionId, {
          name: name.trim(),
          description: description.trim() || null,
          notes: notes.trim() || null,
        });
        toast.success("Prop created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        formatApiError(
          err,
          editingProp ? "Failed to update prop" : "Failed to create prop",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(propId: number) {
    const ok = await confirm({
      title: "Delete this prop?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api.deleteProp(productionId, propId);
      toast.success("Prop deleted");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete prop"));
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-semibold tracking-tight">Props</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {canManagePreparation && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={openCreateDialog}>
            Add prop
          </Button>
          <CatalogCsvImport
            productionId={productionId}
            kind="props"
            onImported={loadData}
          />
        </div>
      )}

      {props.length === 0 ? (
        <EmptyState
          title="No props yet"
          description="Add props to the catalog, then attach them to moments from the timeline."
          actionLabel={canManagePreparation ? "Add prop" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table storageKey="props">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Notes</TableHead>
                {canManagePreparation && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.map((prop) => (
                <TableRow key={prop.id}>
                  <TableCell className="font-medium">{prop.name}</TableCell>
                  <TableCell className="text-muted-foreground">{prop.description ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{prop.notes ?? "—"}</TableCell>
                  {canManagePreparation && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(prop)}
                          aria-label={`Edit ${prop.name}`}
                          title="Edit"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          onClick={() => void handleDelete(prop.id)}
                          aria-label={`Delete ${prop.name}`}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingProp(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editingProp ? "Edit prop" : "Add prop"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="prop-name">Name</Label>
                <Input
                  id="prop-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Prop name"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prop-description">Description</Label>
                <Input
                  id="prop-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prop-notes">Notes</Label>
                <Textarea
                  id="prop-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {editingProp ? "Save" : "Add prop"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
