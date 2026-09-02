import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterObjectDetailPanel } from "@/components/object-detail/useRegisterObjectDetailPanel";
import { useObjectDetailInternal } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { CueCategoryResponse } from "@/lib/types";

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

  const [category, setCategory] = useState<CueCategoryResponse | null>(null);
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
      const list = await api.listCueCategories(productionId);
      const found = list.find((row) => row.id === categoryId) ?? null;
      if (!found) {
        setCategory(null);
        setError("Cue category not found.");
        return;
      }
      setCategory(found);
      setName(found.name);
      setDescription(found.description ?? "");
    } catch (err) {
      setError(formatApiError(err, "Failed to load cue category"));
      setCategory(null);
    } finally {
      setLoading(false);
    }
  }, [categoryId, productionId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setCategory(updated);
      setName(updated.name);
      setDescription(updated.description ?? "");
      toast.success("Cue category saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save cue category"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, category, description, name, productionId, toast]);

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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
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
