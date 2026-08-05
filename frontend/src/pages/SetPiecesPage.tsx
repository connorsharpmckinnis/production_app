import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import CatalogCsvImport from "@/components/CatalogCsvImport";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
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
      setError(formatApiError(err, "Failed to load set pieces"));
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
        formatApiError(
          err,
          editingPiece ? "Failed to update set piece" : "Failed to create set piece",
        ),
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
      toast.error(formatApiError(err, "Failed to delete set piece"));
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
        <h1 className="text-2xl font-semibold tracking-tight">Set Pieces</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Manage the set piece catalog and attach pieces to moments from the timeline."
            : "Set pieces in this production."}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {canManagePreparation && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={openCreateDialog}>
            Add set piece
          </Button>
          <CatalogCsvImport
            productionId={productionId}
            kind="set-pieces"
            onImported={loadData}
          />
        </div>
      )}

      {setPieces.length === 0 ? (
        <EmptyState
          title="No set pieces yet"
          description="Add set pieces to the catalog, then attach them to moments from the timeline."
          actionLabel={canManagePreparation ? "Add set piece" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table storageKey="set-pieces">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Description</TableHead>
                {canManagePreparation && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {setPieces.map((piece) => (
                <TableRow key={piece.id}>
                  <TableCell className="font-medium">{piece.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {piece.mobile ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {piece.description ?? "—"}
                  </TableCell>
                  {canManagePreparation && (
                    <TableCell>
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
              <div className="space-y-2">
                <Label htmlFor="set-piece-name">Name</Label>
                <Input
                  id="set-piece-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Set piece name"
                  autoFocus
                />
              </div>
              <Label className="font-normal">
                <Checkbox
                  checked={mobile}
                  onCheckedChange={(v) => setMobile(v === true)}
                />
                Mobile (can be moved between moments)
              </Label>
              <div className="space-y-2">
                <Label htmlFor="set-piece-description">Description</Label>
                <Textarea
                  id="set-piece-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                {editingPiece ? "Save" : "Add set piece"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
