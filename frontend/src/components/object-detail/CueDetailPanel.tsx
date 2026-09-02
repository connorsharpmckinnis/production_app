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
import { api, formatApiError } from "@/lib/api";
import type { CueCategoryResponse, CueResponse } from "@/lib/types";

interface CueDetailPanelProps {
  cueId: number;
  momentId?: number;
}

export default function CueDetailPanel({ cueId, momentId }: CueDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("cues", "update");

  const [cue, setCue] = useState<CueResponse | null>(null);
  const [categories, setCategories] = useState<CueCategoryResponse[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (productionId == null) return;
    if (momentId == null) {
      setCue(null);
      setError("This cue needs a moment context to open.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [moment, categoryList] = await Promise.all([
        api.getMoment(productionId, momentId),
        api.listCueCategories(productionId),
      ]);
      const found = moment.cues.find((row) => row.id === cueId) ?? null;
      setCategories(categoryList);
      if (!found) {
        setCue(null);
        setError("Cue not found on this moment.");
        return;
      }
      setCue(found);
      setCategoryId(String(found.cue_category_id));
      setTitle(found.title);
      setNotes(found.notes ?? "");
    } catch (err) {
      setError(formatApiError(err, "Failed to load cue"));
      setCue(null);
    } finally {
      setLoading(false);
    }
  }, [cueId, momentId, productionId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setCue(updated);
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
  }, [canUpdate, categoryId, cue, momentId, notes, productionId, title, toast]);

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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
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
