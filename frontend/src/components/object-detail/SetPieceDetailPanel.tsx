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
import {
  useCatalogWriteThrough,
  useSetPiecesCatalog,
} from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";

interface SetPieceDetailPanelProps {
  setPieceId: number;
}

export default function SetPieceDetailPanel({ setPieceId }: SetPieceDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("set_pieces", "update");

  const catalogEnabled = productionId != null;
  const {
    data: list = [],
    isLoading,
    error: queryError,
  } = useSetPiecesCatalog(productionId ?? 0, catalogEnabled);
  const { setSetPiece: writeSetPiece } = useCatalogWriteThrough(productionId ?? 0);

  const piece = list.find((row) => row.id === setPieceId) ?? null;
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const pieceReady = piece != null;
  useEffect(() => {
    if (piece == null) return;
    setName(piece.name);
    setMobile(piece.mobile);
    setDescription(piece.description ?? "");
  }, [setPieceId, pieceReady]); // eslint-disable-line react-hooks/exhaustive-deps -- seed on open only

  const loading = isLoading && piece == null;
  const error =
    queryError != null
      ? formatApiError(queryError, "Failed to load set piece")
      : catalogEnabled && !isLoading && piece == null
        ? "Set piece not found."
        : null;

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
      writeSetPiece(updated);
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
  }, [canUpdate, description, mobile, name, piece, productionId, toast, writeSetPiece]);

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
