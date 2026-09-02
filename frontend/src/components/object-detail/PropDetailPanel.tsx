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
import type { PropResponse } from "@/lib/types";

interface PropDetailPanelProps {
  propId: number;
}

export default function PropDetailPanel({ propId }: PropDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("props", "update");

  const [prop, setProp] = useState<PropResponse | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (productionId == null) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.listProps(productionId);
      const found = list.find((row) => row.id === propId) ?? null;
      if (!found) {
        setProp(null);
        setError("Prop not found.");
        return;
      }
      setProp(found);
      setName(found.name);
      setDescription(found.description ?? "");
      setNotes(found.notes ?? "");
    } catch (err) {
      setError(formatApiError(err, "Failed to load prop"));
      setProp(null);
    } finally {
      setLoading(false);
    }
  }, [productionId, propId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    prop != null &&
    (name.trim() !== prop.name.trim() ||
      (description.trim() || "") !== (prop.description ?? "").trim() ||
      (notes.trim() || "") !== (prop.notes ?? "").trim());

  const save = useCallback(async () => {
    if (productionId == null || prop == null || !canUpdate) return;
    if (!name.trim()) {
      toast.error("Name is required");
      throw new Error("Name is required");
    }
    setSaving(true);
    try {
      const updated = await api.updateProp(productionId, prop.id, {
        name: name.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
      });
      setProp(updated);
      setName(updated.name);
      setDescription(updated.description ?? "");
      setNotes(updated.notes ?? "");
      toast.success("Prop saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save prop"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, description, name, notes, productionId, prop, toast]);

  const discard = useCallback(() => {
    if (prop == null) return;
    setName(prop.name);
    setDescription(prop.description ?? "");
    setNotes(prop.notes ?? "");
  }, [prop]);

  const controllers = useMemo(() => {
    if (prop == null) return null;
    return {
      title: `Prop · ${prop.name}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [canUpdate, dirty, discard, prop, save]);

  useRegisterObjectDetailPanel(controllers);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || prop == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Prop not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="object-detail-prop-name">Name</Label>
        {canUpdate ? (
          <Input
            id="object-detail-prop-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
          />
        ) : (
          <p className="text-sm font-medium">{prop.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-prop-description">Description</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-prop-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {prop.description?.trim() ? prop.description : "—"}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-prop-notes">Notes</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-prop-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {prop.notes?.trim() ? prop.notes : "—"}
          </p>
        )}
      </div>
    </div>
  );
}
