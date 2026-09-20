import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import AttributionInfo from "@/components/AttributionInfo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import { api, formatApiError } from "@/lib/api";
import type { NoteResponse } from "@/lib/types";

interface Props {
  productionId: number;
  momentId?: number;
  characterId?: number;
  rehearsalId?: number;
  sessionOnly?: boolean;
  canPublish: boolean;
  canDeleteAny?: boolean;
  title?: string;
}

export default function NotesPanel({
  productionId,
  momentId,
  characterId,
  rehearsalId,
  sessionOnly = false,
  canPublish,
  canDeleteAny = false,
  title = "Notes",
}: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [notes, setNotes] = useState<NoteResponse[]>([]);
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.listNotes(productionId, {
        momentId,
        characterId,
        rehearsalId,
        sessionOnly,
      });
      setNotes(rows);
    } catch (err) {
      toast.error(formatApiError(err, "Failed to load notes"));
    } finally {
      setLoading(false);
    }
  }, [productionId, momentId, characterId, rehearsalId, sessionOnly, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      await api.createNote(productionId, {
        moment_id: momentId,
        character_id: characterId,
        rehearsal_id: rehearsalId,
        visibility: canPublish && isPublic ? "public" : "private",
        content: content.trim(),
      });
      setContent("");
      setIsPublic(false);
      await load();
      toast.success("Note added");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to add note"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(note: NoteResponse) {
    const ok = await confirm({
      title: "Delete this note?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteNote(productionId, note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete note"));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {note.visibility === "public" ? "Public" : "Only me"}
                    </Badge>
                    <AttributionInfo
                      createdBy={note.author_display_name}
                      createdAt={note.created_at}
                      updatedBy={note.updated_by_display_name}
                      updatedAt={note.updated_at}
                      rehearsalId={note.rehearsal_id}
                      productionId={productionId}
                    />
                  </div>
                </div>
                {(note.is_mine || canDeleteAny) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void handleDelete(note)}
                    aria-label="Delete note"
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(event) => void handleAdd(event)} className="flex flex-col gap-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Add a note"
          rows={3}
          disabled={saving}
        />
        <div className="flex items-center justify-between gap-3">
          {canPublish ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                disabled={saving}
              />
              Public
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={saving || !content.trim()}>
            Add note
          </Button>
        </div>
      </form>
    </div>
  );
}
