import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ObjectLink from "@/components/object-detail/ObjectLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterObjectDetailPanel } from "@/components/object-detail/useRegisterObjectDetailPanel";
import { useObjectDetailInternal } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import {
  useCatalogWriteThrough,
  useCharactersCatalog,
  useGroupsCatalog,
} from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import { characterWithActorLabel } from "@/lib/characterSearch";
import { queryKeys } from "@/lib/queryKeys";
import { sortByName } from "@/lib/utils";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";

interface GroupDetailPanelProps {
  groupId: number;
}

export default function GroupDetailPanel({ groupId }: GroupDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("groups", "update");

  const catalogEnabled = productionId != null;
  const {
    data: groupList = [],
    isLoading: groupsLoading,
    error: groupsError,
  } = useGroupsCatalog(productionId ?? 0, catalogEnabled);
  const {
    data: characterList = [],
    isLoading: charactersLoading,
    error: charactersError,
  } = useCharactersCatalog(productionId ?? 0, catalogEnabled);
  const {
    data: castableUsers = [],
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: queryKeys.catalog.castableUsers(productionId ?? 0),
    queryFn: () => api.listCastableUsers(productionId ?? 0),
    enabled: catalogEnabled,
  });
  const { setGroup: writeGroup } = useCatalogWriteThrough(productionId ?? 0);

  const group = groupList.find((row) => row.id === groupId) ?? null;
  const characters = useMemo(() => sortByName(characterList), [characterList]);
  const usersById = useMemo(() => {
    const map = new Map(castableUsers.map((user) => [user.id, user]));
    return map;
  }, [castableUsers]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const groupReady = group != null;
  useEffect(() => {
    if (group == null) return;
    setName(group.name);
    setDescription(group.description ?? "");
  }, [groupId, groupReady]); // eslint-disable-line react-hooks/exhaustive-deps -- seed on open only

  const isLoading = groupsLoading || charactersLoading || usersLoading;
  const loading = isLoading && group == null;
  const queryError = groupsError ?? charactersError ?? usersError;
  const error =
    queryError != null
      ? formatApiError(queryError, "Failed to load group")
      : catalogEnabled && !isLoading && group == null
        ? "Group not found."
        : null;

  const dirty =
    group != null &&
    (name.trim() !== group.name.trim() ||
      (description.trim() || "") !== (group.description ?? "").trim());

  const save = useCallback(async () => {
    if (productionId == null || group == null || !canUpdate) return;
    if (!name.trim()) {
      toast.error("Name is required");
      throw new Error("Name is required");
    }
    setSaving(true);
    try {
      const updated = await api.updateGroup(productionId, group.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      writeGroup(updated);
      setName(updated.name);
      setDescription(updated.description ?? "");
      toast.success("Group saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save group"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, description, group, name, productionId, toast, writeGroup]);

  const discard = useCallback(() => {
    if (group == null) return;
    setName(group.name);
    setDescription(group.description ?? "");
  }, [group]);

  const memberCharacters = useMemo(() => {
    if (group == null) return [];
    return characters.filter((character) => group.character_ids.includes(character.id));
  }, [characters, group]);

  const memberUsers = useMemo(() => {
    if (group == null) return [];
    return [...group.user_ids]
      .map((userId) => {
        const user = usersById.get(userId);
        return {
          id: userId,
          display_name: user?.display_name ?? `User #${userId}`,
        };
      })
      .sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
      );
  }, [group, usersById]);

  const controllers = useMemo(() => {
    if (group == null) return null;
    return {
      title: `Group · ${group.name}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [canUpdate, dirty, discard, group, save]);

  useRegisterObjectDetailPanel(controllers);

  if (productionId == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No production selected.</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <DetailPanelSkeleton />;
  }

  if (error || group == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Group not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="object-detail-group-name">Name</Label>
        {canUpdate ? (
          <Input
            id="object-detail-group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
          />
        ) : (
          <p className="text-sm font-medium">{group.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-group-description">Description</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-group-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {group.description?.trim() ? group.description : "—"}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Characters
          </p>
          {memberCharacters.length === 0 ? (
            <p className="text-sm text-muted-foreground">None</p>
          ) : (
            <ul className="space-y-1">
              {memberCharacters.map((character) => (
                <li key={character.id}>
                  <ObjectLink
                    objectType="character"
                    objectId={character.id}
                    label={characterWithActorLabel(character)}
                    className="text-sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Actors
          </p>
          {memberUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">None</p>
          ) : (
            <ul className="space-y-1">
              {memberUsers.map((user) => (
                <li key={user.id}>
                  <ObjectLink
                    objectType="person"
                    objectId={user.id}
                    label={user.display_name}
                    className="text-sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Membership is edited on the Groups catalog page.
        </p>
      </div>
    </div>
  );
}
