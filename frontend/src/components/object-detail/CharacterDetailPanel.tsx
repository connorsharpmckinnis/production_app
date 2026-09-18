import { useCallback, useEffect, useMemo, useState } from "react";
import CharacterSceneContext from "@/components/object-detail/CharacterSceneContext";
import ObjectLink from "@/components/object-detail/ObjectLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterObjectDetailPanel } from "@/components/object-detail/useRegisterObjectDetailPanel";
import { useObjectDetailInternal } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import {
  useCatalogWriteThrough,
  useCharactersCatalog,
} from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";

interface CharacterDetailPanelProps {
  characterId: number;
  sceneId?: number;
  sceneLabel?: string;
  sceneEndMomentId?: number;
}

export default function CharacterDetailPanel({
  characterId,
  sceneId,
  sceneLabel,
  sceneEndMomentId,
}: CharacterDetailPanelProps) {
  const { productionId, target } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("characters", "update");

  // Prefer explicit props; fall back to open target context (host remounts on key).
  const activeSceneId = sceneId ?? target?.sceneId;
  const activeSceneLabel = sceneLabel ?? target?.sceneLabel;
  const activeSceneEndMomentId = sceneEndMomentId ?? target?.sceneEndMomentId;

  const catalogEnabled = productionId != null;
  const {
    data: list = [],
    isLoading,
    error: queryError,
  } = useCharactersCatalog(productionId ?? 0, catalogEnabled);
  const { setCharacter: writeCharacter } = useCatalogWriteThrough(productionId ?? 0);

  const character = list.find((row) => row.id === characterId) ?? null;
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const characterReady = character != null;
  useEffect(() => {
    if (character == null) return;
    setDescription(character.description ?? "");
    // Seed once the row appears for this characterId — avoid wiping edits on catalog refresh.
  }, [characterId, characterReady]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional

  const loading = isLoading && character == null;
  const error =
    queryError != null
      ? formatApiError(queryError, "Failed to load character")
      : catalogEnabled && !isLoading && character == null
        ? "Character not found."
        : null;

  const dirty =
    character != null && (description.trim() || "") !== (character.description ?? "").trim();

  const save = useCallback(async () => {
    if (productionId == null || character == null || !canUpdate) return;
    setSaving(true);
    try {
      const updated = await api.updateCharacter(productionId, character.id, {
        description: description.trim() || null,
      });
      writeCharacter(updated);
      setDescription(updated.description ?? "");
      toast.success("Character saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save character"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, character, description, productionId, toast, writeCharacter]);

  const discard = useCallback(() => {
    if (character == null) return;
    setDescription(character.description ?? "");
  }, [character]);

  const controllers = useMemo(() => {
    if (character == null) return null;
    const sceneSuffix =
      activeSceneLabel?.trim() ? ` · ${activeSceneLabel.trim()}` : "";
    return {
      title: `Character · ${character.name}${sceneSuffix}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [activeSceneLabel, canUpdate, character, dirty, discard, save]);

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

  if (error || character == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Character not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {activeSceneId != null ? (
        <CharacterSceneContext
          productionId={productionId}
          characterId={character.id}
          sceneId={activeSceneId}
          sceneLabel={activeSceneLabel}
          sceneEndMomentId={activeSceneEndMomentId}
        />
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Name
        </p>
        <p className="text-sm font-medium">{character.name}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Scenes
        </p>
        <p className="text-sm">{character.scene_count}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assigned actor
        </p>
        {character.assigned_actor ? (
          <ObjectLink
            objectType="person"
            objectId={character.assigned_actor.user_id}
            label={character.assigned_actor.display_name}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Unassigned</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-character-description">Description</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-character-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {character.description?.trim() ? character.description : "—"}
          </p>
        )}
      </div>
    </div>
  );
}
