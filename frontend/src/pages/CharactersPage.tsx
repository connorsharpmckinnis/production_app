import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import type { CastableUserResponse, CharacterDetailResponse } from "@/lib/types";

export default function CharactersPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();
  const toast = useToast();

  const [characters, setCharacters] = useState<CharacterDetailResponse[]>([]);
  const [castableUsers, setCastableUsers] = useState<CastableUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const characterData = await api.listCharacters(productionId);
      setCharacters(characterData);
      if (canManagePreparation) {
        const users = await api.listCastableUsers(productionId);
        setCastableUsers(users);
      }
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load characters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId, canManagePreparation]);

  async function handleCastChange(characterId: number, userId: string) {
    setSavingId(characterId);
    try {
      const parsedUserId = userId === "" ? null : Number(userId);
      await api.castCharacter(productionId, characterId, parsedUserId);
      toast.success(parsedUserId == null ? "Actor unassigned" : "Actor assigned");
      await loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to update casting");
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddCharacter(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;

    setSavingId(-1);
    try {
      await api.createCharacter(productionId, { name: newName.trim() });
      setNewName("");
      setShowAddForm(false);
      toast.success("Character created");
      await loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to add character");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading characters…</p>;
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
        <h1 className="text-2xl font-semibold tracking-tight">Characters</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Review imported characters and assign actors."
            : "Characters in this production."}
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
            <form onSubmit={(e) => void handleAddCharacter(e)} className="flex flex-wrap gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Character name"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={savingId === -1}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Add character
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Add character manually
            </button>
          )}
        </div>
      )}

      {characters.length === 0 ? (
        <EmptyState
          title="No characters yet"
          description="Import a script first, or add a character manually."
          actionLabel={canManagePreparation ? "Add character" : undefined}
          onAction={canManagePreparation ? () => setShowAddForm(true) : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Scenes</th>
                {canManagePreparation ? (
                  <th className="px-4 py-3 text-left font-medium">Assigned actor</th>
                ) : (
                  <th className="px-4 py-3 text-left font-medium">Actor</th>
                )}
              </tr>
            </thead>
            <tbody>
              {characters.map((character) => (
                <tr key={character.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{character.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{character.scene_count}</td>
                  {canManagePreparation ? (
                    <td className="px-4 py-3">
                      <select
                        value={character.assigned_actor?.user_id ?? ""}
                        disabled={savingId === character.id}
                        onChange={(e) => void handleCastChange(character.id, e.target.value)}
                        className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {castableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.display_name}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : (
                    <td className="px-4 py-3 text-muted-foreground">
                      {character.assigned_actor?.display_name ?? "—"}
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
