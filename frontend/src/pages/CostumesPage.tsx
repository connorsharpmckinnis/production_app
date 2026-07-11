import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { ActSummary, CostumeResponse } from "@/lib/types";

export default function CostumesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();

  const [acts, setActs] = useState<ActSummary[]>([]);
  const [characters, setCharacters] = useState<
    Awaited<ReturnType<typeof api.listCharacters>>
  >([]);
  const [costumes, setCostumes] = useState<CostumeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCharacterId, setNewCharacterId] = useState("");
  const [newSceneId, setNewSceneId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCharacterId, setEditCharacterId] = useState("");
  const [editSceneId, setEditSceneId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newCharacterId || !newSceneId || !newName.trim()) return;

    setSaving(true);
    try {
      await api.createCostume(productionId, {
        character_id: Number(newCharacterId),
        scene_id: Number(newSceneId),
        name: newName.trim(),
        description: newDescription.trim() || null,
      });
      setNewCharacterId("");
      setNewSceneId("");
      setNewName("");
      setNewDescription("");
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to create costume");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(costume: CostumeResponse) {
    setEditingId(costume.id);
    setEditCharacterId(String(costume.character_id));
    setEditSceneId(String(costume.scene_id));
    setEditName(costume.name);
    setEditDescription(costume.description ?? "");
  }

  async function handleSaveEdit(costumeId: number) {
    setSaving(true);
    try {
      await api.updateCostume(productionId, costumeId, {
        character_id: Number(editCharacterId),
        scene_id: Number(editSceneId),
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to update costume");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(costumeId: number) {
    if (!confirm("Delete this costume assignment?")) return;
    setSaving(true);
    try {
      await api.deleteCostume(productionId, costumeId);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to delete costume");
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
          to={`/productions/${productionId}/timeline`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Timeline
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
        <div>
          {showAddForm ? (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-2 rounded-md border border-border p-4">
              <select
                value={newCharacterId}
                onChange={(e) => setNewCharacterId(e.target.value)}
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
                value={newSceneId}
                onChange={(e) => setNewSceneId(e.target.value)}
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
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Costume name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add costume
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Add costume
            </button>
          )}
        </div>
      )}

      {costumes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No costumes yet.</p>
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
                  {editingId === costume.id ? (
                    <>
                      <td className="px-4 py-3">
                        <select
                          value={editCharacterId}
                          onChange={(e) => setEditCharacterId(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        >
                          {characters.map((character) => (
                            <option key={character.id} value={String(character.id)}>
                              {character.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editSceneId}
                          onChange={(e) => setEditSceneId(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        >
                          {scenes.map((scene) => (
                            <option key={scene.id} value={String(scene.id)}>
                              {scene.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleSaveEdit(costume.id)}
                            className="text-sm text-primary hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-sm text-muted-foreground hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
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
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(costume)}
                              className="text-sm text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(costume.id)}
                              className="text-sm text-destructive hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
