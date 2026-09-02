import { useCallback, useEffect, useMemo, useState } from "react";
import ObjectLink from "@/components/object-detail/ObjectLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterObjectDetailPanel } from "@/components/object-detail/useRegisterObjectDetailPanel";
import { useObjectDetailInternal } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { CharacterDetailResponse, GroupResponse } from "@/lib/types";
import { sortByName } from "@/lib/utils";

interface GroupDetailPanelProps {
  groupId: number;
}

export default function GroupDetailPanel({ groupId }: GroupDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("groups", "update");

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [characters, setCharacters] = useState<CharacterDetailResponse[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (productionId == null) return;
    setLoading(true);
    setError(null);
    try {
      const [groupList, characterList] = await Promise.all([
        api.listGroups(productionId),
        api.listCharacters(productionId),
      ]);
      const found = groupList.find((row) => row.id === groupId) ?? null;
      setCharacters(sortByName(characterList));
      if (!found) {
        setGroup(null);
        setError("Group not found.");
        return;
      }
      setGroup(found);
      setName(found.name);
      setDescription(found.description ?? "");
    } catch (err) {
      setError(formatApiError(err, "Failed to load group"));
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, productionId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setGroup(updated);
      setName(updated.name);
      setDescription(updated.description ?? "");
      toast.success("Group saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save group"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, description, group, name, productionId, toast]);

  const discard = useCallback(() => {
    if (group == null) return;
    setName(group.name);
    setDescription(group.description ?? "");
  }, [group]);

  const memberCharacters = useMemo(() => {
    if (group == null) return [];
    return characters.filter((character) => group.character_ids.includes(character.id));
  }, [characters, group]);

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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
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

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Members
        </p>
        {memberCharacters.length === 0 && group.user_ids.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {memberCharacters.map((character) => (
              <ObjectLink
                key={character.id}
                objectType="character"
                objectId={character.id}
                label={character.name}
                className="text-xs"
              />
            ))}
            {group.user_ids.length > 0 && (
              <p className="w-full text-xs text-muted-foreground">
                {group.user_ids.length} uncast user
                {group.user_ids.length === 1 ? "" : "s"} also in this group
                (edit membership on the Groups page).
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Membership is edited on the Groups catalog page.
        </p>
      </div>
    </div>
  );
}
