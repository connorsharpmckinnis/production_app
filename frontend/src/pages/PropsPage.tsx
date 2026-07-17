import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import CatalogCsvImport from "@/components/CatalogCsvImport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import type { PropResponse } from "@/lib/types";

export default function PropsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();
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
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load props");
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
        err instanceof ApiError
          ? String(err.detail)
          : editingProp
            ? "Failed to update prop"
            : "Failed to create prop",
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
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to delete prop");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading props…</p>;
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
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Manage the prop catalog and attach props to moments from the timeline."
            : "Props in this production."}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Notes</th>
                {canManagePreparation && (
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {props.map((prop) => (
                <tr key={prop.id}>
                  <td className="px-4 py-3 font-medium">{prop.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{prop.description ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{prop.notes ?? "—"}</td>
                  {canManagePreparation && (
                    <td className="px-4 py-3">
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
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
              <DialogDescription>
                {editingProp
                  ? "Update this prop in the catalog."
                  : "Add a new prop to the catalog."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prop name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
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
