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
  useSongsCatalog,
} from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";

interface SongDetailPanelProps {
  songId: number;
}

export default function SongDetailPanel({ songId }: SongDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("songs", "update");

  const catalogEnabled = productionId != null;
  const {
    data: list = [],
    isLoading,
    error: queryError,
  } = useSongsCatalog(productionId ?? 0, catalogEnabled);
  const { setSong: writeSong } = useCatalogWriteThrough(productionId ?? 0);

  const song = list.find((row) => row.id === songId) ?? null;
  const [composer, setComposer] = useState("");
  const [lyricist, setLyricist] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const songReady = song != null;
  useEffect(() => {
    if (song == null) return;
    setComposer(song.composer ?? "");
    setLyricist(song.lyricist ?? "");
    setDescription(song.description ?? "");
  }, [songId, songReady]); // eslint-disable-line react-hooks/exhaustive-deps -- seed on open only

  const loading = isLoading && song == null;
  const error =
    queryError != null
      ? formatApiError(queryError, "Failed to load song")
      : catalogEnabled && !isLoading && song == null
        ? "Song not found."
        : null;

  const dirty =
    song != null &&
    ((composer.trim() || "") !== (song.composer ?? "").trim() ||
      (lyricist.trim() || "") !== (song.lyricist ?? "").trim() ||
      (description.trim() || "") !== (song.description ?? "").trim());

  const save = useCallback(async () => {
    if (productionId == null || song == null || !canUpdate) return;
    setSaving(true);
    try {
      const updated = await api.updateSong(productionId, song.id, {
        composer: composer.trim() || null,
        lyricist: lyricist.trim() || null,
        description: description.trim() || null,
      });
      writeSong(updated);
      setComposer(updated.composer ?? "");
      setLyricist(updated.lyricist ?? "");
      setDescription(updated.description ?? "");
      toast.success("Song saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save song"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, composer, description, lyricist, productionId, song, toast, writeSong]);

  const discard = useCallback(() => {
    if (song == null) return;
    setComposer(song.composer ?? "");
    setLyricist(song.lyricist ?? "");
    setDescription(song.description ?? "");
  }, [song]);

  const controllers = useMemo(() => {
    if (song == null) return null;
    return {
      title: `Song · ${song.title}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [canUpdate, dirty, discard, save, song]);

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

  if (error || song == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Song not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Title
        </p>
        <p className="text-sm font-medium">{song.title}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-song-composer">Composer</Label>
        {canUpdate ? (
          <Input
            id="object-detail-song-composer"
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            disabled={saving}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{song.composer?.trim() || "—"}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-song-lyricist">Lyricist</Label>
        {canUpdate ? (
          <Input
            id="object-detail-song-lyricist"
            value={lyricist}
            onChange={(event) => setLyricist(event.target.value)}
            disabled={saving}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{song.lyricist?.trim() || "—"}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="object-detail-song-description">Description</Label>
        {canUpdate ? (
          <Textarea
            id="object-detail-song-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            disabled={saving}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {song.description?.trim() ? song.description : "—"}
          </p>
        )}
      </div>
    </div>
  );
}
