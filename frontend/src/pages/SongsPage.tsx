import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import CatalogCsvImport from "@/components/CatalogCsvImport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { SongDetailResponse } from "@/lib/types";

export default function SongsPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();
  const toast = useToast();

  const [songs, setSongs] = useState<SongDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongDetailResponse | null>(null);
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [lyricist, setLyricist] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const songData = await api.listSongs(productionId);
      setSongs(songData);
    } catch (err) {
      setError(formatApiError(err, "Failed to load songs"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  function openCreateDialog() {
    setEditingSong(null);
    setTitle("");
    setComposer("");
    setLyricist("");
    setDescription("");
    setDialogOpen(true);
  }

  function openEditDialog(song: SongDetailResponse) {
    setEditingSong(song);
    setTitle(song.title);
    setComposer(song.composer ?? "");
    setLyricist(song.lyricist ?? "");
    setDescription(song.description ?? "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSong(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingSong && !title.trim()) return;

    setSaving(true);
    try {
      if (editingSong) {
        await api.updateSong(productionId, editingSong.id, {
          composer: composer.trim() || null,
          lyricist: lyricist.trim() || null,
          description: description.trim() || null,
        });
        toast.success("Song updated");
      } else {
        await api.createSong(productionId, {
          title: title.trim(),
          composer: composer.trim() || null,
          lyricist: lyricist.trim() || null,
        });
        toast.success("Song created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        formatApiError(
          err,
          editingSong ? "Failed to update song" : "Failed to create song",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <CatalogPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/productions/${productionId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Songs</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Manage songs and link them to timeline moments."
            : "Songs in this production."}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canManagePreparation && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={openCreateDialog}>
            Add song
          </Button>
          <CatalogCsvImport
            productionId={productionId}
            kind="songs"
            onImported={loadData}
          />
        </div>
      )}

      {songs.length === 0 ? (
        <EmptyState
          title="No songs yet"
          description="Add songs to the catalog, then link them to timeline moments."
          actionLabel={canManagePreparation ? "Add song" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Composer</TableHead>
                <TableHead>Lyricist</TableHead>
                {canManagePreparation && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((song) => (
                <TableRow key={song.id}>
                  <TableCell className="font-medium">{song.title}</TableCell>
                  <TableCell className="text-muted-foreground">{song.composer ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{song.lyricist ?? "—"}</TableCell>
                  {canManagePreparation && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditDialog(song)}
                        aria-label={`Edit ${song.title}`}
                        title="Edit"
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingSong(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editingSong ? "Edit song" : "Add song"}</DialogTitle>
              <DialogDescription>
                {editingSong
                  ? `Update details for "${editingSong.title}".`
                  : "Add a new song to the catalog."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {!editingSong && (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Song title"
                  autoFocus
                />
              )}
              <Input
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Composer (optional)"
                autoFocus={!!editingSong}
              />
              <Input
                value={lyricist}
                onChange={(e) => setLyricist(e.target.value)}
                placeholder="Lyricist (optional)"
              />
              {editingSong && (
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || (!editingSong && !title.trim())}
              >
                {editingSong ? "Save" : "Add song"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
