import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
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
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { CastableUserResponse, CharacterDetailResponse } from "@/lib/types";
import { sortByName } from "@/lib/utils";

const UNASSIGNED = "__unassigned__";

export default function CharactersPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { hasCapability } = useProductionAccess();
  const canCreateCharacters = hasCapability("characters", "create");
  const canCast = hasCapability("casting", "update");
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
      setCharacters(sortByName(characterData));
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
  }, [productionId, canCast]);

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
        <div className="rounded-lg border border-border">
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
                  <TableCell className="text-muted-foreground">{character.scene_count}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
