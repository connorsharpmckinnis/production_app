import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
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
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type {
  CastableUserResponse,
  CharacterDetailResponse,
  GroupResponse,
} from "@/lib/types";

export default function GroupsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const confirm = useConfirm();
  const toast = useToast();

  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [characters, setCharacters] = useState<CharacterDetailResponse[]>([]);
  const [castableUsers, setCastableUsers] = useState<CastableUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  const editingGroup = groups.find((group) => group.id === editingGroupId);
  const searchLower = memberSearch.trim().toLowerCase();
  const filteredCharacters = searchLower
    ? characters.filter((character) => character.name.toLowerCase().includes(searchLower))
    : characters;
  const filteredUsers = searchLower
    ? castableUsers.filter((user) => user.display_name.toLowerCase().includes(searchLower))
    : castableUsers;

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
      setError(formatApiError(err, "Failed to load groups"));
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
      toast.success("Group created");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to create group"));
    }
  }

  function startEditing(group: GroupResponse) {
    setEditingGroupId(group.id);
    setSelectedCharacterIds(group.character_ids);
    setSelectedUserIds(group.user_ids);
    setMemberSearch("");
  }

  function closeMemberDialog() {
    setEditingGroupId(null);
    setMemberSearch("");
  }

  async function saveMembership(groupId: number) {
    try {
      await api.updateGroupMembers(productionId, groupId, {
        character_ids: selectedCharacterIds,
        user_ids: selectedUserIds,
      });
      closeMemberDialog();
      toast.success("Group members updated");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save group members"));
    }
  }

  async function handleDeleteGroup(groupId: number) {
    const ok = await confirm({
      title: "Delete this group?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.deleteGroup(productionId, groupId);
      toast.success("Group deleted");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete group"));
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
        <Button type="submit">Create group</Button>
      </form>

      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create a group to organize characters and actors."
        />
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
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => startEditing(group)}
                    aria-label={`Edit members of ${group.name}`}
                    title="Edit members"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void handleDeleteGroup(group.id)}
                    aria-label={`Delete ${group.name}`}
                    title="Delete"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editingGroupId !== null} onOpenChange={(open) => !open && closeMemberDialog()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? `Edit members — ${editingGroup.name}` : "Edit members"}
            </DialogTitle>
            <DialogDescription>
              Select characters and actors to include in this group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              type="search"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search characters and actors…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />

            <div>
              <p className="text-sm font-medium">Characters in this group</p>
              {filteredCharacters.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchLower ? "No characters match your search." : "No characters available."}
                </p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {filteredCharacters.map((character) => (
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
              )}
            </div>

            <div>
              <p className="text-sm font-medium">Actors in this group</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Useful for ensemble members who are not cast to a specific character.
              </p>
              {castableUsers.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No actor users available.</p>
              ) : filteredUsers.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No actors match your search.</p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {filteredUsers.map((user) => (
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeMemberDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => editingGroupId && void saveMembership(editingGroupId)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
