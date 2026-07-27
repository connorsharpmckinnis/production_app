import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
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
import { api, formatApiError } from "@/lib/api";
import type { CostumeResponse } from "@/lib/types";
import { sortByName } from "@/lib/utils";

export default function CostumesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const [searchParams] = useSearchParams();
  const { canManagePreparation } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [characters, setCharacters] = useState<
    Awaited<ReturnType<typeof api.listCharacters>>
  >([]);
  const [costumes, setCostumes] = useState<CostumeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCostume, setEditingCostume] = useState<CostumeResponse | null>(null);
  const [characterId, setCharacterId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const [characterData, costumeData] = await Promise.all([
        api.listCharacters(productionId),
        api.listCostumes(productionId),
      ]);
      setCharacters(sortByName(characterData));
      setCostumes(costumeData);
    } catch (err) {
      setError(formatApiError(err, "Failed to load costumes"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  function resolvePrefillCharacterId(): string {
    const param = searchParams.get("characterId");
    if (!param) return "";
    const parsed = Number(param);
    if (!Number.isFinite(parsed)) return "";
    return characters.some((character) => character.id === parsed) ? String(parsed) : "";
  }

  function openCreateDialog() {
    setEditingCostume(null);
    setCharacterId(resolvePrefillCharacterId());
    setName("");
    setDescription("");
    setDialogOpen(true);
  }

  function openEditDialog(costume: CostumeResponse) {
    setEditingCostume(costume);
    setCharacterId(String(costume.character_id));
    setName(costume.name);
    setDescription(costume.description ?? "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingCostume(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!characterId || !name.trim()) return;

    setSaving(true);
    try {
      if (editingCostume) {
        await api.updateCostume(productionId, editingCostume.id, {
          character_id: Number(characterId),
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Costume updated");
      } else {
        await api.createCostume(productionId, {
          character_id: Number(characterId),
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Costume created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        formatApiError(
          err,
          editingCostume ? "Failed to update costume" : "Failed to create costume",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(costumeId: number) {
    const ok = await confirm({
      title: "Delete this costume?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api.deleteCostume(productionId, costumeId);
      toast.success("Costume deleted");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete costume"));
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
        <h1 className="text-2xl font-semibold tracking-tight">Costumes</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Manage the costume/look catalog, then record wear/clear changes on the timeline."
            : "Costumes in this production."}
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
            Add costume
          </Button>
          <CatalogCsvImport
            productionId={productionId}
            kind="costumes"
            onImported={loadData}
          />
        </div>
      )}

      {costumes.length === 0 ? (
        <EmptyState
          title="No costumes yet"
          description="Add looks to the catalog, then record wear/clear changes on the timeline."
          actionLabel={canManagePreparation ? "Add costume" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Character</th>
                <th className="px-4 py-3 text-left font-medium">Costume</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                {canManagePreparation && (
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costumes.map((costume) => (
                <tr key={costume.id}>
                  <td className="px-4 py-3 font-medium">{costume.character_name}</td>
                  <td className="px-4 py-3 font-medium">{costume.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {costume.description ?? "—"}
                  </td>
                  {canManagePreparation && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(costume)}
                          aria-label={`Edit ${costume.name}`}
                          title="Edit"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          onClick={() => void handleDelete(costume.id)}
                          aria-label={`Delete ${costume.name}`}
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
          if (!open) setEditingCostume(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editingCostume ? "Edit costume" : "Add costume"}</DialogTitle>
              <DialogDescription>
                {editingCostume
                  ? "Update this costume in the catalog."
                  : "Add a look to the catalog. Record when it's worn from the timeline."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select character…</option>
                {characters.map((character) => (
                  <option key={character.id} value={String(character.id)}>
                    {character.name}
                  </option>
                ))}
              </select>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Costume name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
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
              <Button
                type="submit"
                disabled={saving || !characterId || !name.trim()}
              >
                {editingCostume ? "Save" : "Add costume"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
