import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { SongDetailResponse } from "@/lib/types";

export default function SongsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();

  const [songs, setSongs] = useState<SongDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newComposer, setNewComposer] = useState("");
  const [newLyricist, setNewLyricist] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editComposer, setEditComposer] = useState("");
  const [editLyricist, setEditLyricist] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const songData = await api.listSongs(productionId);
      setSongs(songData);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load songs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newTitle.trim()) return;

    setSaving(true);
    try {
      await api.createSong(productionId, {
        title: newTitle.trim(),
        composer: newComposer.trim() || null,
        lyricist: newLyricist.trim() || null,
      });
      setNewTitle("");
      setNewComposer("");
      setNewLyricist("");
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to create song");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(song: SongDetailResponse) {
    setEditingId(song.id);
    setEditComposer(song.composer ?? "");
    setEditLyricist(song.lyricist ?? "");
    setEditDescription(song.description ?? "");
  }

  async function handleSaveEdit(songId: number) {
    setSaving(true);
    try {
      await api.updateSong(productionId, songId, {
        composer: editComposer.trim() || null,
        lyricist: editLyricist.trim() || null,
        description: editDescription.trim() || null,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to update song");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading songs…</p>;
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
        <h1 className="text-2xl font-semibold tracking-tight">Songs</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Manage songs and link them to timeline moments."
            : "Songs in this production."}
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
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Song title"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                value={newComposer}
                onChange={(e) => setNewComposer(e.target.value)}
                placeholder="Composer (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                value={newLyricist}
                onChange={(e) => setNewLyricist(e.target.value)}
                placeholder="Lyricist (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add song
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
              Add song
            </button>
          )}
        </div>
      )}

      {songs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No songs yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Composer</th>
                <th className="px-4 py-3 text-left font-medium">Lyricist</th>
                {canManagePreparation && (
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {songs.map((song) => (
                <tr key={song.id}>
                  <td className="px-4 py-3 font-medium">{song.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {editingId === song.id ? (
                      <input
                        value={editComposer}
                        onChange={(e) => setEditComposer(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      song.composer ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {editingId === song.id ? (
                      <input
                        value={editLyricist}
                        onChange={(e) => setEditLyricist(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      song.lyricist ?? "—"
                    )}
                  </td>
                  {canManagePreparation && (
                    <td className="px-4 py-3">
                      {editingId === song.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description"
                            rows={2}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleSaveEdit(song.id)}
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
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(song)}
                          className="text-sm text-primary hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </td>
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
