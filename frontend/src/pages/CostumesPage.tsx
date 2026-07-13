import { useEffect, useMemo, useState } from "react";
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
import type { ActSummary, CostumeResponse } from "@/lib/types";

export default function CostumesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [acts, setActs] = useState<ActSummary[]>([]);
  const [characters, setCharacters] = useState<
    Awaited<ReturnType<typeof api.listCharacters>>
  >([]);
  const [costumes, setCostumes] = useState<CostumeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCostume, setEditingCostume] = useState<CostumeResponse | null>(null);
  const [characterId, setCharacterId] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const scenes = useMemo(
    () =>
      acts.flatMap((act) =>
        act.scenes.map((scene) => ({
          id: scene.id,
          label: `Act ${act.number} › Scene ${scene.number}${
            scene.title ? `: ${scene.title}` : ""
          }`,
        })),
      ),
    [acts],
  );

  async function loadData() {
    setError(null);
    try {
      const [actData, characterData, costumeData] = await Promise.all([
        api.listActs(productionId),
        api.listCharacters(productionId),
        api.listCostumes(productionId),
      ]);
      setActs(actData);
      setCharacters(characterData);
      setCostumes(costumeData);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load costumes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  function openCreateDialog() {
    setEditingCostume(null);
    setCharacterId("");
    setSceneId("");
    setName("");
    setDescription("");
    setDialogOpen(true);
  }

  function openEditDialog(costume: CostumeResponse) {
    setEditingCostume(costume);
    setCharacterId(String(costume.character_id));
    setSceneId(String(costume.scene_id));
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
    if (!characterId || !sceneId || !name.trim()) return;

    setSaving(true);
    try {
      if (editingCostume) {
        await api.updateCostume(productionId, editingCostume.id, {
          character_id: Number(characterId),
          scene_id: Number(sceneId),
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Costume updated");
      } else {
        await api.createCostume(productionId, {
          character_id: Number(characterId),
          scene_id: Number(sceneId),
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Costume created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? String(err.detail)
          : editingCostume
            ? "Failed to update costume"
            : "Failed to create costume",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(costumeId: number) {
    const ok = await confirm({
      title: "Delete this costume assignment?",
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
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to delete costume");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading costumes…</p>;
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
            ? "Assign costumes to characters for specific scenes."
            : "Costume assignments in this production."}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canManagePreparation && (
        <Button type="button" onClick={openCreateDialog}>
          Add costume
        </Button>
      )}

      {costumes.length === 0 ? (
        <EmptyState
          title="No costumes yet"
          description="Assign costumes to characters for specific scenes."
          actionLabel={canManagePreparation ? "Add costume" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Character</th>
                <th className="px-4 py-3 text-left font-medium">Scene</th>
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
                  <td className="px-4 py-3 text-muted-foreground">
                    Scene {costume.scene_number}
                    {costume.scene_title ? `: ${costume.scene_title}` : ""}
                  </td>
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
                  ? "Update this costume assignment."
                  : "Assign a costume to a character for a specific scene."}
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
              <select
                value={sceneId}
                onChange={(e) => setSceneId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select scene…</option>
                {scenes.map((scene) => (
                  <option key={scene.id} value={String(scene.id)}>
                    {scene.label}
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
                disabled={saving || !characterId || !sceneId || !name.trim()}
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
