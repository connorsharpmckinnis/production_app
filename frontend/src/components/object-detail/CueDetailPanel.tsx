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
  useMomentDetail,
  useMomentDetailCache,
} from "@/hooks/queries/useMomentDetail";
import { useCueCategoriesCatalog } from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";

interface CueDetailPanelProps {
  cueId: number;
  momentId?: number;
}

export default function CueDetailPanel({ cueId, momentId }: CueDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("cues", "update");

  const queriesEnabled = productionId != null && momentId != null;
  const {
    data: moment,
    isPending: momentPending,
    error: momentError,
  } = useMomentDetail(
    productionId ?? 0,
    queriesEnabled ? momentId! : null,
  );
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCueCategoriesCatalog(productionId ?? 0, productionId != null);
  const { setMomentDetail } = useMomentDetailCache(productionId ?? 0);

  const cue = moment?.cues.find((row) => row.id === cueId) ?? null;
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const cueReady = cue != null;
  useEffect(() => {
    if (cue == null) return;
    setCategoryId(String(cue.cue_category_id));
    setTitle(cue.title);
    setNotes(cue.notes ?? "");
  }, [cueId, cueReady]); // eslint-disable-line react-hooks/exhaustive-deps -- seed on open only

  const loading =
    momentId == null
      ? false
      : (momentPending && cue == null) || (categoriesLoading && categories.length === 0);
  const queryError = momentError ?? categoriesError;
  const error =
    momentId == null
      ? "This cue needs a moment context to open."
      : queryError != null
        ? formatApiError(queryError, "Failed to load cue")
        : queriesEnabled && !momentPending && !categoriesLoading && cue == null
          ? "Cue not found on this moment."
          : null;

  const dirty =
    cue != null &&
    (Number(categoryId) !== cue.cue_category_id ||
      title.trim() !== cue.title.trim() ||
      (notes.trim() || "") !== (cue.notes ?? "").trim());

  const save = useCallback(async () => {
    if (productionId == null || momentId == null || cue == null || !canUpdate) return;
    if (!title.trim()) {
      toast.error("Title is required");
      throw new Error("Title is required");
    }
    if (!categoryId) {
      toast.error("Category is required");
      throw new Error("Category is required");
    }
    setSaving(true);
    try {
      const updated = await api.updateMomentCue(productionId, momentId, cue.id, {
        cue_category_id: Number(categoryId),
        title: title.trim(),
        notes: notes.trim() || null,
      });
      if (moment != null) {
        setMomentDetail({
          ...moment,
          cues: moment.cues.map((row) => (row.id === updated.id ? updated : row)),
        });
      }
      setCategoryId(String(updated.cue_category_id));
      setTitle(updated.title);
      setNotes(updated.notes ?? "");
      toast.success("Cue saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save cue"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [
    canUpdate,
    categoryId,
    cue,
    moment,
    momentId,
    notes,
    productionId,
    setMomentDetail,
    title,
    toast,
  ]);

  const discard = useCallback(() => {
    if (cue == null) return;
    setCategoryId(String(cue.cue_category_id));
    setTitle(cue.title);
    setNotes(cue.notes ?? "");
  }, [cue]);

  const controllers = useMemo(() => {
    if (cue == null) return null;
    return {
      title: `Cue · ${cue.title}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [canUpdate, cue, dirty, discard, save]);

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

  if (error || cue == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Cue not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="object-detail-cue-title">Title</Label>
        {canUpdate ? (
          <Input
            id="object-detail-cue-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={saving}
          />
        ) : (
          <p className="text-sm font-medium">{cue.title}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        {canUpdate ? (
          <Select value={categoryId} onValueChange={setCategoryId} disabled={saving}>
            <SelectTrigger id="object-detail-cue-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="mt-1">
            <ObjectLink
              objectType="cue_category"
              objectId={cue.cue_category_id}
              label={cue.cue_category_name}
            />
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-cue-notes">Notes</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-cue-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {cue.notes?.trim() ? cue.notes : "—"}
          </p>
        )}
      </div>
    </div>
  );
}
