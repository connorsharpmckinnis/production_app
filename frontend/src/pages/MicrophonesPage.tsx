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
import type { MicrophoneResponse } from "@/lib/types";

export default function MicrophonesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [microphones, setMicrophones] = useState<MicrophoneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMic, setEditingMic] = useState<MicrophoneResponse | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const data = await api.listMicrophones(productionId);
      setMicrophones(data);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load microphones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  function openCreateDialog() {
    setEditingMic(null);
    setIdentifier("");
    setNotes("");
    setDialogOpen(true);
  }

  function openEditDialog(mic: MicrophoneResponse) {
    setEditingMic(mic);
    setIdentifier(mic.identifier);
    setNotes(mic.notes ?? "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingMic(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!identifier.trim()) return;

    setSaving(true);
    try {
      const payload = {
        identifier: identifier.trim(),
        notes: notes.trim() || null,
      };
      if (editingMic) {
        await api.updateMicrophone(productionId, editingMic.id, payload);
        toast.success("Microphone updated");
      } else {
        await api.createMicrophone(productionId, payload);
        toast.success("Microphone created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? String(err.detail)
          : editingMic
            ? "Failed to update microphone"
            : "Failed to create microphone",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(micId: number) {
    const ok = await confirm({
      title: "Delete this microphone?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api.deleteMicrophone(productionId, micId);
      toast.success("Microphone deleted");
      await loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to delete microphone");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading microphones…</p>;
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
        <h1 className="text-2xl font-semibold tracking-tight">Microphones</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Manage the microphone catalog and attach mics to moments from the timeline."
            : "Microphones in this production."}
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
            Add microphone
          </Button>
          <CatalogCsvImport
            productionId={productionId}
            kind="microphones"
            onImported={loadData}
          />
        </div>
      )}

      {microphones.length === 0 ? (
        <EmptyState
          title="No microphones yet"
          description="Add microphones to the catalog, then attach them to moments from the timeline."
          actionLabel={canManagePreparation ? "Add microphone" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Identifier</th>
                <th className="px-4 py-3 text-left font-medium">Notes</th>
                {canManagePreparation && (
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {microphones.map((mic) => (
                <tr key={mic.id}>
                  <td className="px-4 py-3 font-medium">{mic.identifier}</td>
                  <td className="px-4 py-3 text-muted-foreground">{mic.notes ?? "—"}</td>
                  {canManagePreparation && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(mic)}
                          aria-label={`Edit ${mic.identifier}`}
                          title="Edit"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          onClick={() => void handleDelete(mic.id)}
                          aria-label={`Delete ${mic.identifier}`}
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
          if (!open) setEditingMic(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editingMic ? "Edit microphone" : "Add microphone"}</DialogTitle>
              <DialogDescription>
                {editingMic
                  ? "Update this microphone in the catalog."
                  : "Add a new microphone to the catalog."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Identifier (e.g. Lav 1)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
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
              <Button type="submit" disabled={saving || !identifier.trim()}>
                {editingMic ? "Save" : "Add microphone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
