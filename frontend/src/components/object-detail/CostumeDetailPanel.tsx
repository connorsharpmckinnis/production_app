import { useCallback, useEffect, useMemo, useState } from "react";
import ObjectLink from "@/components/object-detail/ObjectLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterObjectDetailPanel } from "@/components/object-detail/useRegisterObjectDetailPanel";
import { useObjectDetailInternal } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import {
  useCatalogWriteThrough,
  useCharactersCatalog,
  useCostumesCatalog,
} from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import { sortByName } from "@/lib/utils";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";

interface CostumeDetailPanelProps {
  costumeId: number;
}

export default function CostumeDetailPanel({ costumeId }: CostumeDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("costumes", "update");

  const catalogEnabled = productionId != null;
  const {
    data: costumeList = [],
    isLoading: costumesLoading,
    error: costumesError,
  } = useCostumesCatalog(productionId ?? 0, catalogEnabled);
  const {
    data: characterList = [],
    isLoading: charactersLoading,
    error: charactersError,
  } = useCharactersCatalog(productionId ?? 0, catalogEnabled);
  const { setCostume: writeCostume } = useCatalogWriteThrough(productionId ?? 0);

  const costume = costumeList.find((row) => row.id === costumeId) ?? null;
  const characters = useMemo(() => sortByName(characterList), [characterList]);
  const [characterId, setCharacterId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const costumeReady = costume != null;
  useEffect(() => {
    if (costume == null) return;
    setCharacterId(String(costume.character_id));
    setName(costume.name);
    setDescription(costume.description ?? "");
  }, [costumeId, costumeReady]); // eslint-disable-line react-hooks/exhaustive-deps -- seed on open only

  const isLoading = costumesLoading || charactersLoading;
  const loading = isLoading && costume == null;
  const queryError = costumesError ?? charactersError;
  const error =
    queryError != null
      ? formatApiError(queryError, "Failed to load costume")
      : catalogEnabled && !isLoading && costume == null
        ? "Costume not found."
        : null;

  const dirty =
    costume != null &&
    (Number(characterId) !== costume.character_id ||
      name.trim() !== costume.name.trim() ||
      (description.trim() || "") !== (costume.description ?? "").trim());

  const save = useCallback(async () => {
    if (productionId == null || costume == null || !canUpdate) return;
    if (!name.trim()) {
      toast.error("Name is required");
      throw new Error("Name is required");
    }
    if (!characterId) {
      toast.error("Character is required");
      throw new Error("Character is required");
    }
    setSaving(true);
    try {
      const updated = await api.updateCostume(productionId, costume.id, {
        character_id: Number(characterId),
        name: name.trim(),
        description: description.trim() || null,
      });
      writeCostume(updated);
      setCharacterId(String(updated.character_id));
      setName(updated.name);
      setDescription(updated.description ?? "");
      toast.success("Costume saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save costume"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, characterId, costume, description, name, productionId, toast, writeCostume]);

  const discard = useCallback(() => {
    if (costume == null) return;
    setCharacterId(String(costume.character_id));
    setName(costume.name);
    setDescription(costume.description ?? "");
  }, [costume]);

  const controllers = useMemo(() => {
    if (costume == null) return null;
    return {
      title: `Costume · ${costume.name}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [canUpdate, costume, dirty, discard, save]);

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

  if (error || costume == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Costume not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="object-detail-costume-name">Name</Label>
        {canUpdate ? (
          <Input
            id="object-detail-costume-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
          />
        ) : (
          <p className="text-sm font-medium">{costume.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Character</Label>
        {canUpdate ? (
          <Select
            value={characterId}
            onValueChange={setCharacterId}
            disabled={saving}
          >
            <SelectTrigger id="object-detail-costume-character">
              <SelectValue placeholder="Select character" />
            </SelectTrigger>
            <SelectContent>
              {characters.map((character) => (
                <SelectItem key={character.id} value={String(character.id)}>
                  {character.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <ObjectLink
            objectType="character"
            objectId={costume.character_id}
            label={costume.character_name}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-costume-description">Description</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-costume-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {costume.description?.trim() ? costume.description : "—"}
          </p>
        )}
      </div>
    </div>
  );
}
