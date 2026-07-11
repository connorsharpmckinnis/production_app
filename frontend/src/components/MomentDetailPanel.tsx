import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Bookmark, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/api";
import type {
  AppSettingsResponse,
  CharacterDetailResponse,
  CueCategoryResponse,
  MicrophoneResponse,
  MomentDetailResponse,
  MomentTypeResponse,
  PropResponse,
  SetPieceResponse,
  SongDetailResponse,
} from "@/lib/types";
import { cn, momentTypeLabel } from "@/lib/utils";

export interface MomentDetailPanelHandle {
  flushPendingSaves: () => Promise<void>;
}

interface MomentDetailPanelProps {
  productionId: number;
  detail: MomentDetailResponse;
  canEdit: boolean;
  canChooseVisibility: boolean;
  characters: CharacterDetailResponse[];
  songs: SongDetailResponse[];
  propsCatalog: PropResponse[];
  microphonesCatalog: MicrophoneResponse[];
  setPiecesCatalog: SetPieceResponse[];
  cueCategories: CueCategoryResponse[];
  momentTypes: MomentTypeResponse[];
  appSettings: AppSettingsResponse;
  onDetailUpdate: (detail: MomentDetailResponse) => void;
  onChanged: () => void | Promise<void>;
  momentBadgeClass: (type: string) => string;
}

