import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
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
import type { SetPieceResponse } from "@/lib/types";

export default function SetPiecesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [setPieces, setSetPieces] = useState<SetPieceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState<SetPieceResponse | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const data = await api.listSetPieces(productionId);
      setSetPieces(data);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load set pieces");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  function openCreateDialog() {
    setEditingPiece(null);
    setName("");
    setMobile(false);
    setDescription("");
    setDialogOpen(true);
  }

  function openEditDialog(piece: SetPieceResponse) {
    setEditingPiece(piece);
    setName(piece.name);
    setMobile(piece.mobile);
    setDescription(piece.description ?? "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingPiece(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editingPiece) {
        await api.updateSetPiece(productionId, editingPiece.id, {
          name: name.trim(),
          mobile,
          description: description.trim() || null,
        });
        toast.success("Set piece updated");
      } else {
        await api.createSetPiece(productionId, {
          name: name.trim(),
          mobile,
          description: description.trim() || null,
        });
        toast.success("Set piece created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? String(err.detail)
          : editingPiece
            ? "Failed to update set piece"
            : "Failed to create set piece",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pieceId: number) {
    const ok = await confirm({
      title: "Delete this set piece?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api.deleteSetPiece(productionId, pieceId);
      toast.success("Set piece deleted");
      await loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to delete set piece");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading set pieces…</p>;
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
        <h1 className="text-2xl font-semibold tracking-tight">Set Pieces</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Manage the set piece catalog and attach pieces to moments from the timeline."
            : "Set pieces in this production."}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canManagePreparation && (
        <Button type="button" onClick={openCreateDialog}>
          Add set piece
        </Button>
      )}

      {setPieces.length === 0 ? (
        <EmptyState
          title="No set pieces yet"
          description="Add set pieces to the catalog, then attach them to moments from the timeline."
          actionLabel={canManagePreparation ? "Add set piece" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Mobile</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                {canManagePreparation && (
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {setPieces.map((piece) => (
                <tr key={piece.id}>
                  <td className="px-4 py-3 font-medium">{piece.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {piece.mobile ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {piece.description ?? "—"}
                  </td>
                  {canManagePreparation && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(piece)}
                          aria-label={`Edit ${piece.name}`}
                          title="Edit"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          onClick={() => void handleDelete(piece.id)}
                          aria-label={`Delete ${piece.name}`}
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
          if (!open) setEditingPiece(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editingPiece ? "Edit set piece" : "Add set piece"}</DialogTitle>
              <DialogDescription>
                {editingPiece
                  ? "Update this set piece in the catalog."
                  : "Add a new set piece to the catalog."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Set piece name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mobile}
                  onChange={(e) => setMobile(e.target.checked)}
                />
                Mobile (can be moved between moments)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {editingPiece ? "Save" : "Add set piece"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
