import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { SetPieceResponse } from "@/lib/types";

export default function SetPiecesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();

  const [setPieces, setSetPieces] = useState<SetPieceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState(false);
  const [editDescription, setEditDescription] = useState("");
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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    try {
      await api.createSetPiece(productionId, {
        name: newName.trim(),
        mobile: newMobile,
        description: newDescription.trim() || null,
      });
      setNewName("");
      setNewMobile(false);
      setNewDescription("");
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to create set piece");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(piece: SetPieceResponse) {
    setEditingId(piece.id);
    setEditName(piece.name);
    setEditMobile(piece.mobile);
    setEditDescription(piece.description ?? "");
  }

  async function handleSaveEdit(pieceId: number) {
    setSaving(true);
    try {
      await api.updateSetPiece(productionId, pieceId, {
        name: editName.trim(),
        mobile: editMobile,
        description: editDescription.trim() || null,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to update set piece");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pieceId: number) {
    if (!confirm("Delete this set piece?")) return;
    setSaving(true);
    try {
      await api.deleteSetPiece(productionId, pieceId);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to delete set piece");
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
          to={`/productions/${productionId}/timeline`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Timeline
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
        <div>
          {showAddForm ? (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-2 rounded-md border border-border p-4">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Set piece name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newMobile}
                  onChange={(e) => setNewMobile(e.target.checked)}
                />
                Mobile (can be moved between moments)
              </label>
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
                  Add set piece
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
              Add set piece
            </button>
          )}
        </div>
      )}

      {setPieces.length === 0 ? (
        <p className="text-sm text-muted-foreground">No set pieces yet.</p>
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
                  {editingId === piece.id ? (
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
                          type="checkbox"
                          checked={editMobile}
                          onChange={(e) => setEditMobile(e.target.checked)}
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
                            onClick={() => void handleSaveEdit(piece.id)}
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
                      <td className="px-4 py-3 font-medium">{piece.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {piece.mobile ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {piece.description ?? "—"}
                      </td>
                      {canManagePreparation && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(piece)}
                              className="text-sm text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(piece.id)}
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
