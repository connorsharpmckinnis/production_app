import { useCallback, useEffect, useMemo, useState } from "react";
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
  useCueCategoriesCatalog,
} from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";

interface CueCategoryDetailPanelProps {
  categoryId: number;
}

export default function CueCategoryDetailPanel({
  categoryId,
}: CueCategoryDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("cue_categories", "update");

  const catalogEnabled = productionId != null;
  const {
    data: list = [],
    isLoading,
    error: queryError,
  } = useCueCategoriesCatalog(productionId ?? 0, catalogEnabled);
  const { setCueCategory: writeCueCategory } = useCatalogWriteThrough(productionId ?? 0);

  const category = list.find((row) => row.id === categoryId) ?? null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const categoryReady = category != null;
  useEffect(() => {
    if (category == null) return;
    setName(category.name);
    setDescription(category.description ?? "");
  }, [categoryId, categoryReady]); // eslint-disable-line react-hooks/exhaustive-deps -- seed on open only

  const loading = isLoading && category == null;
  const error =
    queryError != null
      ? formatApiError(queryError, "Failed to load cue category")
      : catalogEnabled && !isLoading && category == null
        ? "Cue category not found."
        : null;

  const dirty =
    category != null &&
    (name.trim() !== category.name.trim() ||
      (description.trim() || "") !== (category.description ?? "").trim());

  const save = useCallback(async () => {
    if (productionId == null || category == null || !canUpdate) return;
    if (!name.trim()) {
      toast.error("Name is required");
      throw new Error("Name is required");
    }
    setSaving(true);
    try {
      const updated = await api.updateCueCategory(productionId, category.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      writeCueCategory(updated);
      setName(updated.name);
      setDescription(updated.description ?? "");
      toast.success("Cue category saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save cue category"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, category, description, name, productionId, toast, writeCueCategory]);

  const discard = useCallback(() => {
    if (category == null) return;
    setName(category.name);
    setDescription(category.description ?? "");
  }, [category]);

  const controllers = useMemo(() => {
    if (category == null) return null;
    return {
      title: `Cue category · ${category.name}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [canUpdate, category, dirty, discard, save]);

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

  if (error || category == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Cue category not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="object-detail-cue-category-name">Name</Label>
        {canUpdate ? (
          <Input
            id="object-detail-cue-category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
          />
        ) : (
          <p className="text-sm font-medium">{category.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-cue-category-description">Description</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-cue-category-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {category.description?.trim() ? category.description : "—"}
          </p>
        )}
      </div>
    </div>
  );
}
