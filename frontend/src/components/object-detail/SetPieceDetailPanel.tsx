import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRegisterObjectDetailPanel } from "@/components/object-detail/useRegisterObjectDetailPanel";
import { useObjectDetailInternal } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { SetPieceResponse } from "@/lib/types";

interface SetPieceDetailPanelProps {
  setPieceId: number;
}

export default function SetPieceDetailPanel({ setPieceId }: SetPieceDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("set_pieces", "update");

  const [piece, setPiece] = useState<SetPieceResponse | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (productionId == null) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.listSetPieces(productionId);
      const found = list.find((row) => row.id === setPieceId) ?? null;
      if (!found) {
        setPiece(null);
        setError("Set piece not found.");
        return;
      }
      setPiece(found);
      setName(found.name);
      setMobile(found.mobile);
      setDescription(found.description ?? "");
    } catch (err) {
      setError(formatApiError(err, "Failed to load set piece"));
      setPiece(null);
    } finally {
      setLoading(false);
    }
  }, [productionId, setPieceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    piece != null &&
    (name.trim() !== piece.name.trim() ||
      mobile !== piece.mobile ||
      (description.trim() || "") !== (piece.description ?? "").trim());

  const save = useCallback(async () => {
    if (productionId == null || piece == null || !canUpdate) return;
    if (!name.trim()) {
      toast.error("Name is required");
      throw new Error("Name is required");
    }
    setSaving(true);
    try {
      const updated = await api.updateSetPiece(productionId, piece.id, {
        name: name.trim(),
        mobile,
        description: description.trim() || null,
      });
      setPiece(updated);
      setName(updated.name);
      setMobile(updated.mobile);
      setDescription(updated.description ?? "");
      toast.success("Set piece saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save set piece"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, description, mobile, name, piece, productionId, toast]);

  const discard = useCallback(() => {
    if (piece == null) return;
    setName(piece.name);
    setMobile(piece.mobile);
    setDescription(piece.description ?? "");
  }, [piece]);

  const controllers = useMemo(() => {
    if (piece == null) return null;
    return {
      title: `Set piece · ${piece.name}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [canUpdate, dirty, discard, piece, save]);

  useRegisterObjectDetailPanel(controllers);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || piece == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Set piece not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="object-detail-set-piece-name">Name</Label>
        {canUpdate ? (
          <Input
            id="object-detail-set-piece-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
          />
        ) : (
          <p className="text-sm font-medium">{piece.name}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {canUpdate ? (
          <>
            <Checkbox
              id="object-detail-set-piece-mobile"
              checked={mobile}
              disabled={saving}
              onCheckedChange={(checked) => setMobile(checked === true)}
            />
            <Label htmlFor="object-detail-set-piece-mobile">Mobile</Label>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {piece.mobile ? "Mobile" : "Not mobile"}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-set-piece-description">Description</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-set-piece-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {piece.description?.trim() ? piece.description : "—"}
          </p>
        )}
      </div>
    </div>
  );
}
