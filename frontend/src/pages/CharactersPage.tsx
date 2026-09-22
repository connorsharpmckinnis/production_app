import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { seedCharactersCatalog, seedGroupsCatalog } from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import type {
  CastableUserResponse,
  CatalogDeleteImpact,
  CatalogReassignTarget,
  CharacterDetailResponse,
  GroupResponse,
} from "@/lib/types";
import { sortByName } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import CatalogSubjectDeleteDialog from "@/components/CatalogSubjectDeleteDialog";
import EmptyState from "@/components/EmptyState";
import MobileListCard from "@/components/MobileListCard";
import ObjectLink from "@/components/object-detail/ObjectLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const UNASSIGNED = "__unassigned__";

export default function CharactersPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { hasCapability } = useProductionAccess();
  const canCreateCharacters = hasCapability("characters", "create");
  const canDeleteCharacters = hasCapability("characters", "delete");
  const canCast = hasCapability("casting", "update");
  const toast = useToast();
  const queryClient = useQueryClient();

  const [characters, setCharacters] = useState<CharacterDetailResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [castableUsers, setCastableUsers] = useState<CastableUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CharacterDetailResponse | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<CatalogDeleteImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const [characterData, groupData] = await Promise.all([
        api.listCharacters(productionId),
        canDeleteCharacters ? api.listGroups(productionId) : Promise.resolve([]),
      ]);
      const sorted = sortByName(characterData);
      setCharacters(sorted);
      setGroups(groupData);
      seedCharactersCatalog(queryClient, productionId, sorted);
      if (canDeleteCharacters) {
        seedGroupsCatalog(queryClient, productionId, groupData);
      }
      if (canCast) {
        const users = await api.listCastableUsers(productionId);
        setCastableUsers(
          [...users].sort((a, b) =>
            a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
          ),
        );
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to load characters"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId, canCast, canDeleteCharacters]);

  async function handleCastChange(characterId: number, userId: string) {
    setSavingId(characterId);
    try {
      const parsedUserId = userId === UNASSIGNED ? null : Number(userId);
      await api.castCharacter(productionId, characterId, parsedUserId);
      toast.success(parsedUserId == null ? "Actor unassigned" : "Actor assigned");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to update casting"));
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
      toast.error(formatApiError(err, "Failed to add character"));
    } finally {
      setSavingId(null);
    }
  }

  async function openDeleteDialog(character: CharacterDetailResponse) {
    setDeleteTarget(character);
    setDeleteImpact(null);
    setLoadingImpact(true);
    try {
      const impact = await api.getCharacterDeleteImpact(productionId, character.id);
      setDeleteImpact(impact);
    } catch (err) {
      toast.error(formatApiError(err, "Failed to check character usage"));
      setDeleteTarget(null);
    } finally {
      setLoadingImpact(false);
    }
  }

  async function confirmDelete(reassignTo: CatalogReassignTarget | null) {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteCharacter(productionId, deleteTarget.id, reassignTo);
      toast.success("Character deleted");
      setDeleteTarget(null);
      setDeleteImpact(null);
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete character"));
    } finally {
      setDeleting(false);
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
        <h1 className="text-2xl font-semibold tracking-tight">Characters</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {canCreateCharacters && (
        <div>
          {showAddForm ? (
            <form onSubmit={(e) => void handleAddCharacter(e)} className="flex flex-wrap gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Character name"
                className="w-64"
              />
              <Button type="submit" disabled={savingId === -1}>
                Add character
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button type="button" variant="outline" onClick={() => setShowAddForm(true)}>
              Add character manually
            </Button>
          )}
        </div>
      )}

      {characters.length === 0 ? (
        <EmptyState
          title="No characters yet"
          description="Import a script first, or add a character manually."
          actionLabel={canCreateCharacters ? "Add character" : undefined}
          onAction={canCreateCharacters ? () => setShowAddForm(true) : undefined}
        />
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {characters.map((character) => (
              <MobileListCard key={character.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      <ObjectLink
                        objectType="character"
                        objectId={character.id}
                        label={character.name}
                      />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {character.scene_count}{" "}
                      {character.scene_count === 1 ? "scene" : "scenes"}
                    </p>
                  </div>
                  {canDeleteCharacters && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void openDeleteDialog(character)}
                      aria-label={`Delete ${character.name}`}
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                {canCast ? (
                  <div className="pt-2">
                    <Select
                      value={String(character.assigned_actor?.user_id ?? UNASSIGNED)}
                      disabled={savingId === character.id}
                      onValueChange={(value) => void handleCastChange(character.id, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {castableUsers.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {user.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {character.assigned_actor?.display_name ?? "Unassigned"}
                  </p>
                )}
              </MobileListCard>
            ))}
          </ul>

          <div className="hidden rounded-lg border border-border md:block">
            <Table storageKey="characters">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scenes</TableHead>
                  {canCast ? (
                    <TableHead>Assigned actor</TableHead>
                  ) : (
                    <TableHead>Actor</TableHead>
                  )}
                  {canDeleteCharacters && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {characters.map((character) => (
                  <TableRow key={character.id}>
                    <TableCell className="font-medium">
                      <ObjectLink
                        objectType="character"
                        objectId={character.id}
                        label={character.name}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {character.scene_count}
                    </TableCell>
                    {canCast ? (
                      <TableCell>
                        <Select
                          value={String(character.assigned_actor?.user_id ?? UNASSIGNED)}
                          disabled={savingId === character.id}
                          onValueChange={(value) => void handleCastChange(character.id, value)}
                        >
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                            {castableUsers.map((user) => (
                              <SelectItem key={user.id} value={String(user.id)}>
                                {user.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    ) : (
                      <TableCell className="text-muted-foreground">
                        {character.assigned_actor?.display_name ?? "—"}
                      </TableCell>
                    )}
                    {canDeleteCharacters && (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void openDeleteDialog(character)}
                          aria-label={`Delete ${character.name}`}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <CatalogSubjectDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteImpact(null);
          }
        }}
        entityType="character"
        entityName={deleteTarget?.name ?? ""}
        impact={deleteImpact}
        loadingImpact={loadingImpact}
        characters={characters}
        groups={groups}
        excludeId={deleteTarget?.id ?? 0}
        submitting={deleting}
        onConfirm={(reassignTo) => void confirmDelete(reassignTo)}
      />
    </div>
  );
}
