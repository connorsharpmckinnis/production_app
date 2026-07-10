import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { CueCategoryResponse } from "@/lib/types";

export default function CueCategoriesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();

  const [categories, setCategories] = useState<CueCategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const categoryData = await api.listCueCategories(productionId);
      setCategories(categoryData);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load cue categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    try {
      await api.createCueCategory(productionId, {
        name: newName.trim(),
        description: newDescription.trim() || null,
      });
      setNewName("");
      setNewDescription("");
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(category: CueCategoryResponse) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description ?? "");
  }

  async function handleSaveEdit(categoryId: number) {
    setSaving(true);
    try {
      await api.updateCueCategory(productionId, categoryId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to update category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId: number) {
    if (!confirm("Delete this cue category?")) return;
    setSaving(true);
    try {
      await api.deleteCueCategory(productionId, categoryId);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to delete category");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading cue categories…</p>;
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
        <h1 className="text-2xl font-semibold tracking-tight">Cue Categories</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Organize technical cues by category (Lighting, Sound, etc.)."
            : "Cue categories in this production."}
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
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Category name (e.g. Lighting)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add category
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
              Add category
            </button>
          )}
        </div>
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cue categories yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                {canManagePreparation && (
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((category) => (
                <tr key={category.id}>
                  {editingId === category.id ? (
                    <>
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
                            onClick={() => void handleSaveEdit(category.id)}
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
                      <td className="px-4 py-3 font-medium">{category.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {category.description ?? "—"}
                      </td>
                      {canManagePreparation && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(category)}
                              className="text-sm text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(category.id)}
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