const MomentDetailPanel = forwardRef<MomentDetailPanelHandle, MomentDetailPanelProps>(
  function MomentDetailPanel(
    {
      productionId,
      detail,
      canEdit,
      canChooseVisibility,
      characters,
      songs,
      propsCatalog,
      microphonesCatalog,
      setPiecesCatalog,
      cueCategories,
      momentTypes,
      appSettings,
      onDetailUpdate,
      onChanged,
      momentBadgeClass,
    },
    ref,
  ) {
    const [noteContent, setNoteContent] = useState("");
    const [noteVisibility, setNoteVisibility] = useState<"public" | "private">("private");
    const [saving, setSaving] = useState(false);
    const [showParsedEdit, setShowParsedEdit] = useState(false);

    const [parsedText, setParsedText] = useState(detail.parsed_text ?? "");
    const [stageDirectionText, setStageDirectionText] = useState(detail.stage_direction ?? "");
    const [selectedTypeId, setSelectedTypeId] = useState(
      () => momentTypes.find((type) => type.name === detail.moment_type)?.id ?? "",
    );
    const [selectedSongId, setSelectedSongId] = useState(
      detail.song_id !== null ? String(detail.song_id) : "",
    );

    const [attachPropId, setAttachPropId] = useState("");
    const [attachPropCharacterId, setAttachPropCharacterId] = useState("");
    const [attachPropNotes, setAttachPropNotes] = useState("");

    const [attachMicId, setAttachMicId] = useState("");
    const [attachMicCharacterId, setAttachMicCharacterId] = useState("");
    const [attachMicNotes, setAttachMicNotes] = useState("");

    const [attachSetPieceId, setAttachSetPieceId] = useState("");
    const [attachSetPieceNotes, setAttachSetPieceNotes] = useState("");

    const [attachEntranceCharacterId, setAttachEntranceCharacterId] = useState("");
    const [attachEntranceNotes, setAttachEntranceNotes] = useState("");
    const [attachExitCharacterId, setAttachExitCharacterId] = useState("");
    const [attachExitNotes, setAttachExitNotes] = useState("");
    const [attachBlockingCharacterId, setAttachBlockingCharacterId] = useState("");
    const [attachBlockingNotes, setAttachBlockingNotes] = useState("");

    const [newCueCategoryId, setNewCueCategoryId] = useState("");
    const [newCueTitle, setNewCueTitle] = useState("");
    const [newCueNotes, setNewCueNotes] = useState("");
    const [addAttachmentType, setAddAttachmentType] = useState("");

    const detailRef = useRef(detail);
    detailRef.current = detail;

    const parsedDirty =
      parsedText !== (detail.parsed_text ?? "") ||
      String(selectedTypeId) !==
        String(momentTypes.find((type) => type.name === detail.moment_type)?.id ?? "") ||
      selectedSongId !== (detail.song_id !== null ? String(detail.song_id) : "");

    const stageDirty = stageDirectionText !== (detail.stage_direction ?? "");

    useEffect(() => {
      setParsedText(detail.parsed_text ?? "");
      setStageDirectionText(detail.stage_direction ?? "");
      setSelectedTypeId(
        momentTypes.find((type) => type.name === detail.moment_type)?.id ?? "",
      );
      setSelectedSongId(detail.song_id !== null ? String(detail.song_id) : "");
    }, [detail, momentTypes]);

    async function saveMomentFields(forceTypeChange = false) {
      if (!canEdit || (!parsedDirty && !forceTypeChange)) return;

      setSaving(true);
      try {
        const updated = await api.updateMoment(productionId, detail.id, {
          moment_type_id: selectedTypeId ? Number(selectedTypeId) : undefined,
          parsed_text: parsedText.trim() || null,
          song_id: selectedSongId ? Number(selectedSongId) : null,
          force_type_change: forceTypeChange || undefined,
        });
        onDetailUpdate(updated);
        await onChanged();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const proceed = confirm(
            `${String(err.detail)}\n\nChange the moment type anyway? Structured dialogue or stage direction data will be orphaned.`,
          );
          if (proceed) {
            await saveMomentFields(true);
            return;
          }
        } else {
          alert(err instanceof ApiError ? String(err.detail) : "Failed to save moment");
        }
      } finally {
        setSaving(false);
      }
    }

    async function saveStageDirection() {
      if (!canEdit || !stageDirty) return;
      if (!detail.stage_direction && !stageDirectionText.trim()) return;

      setSaving(true);
      try {
        const updated = await api.updateStageDirection(productionId, detail.id, {
          direction_text: stageDirectionText,
        });
        onDetailUpdate(updated);
        await onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to save stage direction");
      } finally {
        setSaving(false);
      }
    }

    useImperativeHandle(ref, () => ({
      flushPendingSaves: async () => {
        await saveMomentFields();
        await saveStageDirection();
      },
    }));

    async function handleBookmarkToggle() {
      setSaving(true);
      try {
        if (detail.is_bookmarked) {
          const bookmarks = await api.listBookmarks(productionId);
          const bookmark = bookmarks.find((item) => item.moment_id === detail.id);
          if (bookmark) {
            await api.deleteBookmark(bookmark.id);
          }
        } else {
          await api.createBookmark(detail.id);
        }
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Bookmark action failed");
      } finally {
        setSaving(false);
      }
    }

    async function handleAddNote(event: React.FormEvent) {
      event.preventDefault();
      if (!noteContent.trim()) return;

      setSaving(true);
      try {
        await api.createNote(productionId, {
          moment_id: detail.id,
          visibility: canChooseVisibility ? noteVisibility : "private",
          content: noteContent.trim(),
        });
        setNoteContent("");
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to add note");
      } finally {
        setSaving(false);
      }
    }

    async function handleDeleteNote(noteId: number) {
      setSaving(true);
      try {
        await api.deleteNote(productionId, noteId);
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to delete note");
      } finally {
        setSaving(false);
      }
    }

    async function handleDialogueCharacterChange(lineId: number, characterId: number) {
      setSaving(true);
      try {
        const updated = await api.updateDialogue(productionId, detail.id, lineId, {
          character_id: characterId,
        });
        onDetailUpdate(updated);
        await onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to update dialogue");
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachProp(event: React.FormEvent) {
      event.preventDefault();
      if (!attachPropId) return;

      setSaving(true);
      try {
        await api.attachMomentProp(productionId, detail.id, {
          prop_id: Number(attachPropId),
          character_id: attachPropCharacterId ? Number(attachPropCharacterId) : null,
          notes: attachPropNotes.trim() || null,
        });
        setAttachPropId("");
        setAttachPropCharacterId("");
        setAttachPropNotes("");
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to attach prop");
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachProp(momentPropId: number) {
      setSaving(true);
      try {
        await api.detachMomentProp(productionId, detail.id, momentPropId);
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to detach prop");
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachMicrophone(event: React.FormEvent) {
      event.preventDefault();
      if (!attachMicId) return;

      setSaving(true);
      try {
        await api.attachMomentMicrophone(productionId, detail.id, {
          microphone_id: Number(attachMicId),
          character_id: attachMicCharacterId ? Number(attachMicCharacterId) : null,
          notes: attachMicNotes.trim() || null,
        });
        setAttachMicId("");
        setAttachMicCharacterId("");
        setAttachMicNotes("");
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to attach microphone");
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachMicrophone(momentMicId: number) {
      setSaving(true);
      try {
        await api.detachMomentMicrophone(productionId, detail.id, momentMicId);
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to detach microphone");
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachSetPiece(event: React.FormEvent) {
      event.preventDefault();
      if (!attachSetPieceId) return;

      setSaving(true);
      try {
        await api.attachMomentSetPiece(productionId, detail.id, {
          set_piece_id: Number(attachSetPieceId),
          notes: attachSetPieceNotes.trim() || null,
        });
        setAttachSetPieceId("");
        setAttachSetPieceNotes("");
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to attach set piece");
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachSetPiece(momentSetPieceId: number) {
      setSaving(true);
      try {
        await api.detachMomentSetPiece(productionId, detail.id, momentSetPieceId);
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to detach set piece");
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachEntrance(event: React.FormEvent) {
      event.preventDefault();
      if (!attachEntranceCharacterId) return;

      setSaving(true);
      try {
        await api.attachMomentEntrance(productionId, detail.id, {
          character_id: Number(attachEntranceCharacterId),
          notes: attachEntranceNotes.trim() || null,
        });
        setAttachEntranceCharacterId("");
        setAttachEntranceNotes("");
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to attach entrance");
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachEntrance(entranceId: number) {
      setSaving(true);
      try {
        await api.detachMomentEntrance(productionId, detail.id, entranceId);
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to detach entrance");
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachExit(event: React.FormEvent) {
      event.preventDefault();
      if (!attachExitCharacterId) return;

      setSaving(true);
      try {
        await api.attachMomentExit(productionId, detail.id, {
          character_id: Number(attachExitCharacterId),
          notes: attachExitNotes.trim() || null,
        });
        setAttachExitCharacterId("");
        setAttachExitNotes("");
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to attach exit");
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachExit(exitId: number) {
      setSaving(true);
      try {
        await api.detachMomentExit(productionId, detail.id, exitId);
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to detach exit");
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachBlocking(event: React.FormEvent) {
      event.preventDefault();
      if (!attachBlockingCharacterId || !attachBlockingNotes.trim()) return;

      setSaving(true);
      try {
        await api.attachMomentBlocking(productionId, detail.id, {
          character_id: Number(attachBlockingCharacterId),
          notes: attachBlockingNotes.trim(),
        });
        setAttachBlockingCharacterId("");
        setAttachBlockingNotes("");
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to attach blocking");
      } finally {
        setSaving(false);
      }
    }

    async function handleUpdateBlockingNotes(blockingId: number, notes: string) {
      const trimmed = notes.trim();
      if (!trimmed) return;

      setSaving(true);
      try {
        await api.updateMomentBlocking(productionId, detail.id, blockingId, { notes: trimmed });
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to update blocking");
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachBlocking(blockingId: number) {
      setSaving(true);
      try {
        await api.detachMomentBlocking(productionId, detail.id, blockingId);
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to detach blocking");
      } finally {
        setSaving(false);
      }
    }

    async function handleAddCue(event: React.FormEvent) {
      event.preventDefault();
      if (!newCueCategoryId || !newCueTitle.trim()) return;

      setSaving(true);
      try {
        await api.createMomentCue(productionId, detail.id, {
          cue_category_id: Number(newCueCategoryId),
          title: newCueTitle.trim(),
          notes: newCueNotes.trim() || null,
        });
        setNewCueTitle("");
        setNewCueNotes("");
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to add cue");
      } finally {
        setSaving(false);
      }
    }

    async function handleDeleteCue(cueId: number) {
      setSaving(true);
      try {
        await api.deleteMomentCue(productionId, detail.id, cueId);
        onChanged();
      } catch (err) {
        alert(err instanceof ApiError ? String(err.detail) : "Failed to delete cue");
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="space-y-4">
        <SheetHeader className="p-0">
          <SheetDescription>Moment #{detail.sequence_number}</SheetDescription>
          <div className="flex items-center gap-2">
            <SheetTitle className="sr-only">Moment {detail.sequence_number}</SheetTitle>
            <Badge className={cn("capitalize", momentBadgeClass(detail.moment_type))}>
              {momentTypeLabel(detail.moment_type)}
            </Badge>
            {saving && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
          </div>
        </SheetHeader>

        <Button
          type="button"
          variant={detail.is_bookmarked ? "default" : "outline"}
          size="icon-sm"
          disabled={saving}
          onClick={() => void handleBookmarkToggle()}
          aria-label={detail.is_bookmarked ? "Remove bookmark" : "Bookmark this moment"}
          title={detail.is_bookmarked ? "Remove bookmark" : "Bookmark this moment"}
        >
          <Bookmark className={detail.is_bookmarked ? "fill-current" : undefined} />
        </Button>

        {appSettings.show_original_text && (
          <div>
            <h3 className="text-sm font-medium">Original text</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {detail.original_text}
            </p>
          </div>
        )}

        {canEdit && (
          <div className="space-y-3">
            <label className="block text-xs text-muted-foreground">
              Linked song
              <select
                value={selectedSongId}
                onChange={(e) => setSelectedSongId(e.target.value)}
                onBlur={() => void saveMomentFields()}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {songs.map((song) => (
                  <option key={song.id} value={String(song.id)}>
                    {song.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Imported data</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowParsedEdit((open) => !open)}
                  aria-label="Toggle imported data editor"
                  title="Edit imported data"
                >
                  <Pencil />
                </Button>
              </div>

              {showParsedEdit && (
                <div className="mt-3 space-y-3">
                  <label className="block text-xs text-muted-foreground">
                    Moment type
                    <select
                      value={selectedTypeId}
                      onChange={(e) => setSelectedTypeId(e.target.value)}
                      onBlur={() => void saveMomentFields()}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {momentTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {momentTypeLabel(type.name as MomentDetailResponse["moment_type"])}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs text-muted-foreground">
                    Imported text
                    <textarea
                      value={parsedText}
                      onChange={(e) => setParsedText(e.target.value)}
                      onBlur={() => void saveMomentFields()}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {!canEdit && appSettings.show_parsed_text && detail.parsed_text && (
          <div>
            <h3 className="text-sm font-medium">Imported text</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {detail.parsed_text}
            </p>
          </div>
        )}

        {detail.moment_type === "stage_direction" && (detail.stage_direction || canEdit) && (
          <div>
            <h3 className="text-sm font-medium">Stage direction</h3>
            {canEdit ? (
              <textarea
                value={stageDirectionText}
                onChange={(e) => setStageDirectionText(e.target.value)}
                onBlur={() => void saveStageDirection()}
                rows={3}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            ) : (
              <p className="mt-1 text-sm">{detail.stage_direction}</p>
            )}
          </div>
        )}

        {detail.moment_type !== "stage_direction" && detail.dialogue.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Dialogue</h3>
            <ul className="mt-2 space-y-2">
              {detail.dialogue.map((line) => (
                <li key={line.id} className="text-sm">
                  {canEdit ? (
                    <div className="flex flex-col gap-1">
                      <select
                        value={line.character_id}
                        disabled={saving}
                        onChange={(e) =>
                          void handleDialogueCharacterChange(line.id, Number(e.target.value))
                        }
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        {characters.map((character) => (
                          <option key={character.id} value={character.id}>
                            {character.name}
                          </option>
                        ))}
                      </select>
                      <span>{line.dialogue_text}</span>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{line.character_name}:</span>{" "}
                      {line.dialogue_text}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {detail.song_title && !canEdit && (
          <div>
            <h3 className="text-sm font-medium">Song</h3>
            <p className="mt-1 text-sm">{detail.song_title}</p>
          </div>
        )}

        {canEdit && (
          <div className="rounded-md border border-border p-3">
            <label className="block text-sm font-medium">
              Add to moment
              <select
                value={addAttachmentType}
                onChange={(e) => setAddAttachmentType(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Choose attachment type…</option>
                {propsCatalog.length > 0 && <option value="prop">Prop</option>}
                {cueCategories.length > 0 && <option value="cue">Cue</option>}
                {microphonesCatalog.length > 0 && <option value="microphone">Microphone</option>}
                {setPiecesCatalog.length > 0 && <option value="set_piece">Set piece</option>}
                {characters.length > 0 && <option value="entrance">Entrance</option>}
                {characters.length > 0 && <option value="exit">Exit</option>}
                {characters.length > 0 && <option value="blocking">Blocking</option>}
              </select>
            </label>

            {addAttachmentType === "prop" && propsCatalog.length > 0 && (
              <form onSubmit={(e) => void handleAttachProp(e)} className="mt-3 space-y-2">
                <select
                  value={attachPropId}
                  onChange={(e) => {
                    setAttachPropId(e.target.value);
                    if (!e.target.value) {
                      setAttachPropCharacterId("");
                      setAttachPropNotes("");
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select prop…</option>
                  {propsCatalog.map((prop) => (
                    <option key={prop.id} value={String(prop.id)}>
                      {prop.name}
                    </option>
                  ))}
                </select>
                {attachPropId && (
                  <>
                    <select
                      value={attachPropCharacterId}
                      onChange={(e) => setAttachPropCharacterId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">No carrier character</option>
                      {characters.map((character) => (
                        <option key={character.id} value={String(character.id)}>
                          {character.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={attachPropNotes}
                      onChange={(e) => setAttachPropNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </>
                )}
                <button
                  type="submit"
                  disabled={saving || !attachPropId}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Attach prop
                </button>
              </form>
            )}

            {addAttachmentType === "cue" && cueCategories.length > 0 && (
              <form onSubmit={(e) => void handleAddCue(e)} className="mt-3 space-y-2">
                <select
                  value={newCueCategoryId}
                  onChange={(e) => {
                    setNewCueCategoryId(e.target.value);
                    if (!e.target.value) {
                      setNewCueTitle("");
                      setNewCueNotes("");
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select category…</option>
                  {cueCategories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {newCueCategoryId && (
                  <>
                    <input
                      value={newCueTitle}
                      onChange={(e) => setNewCueTitle(e.target.value)}
                      placeholder="Cue title"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <input
                      value={newCueNotes}
                      onChange={(e) => setNewCueNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </>
                )}
                <button
                  type="submit"
                  disabled={saving || !newCueCategoryId || !newCueTitle.trim()}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Add cue
                </button>
              </form>
            )}

            {addAttachmentType === "microphone" && microphonesCatalog.length > 0 && (
              <form onSubmit={(e) => void handleAttachMicrophone(e)} className="mt-3 space-y-2">
                <select
                  value={attachMicId}
                  onChange={(e) => {
                    setAttachMicId(e.target.value);
                    if (!e.target.value) {
                      setAttachMicCharacterId("");
                      setAttachMicNotes("");
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select microphone…</option>
                  {microphonesCatalog.map((mic) => (
                    <option key={mic.id} value={String(mic.id)}>
                      {mic.identifier}
                    </option>
                  ))}
                </select>
                {attachMicId && (
                  <>
                    <select
                      value={attachMicCharacterId}
                      onChange={(e) => setAttachMicCharacterId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">No wearer character</option>
                      {characters.map((character) => (
                        <option key={character.id} value={String(character.id)}>
                          {character.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={attachMicNotes}
                      onChange={(e) => setAttachMicNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </>
                )}
                <button
                  type="submit"
                  disabled={saving || !attachMicId}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Attach microphone
                </button>
              </form>
            )}

            {addAttachmentType === "set_piece" && setPiecesCatalog.length > 0 && (
              <form onSubmit={(e) => void handleAttachSetPiece(e)} className="mt-3 space-y-2">
                <select
                  value={attachSetPieceId}
                  onChange={(e) => {
                    setAttachSetPieceId(e.target.value);
                    if (!e.target.value) setAttachSetPieceNotes("");
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select set piece…</option>
                  {setPiecesCatalog.map((piece) => (
                    <option key={piece.id} value={String(piece.id)}>
                      {piece.name}
                    </option>
                  ))}
                </select>
                {attachSetPieceId && (
                  <input
                    value={attachSetPieceNotes}
                    onChange={(e) => setAttachSetPieceNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                )}
                <button
                  type="submit"
                  disabled={saving || !attachSetPieceId}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Attach set piece
                </button>
              </form>
            )}

            {addAttachmentType === "entrance" && characters.length > 0 && (
              <form onSubmit={(e) => void handleAttachEntrance(e)} className="mt-3 space-y-2">
                <select
                  value={attachEntranceCharacterId}
                  onChange={(e) => {
                    setAttachEntranceCharacterId(e.target.value);
                    if (!e.target.value) setAttachEntranceNotes("");
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select character…</option>
                  {characters.map((character) => (
                    <option key={character.id} value={String(character.id)}>
                      {character.name}
                    </option>
                  ))}
                </select>
                {attachEntranceCharacterId && (
                  <input
                    value={attachEntranceNotes}
                    onChange={(e) => setAttachEntranceNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                )}
                <button
                  type="submit"
                  disabled={saving || !attachEntranceCharacterId}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Add entrance
                </button>
              </form>
            )}

            {addAttachmentType === "exit" && characters.length > 0 && (
              <form onSubmit={(e) => void handleAttachExit(e)} className="mt-3 space-y-2">
                <select
                  value={attachExitCharacterId}
                  onChange={(e) => {
                    setAttachExitCharacterId(e.target.value);
                    if (!e.target.value) setAttachExitNotes("");
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select character…</option>
                  {characters.map((character) => (
                    <option key={character.id} value={String(character.id)}>
                      {character.name}
                    </option>
                  ))}
                </select>
                {attachExitCharacterId && (
                  <input
                    value={attachExitNotes}
                    onChange={(e) => setAttachExitNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                )}
                <button
                  type="submit"
                  disabled={saving || !attachExitCharacterId}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Add exit
                </button>
              </form>
            )}

            {addAttachmentType === "blocking" && characters.length > 0 && (
              <form onSubmit={(e) => void handleAttachBlocking(e)} className="mt-3 space-y-2">
                <select
                  value={attachBlockingCharacterId}
                  onChange={(e) => setAttachBlockingCharacterId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select character…</option>
                  {characters.map((character) => (
                    <option key={character.id} value={String(character.id)}>
                      {character.name}
                    </option>
                  ))}
                </select>
                {attachBlockingCharacterId && (
                  <textarea
                    value={attachBlockingNotes}
                    onChange={(e) => setAttachBlockingNotes(e.target.value)}
                    placeholder="Blocking notes"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                  />
                )}
                <button
                  type="submit"
                  disabled={
                    saving || !attachBlockingCharacterId || !attachBlockingNotes.trim()
                  }
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Add blocking
                </button>
              </form>
            )}
          </div>
        )}

        <AttachmentSection
          title="Props"
          emptyMessage="No props attached."
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={canEdit}
          items={detail.props.map((prop) => ({
            id: prop.id,
            label: prop.prop_name,
            sublabel: prop.character_name ?? undefined,
            notes: prop.notes ?? undefined,
          }))}
          onDetach={handleDetachProp}
          catalogLength={propsCatalog.length}
        />

        <AttachmentSection
          title="Microphones"
          emptyMessage="No microphones attached."
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={canEdit}
          items={detail.microphones.map((mic) => ({
            id: mic.id,
            label: mic.microphone_identifier,
            sublabel: mic.character_name ?? undefined,
            notes: mic.notes ?? undefined,
          }))}
          onDetach={handleDetachMicrophone}
          catalogLength={microphonesCatalog.length}
        />

        <AttachmentSection
          title="Set pieces"
          emptyMessage="No set pieces attached."
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={canEdit}
          items={detail.set_pieces.map((piece) => ({
            id: piece.id,
            label: piece.set_piece_name,
            notes: piece.notes ?? undefined,
          }))}
          onDetach={handleDetachSetPiece}
          catalogLength={setPiecesCatalog.length}
        />

        <AttachmentSection
          title="Entrances"
          emptyMessage="No entrances recorded."
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={canEdit}
          items={detail.entrances.map((entrance) => ({
            id: entrance.id,
            label: entrance.character_name,
            notes: entrance.notes ?? undefined,
          }))}
          onDetach={handleDetachEntrance}
          catalogLength={characters.length}
        />

        <AttachmentSection
          title="Exits"
          emptyMessage="No exits recorded."
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={canEdit}
          items={detail.exits.map((exitRow) => ({
            id: exitRow.id,
            label: exitRow.character_name,
            notes: exitRow.notes ?? undefined,
          }))}
          onDetach={handleDetachExit}
          catalogLength={characters.length}
        />

        <AttachmentSection
          title="Blocking"
          emptyMessage="No blocking notes."
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={canEdit}
          items={detail.blocking.map((row) => ({
            id: row.id,
            label: row.character_name,
            notes: row.notes ?? undefined,
            editableNotes: canEdit,
            onNotesBlur: (notes: string) => {
              if (notes.trim() !== (row.notes ?? "")) {
                void handleUpdateBlockingNotes(row.id, notes);
              }
            },
          }))}
          onDetach={handleDetachBlocking}
          catalogLength={characters.length}
        />

        <AttachmentSection
          title="Cues"
          emptyMessage="No cues attached."
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={canEdit}
          items={detail.cues.map((cue) => ({
            id: cue.id,
            label: cue.title,
            sublabel: cue.cue_category_name,
            notes: cue.notes ?? undefined,
          }))}
          onDetach={handleDeleteCue}
          catalogLength={cueCategories.length}
        />

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-medium">Notes</h3>
          {detail.notes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {detail.notes.map((note) => (
                <li key={note.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{note.author_display_name}</span>
                    <Badge variant="secondary">{note.visibility}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
                  {note.is_mine && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleDeleteNote(note.id)}
                      className="mt-2 text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={(e) => void handleAddNote(e)} className="mt-4 space-y-2">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {canChooseVisibility && (
              <select
                value={noteVisibility}
                onChange={(e) => setNoteVisibility(e.target.value as "public" | "private")}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            )}
            <button
              type="submit"
              disabled={saving || !noteContent.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Add note
            </button>
          </form>
        </div>
      </div>
    );
  },
);

function AttachmentSection({
  title,
  emptyMessage,
  canEdit,
  saving,
  items,
  onDetach,
  catalogLength,
  defaultExpanded = true,
  attachForm,
}: {
  title: string;
  emptyMessage: string;
  canEdit: boolean;
  saving: boolean;
  items: {
    id: number;
    label: string;
    sublabel?: string;
    notes?: string;
    editableNotes?: boolean;
    onNotesBlur?: (notes: string) => void;
  }[];
  onDetach: (id: number) => void;
  catalogLength: number;
  defaultExpanded?: boolean;
  attachForm?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasContent = items.length > 0;

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {hasContent ? `${items.length}` : "—"} {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded && (
        <>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border border-border p-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-medium">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-muted-foreground"> — {item.sublabel}</span>
                      )}
                      {item.editableNotes && canEdit ? (
                        <textarea
                          defaultValue={item.notes}
                          disabled={saving}
                          onBlur={(e) => item.onNotesBlur?.(e.target.value)}
                          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          rows={2}
                        />
                      ) : (
                        item.notes && (
                          <p className="mt-1 text-muted-foreground">{item.notes}</p>
                        )
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={saving}
                        onClick={() => onDetach(item.id)}
                        aria-label={`Remove ${title.toLowerCase()}`}
                        title={`Remove ${title.toLowerCase()}`}
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

          {canEdit && catalogLength > 0 && attachForm && (
            <div className="mt-3">{attachForm}</div>
          )}
        </>
      )}
    </div>
  );
}

export default MomentDetailPanel;
