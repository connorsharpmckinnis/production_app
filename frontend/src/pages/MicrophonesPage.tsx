import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { MicrophoneResponse } from "@/lib/types";

export default function MicrophonesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();

  const [microphones, setMicrophones] = useState<MicrophoneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIdentifier, setNewIdentifier] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editIdentifier, setEditIdentifier] = useState("");
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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newIdentifier.trim()) return;

    setSaving(true);
    try {
      await api.createMicrophone(productionId, { identifier: newIdentifier.trim() });
      setNewIdentifier("");
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to create microphone");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(mic: MicrophoneResponse) {
    setEditingId(mic.id);
    setEditIdentifier(mic.identifier);
  }

  async function handleSaveEdit(micId: number) {
    setSaving(true);
    try {
      await api.updateMicrophone(productionId, micId, { identifier: editIdentifier.trim() });
      setEditingId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to update microphone");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(micId: number) {
    if (!confirm("Delete this microphone?")) return;
    setSaving(true);
    try {
      await api.deleteMicrophone(productionId, micId);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to delete microphone");
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
          to={`/productions/${productionId}/timeline`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Timeline
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
        <div>
          {showAddForm ? (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-2 rounded-md border border-border p-4">
              <input
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                placeholder="Identifier (e.g. Lav 1)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add microphone
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
              Add microphone
            </button>
          )}
        </div>
      )}

      {microphones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No microphones yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Identifier</th>
                {canManagePreparation && (
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {microphones.map((mic) => (
                <tr key={mic.id}>
                  {editingId === mic.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          value={editIdentifier}
                          onChange={(e) => setEditIdentifier(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleSaveEdit(mic.id)}
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
                      <td className="px-4 py-3 font-medium">{mic.identifier}</td>
                      {canManagePreparation && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(mic)}
                              className="text-sm text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(mic.id)}
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
