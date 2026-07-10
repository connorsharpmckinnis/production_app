import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { PropResponse } from "@/lib/types";

export default function PropsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();

  const [props, setProps] = useState<PropResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    try {
      await api.createProp(productionId, {
        name: newName.trim(),
        description: newDescription.trim() || null,
        notes: newNotes.trim() || null,
      });
      setNewName("");
      setNewDescription("");
      setNewNotes("");
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to create prop");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(prop: PropResponse) {
    setEditingId(prop.id);
    setEditName(prop.name);
    setEditDescription(prop.description ?? "");
    setEditNotes(prop.notes ?? "");
  }

  async function handleSaveEdit(propId: number) {
    setSaving(true);
    try {
      await api.updateProp(productionId, propId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        notes: editNotes.trim() || null,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to update prop");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(propId: number) {
    if (!confirm("Delete this prop?")) return;
    setSaving(true);
    try {
      await api.deleteProp(productionId, propId);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to delete prop");
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
          to={`/productions/${productionId}/timeline`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Timeline
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
        <div>
          {showAddForm ? (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-2 rounded-md border border-border p-4">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Prop name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add prop
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
              Add prop
            </button>
          )}
        </div>
      )}

      {props.length === 0 ? (
        <p className="text-sm text-muted-foreground">No props yet.</p>
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
                  {editingId === prop.id ? (
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
                        <input
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleSaveEdit(prop.id)}
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
                      <td className="px-4 py-3 font-medium">{prop.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{prop.description ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{prop.notes ?? "—"}</td>
                      {canManagePreparation && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(prop)}
                              className="text-sm text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(prop.id)}
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
