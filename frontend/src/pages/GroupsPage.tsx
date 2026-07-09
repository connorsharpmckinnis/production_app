import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type {
  CastableUserResponse,
  CharacterDetailResponse,
  GroupResponse,
} from "@/lib/types";

export default function GroupsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);

  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [characters, setCharacters] = useState<CharacterDetailResponse[]>([]);
  const [castableUsers, setCastableUsers] = useState<CastableUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  async function loadData() {
    setError(null);
    try {
      const [groupData, characterData, userData] = await Promise.all([
        api.listGroups(productionId),
        api.listCharacters(productionId),
        api.listCastableUsers(productionId),
      ]);
      setGroups(groupData);
      setCharacters(characterData);
      setCastableUsers(userData);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  async function handleCreateGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;

    try {
      await api.createGroup(productionId, { name: newName.trim() });
      setNewName("");
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to create group");
    }
  }

  function startEditing(group: GroupResponse) {
    setEditingGroupId(group.id);
    setSelectedCharacterIds(group.character_ids);
    setSelectedUserIds(group.user_ids);
  }

  async function saveMembership(groupId: number) {
    try {
      await api.updateGroupMembers(productionId, groupId, {
        character_ids: selectedCharacterIds,
        user_ids: selectedUserIds,
      });
      setEditingGroupId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to save group members");
    }
  }

  async function handleDeleteGroup(groupId: number) {
    if (!confirm("Delete this group?")) return;
    try {
      await api.deleteGroup(productionId, groupId);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to delete group");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading groups…</p>;
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
        <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
        <p className="text-sm text-muted-foreground">
          Organize characters and actors into ensembles, crews, and other collections.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleCreateGroup(e)} className="flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Group name (e.g. Ensemble)"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Create group
        </button>
      </form>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          No groups yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{group.name}</h2>
                  {group.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {group.character_ids.length} character
                    {group.character_ids.length === 1 ? "" : "s"}
                    {" · "}
                    {group.user_ids.length} actor
                    {group.user_ids.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(group)}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    Edit members
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteGroup(group.id)}
                    className="rounded-md border border-destructive/30 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingGroupId === group.id && (
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  <div>
                    <p className="text-sm font-medium">Characters in this group</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {characters.map((character) => (
                        <label key={character.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedCharacterIds.includes(character.id)}
                            onChange={(e) => {
                              setSelectedCharacterIds((prev) =>
                                e.target.checked
                                  ? [...prev, character.id]
                                  : prev.filter((id) => id !== character.id),
                              );
                            }}
                          />
                          {character.name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Actors in this group</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Useful for ensemble members who are not cast to a specific character.
                    </p>
                    {castableUsers.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No actor users available.</p>
                    ) : (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {castableUsers.map((user) => (
                          <label key={user.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.id)}
                              onChange={(e) => {
                                setSelectedUserIds((prev) =>
                                  e.target.checked
                                    ? [...prev, user.id]
                                    : prev.filter((id) => id !== user.id),
                                );
                              }}
                            />
                            {user.display_name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveMembership(group.id)}
                      className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGroupId(null)}
                      className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
