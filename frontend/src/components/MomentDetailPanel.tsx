import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Layers,
  LogIn,
  LogOut,
  Move,
  Package,
  Pencil,
  Shirt,
  Trash2,
  Zap,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import type { SearchableSelectOption } from "@/components/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, ApiError, formatApiError } from "@/lib/api";
import { formatMomentCode, humanTimelinePath } from "@/lib/timelineDeepLinks";
import type {
  AppSettingsResponse,
  AssetEventKind,
  CastableUserResponse,
  CharacterDetailResponse,
  CostumeResponse,
  CostumeWearingResponse,
  CueCategoryResponse,
  MomentCostumeEventResponse,
  MomentDetailResponse,
  MomentTypeResponse,
  PropResponse,
  SetPieceResponse,
  SongDetailResponse,
} from "@/lib/types";
import { cn, momentTypeLabel, sortByName } from "@/lib/utils";

/** Radix Select cannot use an empty string value, so "no song" needs a sentinel. */
const NO_SONG_VALUE = "__none__";

type PersonType = "none" | "character" | "user";

function personTypeOf(characterId: number | null, userId: number | null): PersonType {
  if (characterId !== null) return "character";
  if (userId !== null) return "user";
  return "none";
}

function encodePersonValue(
  personType: PersonType,
  characterId: string,
  userId: string,
): string {
  if (personType === "character" && characterId) return `character:${characterId}`;
  if (personType === "user" && userId) return `user:${userId}`;
  return "";
}

function decodePersonValue(value: string): {
  personType: PersonType;
  characterId: string;
  userId: string;
} {
  if (value.startsWith("character:")) {
    return { personType: "character", characterId: value.slice("character:".length), userId: "" };
  }
  if (value.startsWith("user:")) {
    return { personType: "user", characterId: "", userId: value.slice("user:".length) };
  }
  return { personType: "none", characterId: "", userId: "" };
}

function buildPersonOptions(
  characters: CharacterDetailResponse[],
  users: CastableUserResponse[],
): SearchableSelectOption[] {
  const characterOptions = characters.map((character) => ({
    value: `character:${character.id}`,
    label: character.name,
    hint: "Character",
    keywords: "character",
  }));
  const userOptions = users.map((user) => ({
    value: `user:${user.id}`,
    label: user.display_name,
    hint: "User",
    keywords: "user",
  }));
  return [...characterOptions, ...userOptions].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

function KindToggle({
  value,
  onChange,
  onLabel = "On",
  offLabel = "Off",
  disabled = false,
}: {
  value: AssetEventKind;
  onChange: (kind: AssetEventKind) => void;
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("on")}
        className={cn(
          "rounded-sm px-3 py-1.5 text-sm outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
          value === "on" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        )}
      >
        {onLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("off")}
        className={cn(
          "rounded-sm px-3 py-1.5 text-sm outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
          value === "off" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        )}
      >
        {offLabel}
      </button>
    </div>
  );
}

type AttachmentType =
  | "prop"
  | "cue"
  | "set_piece"
  | "costume"
  | "entrance"
  | "exit"
  | "blocking";

const ATTACHMENT_TYPE_OPTIONS: {
  value: AttachmentType;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "prop", label: "Prop", icon: Package },
  { value: "set_piece", label: "Set", icon: Layers },
  { value: "costume", label: "Costume", icon: Shirt },
  { value: "cue", label: "Cue", icon: Zap },
  { value: "entrance", label: "Entrance", icon: LogIn },
  { value: "exit", label: "Exit", icon: LogOut },
  { value: "blocking", label: "Blocking", icon: Move },
];

function costumesPagePath(productionId: number, detail: MomentDetailResponse): string {
  const params = new URLSearchParams();
  if (detail.dialogue.length === 1) {
    params.set("characterId", String(detail.dialogue[0].character_id));
  }
  const query = params.toString();
  return `/productions/${productionId}/costumes${query ? `?${query}` : ""}`;
}

export interface MomentDetailPanelHandle {
  flushPendingSaves: () => Promise<void>;
}

interface MomentDetailPanelProps {
  productionId: number;
  detail: MomentDetailResponse;
  sceneId: number | null;
  canEdit: boolean;
  canChooseVisibility: boolean;
  characters: CharacterDetailResponse[];
  castableUsers: CastableUserResponse[];
  songs: SongDetailResponse[];
  propsCatalog: PropResponse[];
  setPiecesCatalog: SetPieceResponse[];
  costumesCatalog: CostumeResponse[];
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
      castableUsers,
      songs,
      propsCatalog,
      setPiecesCatalog,
      costumesCatalog,
      cueCategories,
      momentTypes,
      appSettings,
      onDetailUpdate,
      onChanged,
      momentBadgeClass,
    },
    ref,
  ) {
    const confirm = useConfirm();
    const toast = useToast();

    const sortedCharacters = sortByName(characters);
    const sortedCastableUsers = [...castableUsers].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
    );
    const personOptions = useMemo(
      () => buildPersonOptions(sortByName(characters), [...castableUsers]),
      [characters, castableUsers],
    );
    const characterOptions = useMemo(
      () =>
        sortByName(characters).map((character) => ({
          value: String(character.id),
          label: character.name,
        })),
      [characters],
    );
    const propOptions = useMemo(
      () => propsCatalog.map((prop) => ({ value: String(prop.id), label: prop.name })),
      [propsCatalog],
    );
    const setPieceOptions = useMemo(
      () =>
        setPiecesCatalog.map((piece) => ({ value: String(piece.id), label: piece.name })),
      [setPiecesCatalog],
    );
    const cueCategoryOptions = useMemo(
      () =>
        cueCategories.map((category) => ({
          value: String(category.id),
          label: category.name,
        })),
      [cueCategories],
    );
    const costumeOptions = useMemo(
      () =>
        costumesCatalog.map((costume) => ({
          value: String(costume.id),
          label: costume.name,
          hint: costume.character_name,
          keywords: costume.character_name,
        })),
      [costumesCatalog],
    );

    const availableAttachmentTypes = useMemo(() => {
      const available = new Set<AttachmentType>();
      if (propsCatalog.length > 0) available.add("prop");
      if (setPiecesCatalog.length > 0) available.add("set_piece");
      if (costumesCatalog.length > 0 && characters.length > 0) available.add("costume");
      if (cueCategories.length > 0) available.add("cue");
      if (characters.length > 0) {
        available.add("entrance");
        available.add("exit");
        available.add("blocking");
      }
      return ATTACHMENT_TYPE_OPTIONS.filter((option) => available.has(option.value));
    }, [
      propsCatalog.length,
      setPiecesCatalog.length,
      costumesCatalog.length,
      cueCategories.length,
      characters.length,
    ]);

    const isSongRelated =
      detail.song_id != null ||
      detail.moment_type === "song_header" ||
      detail.moment_type === "song_attribution" ||
      detail.moment_type === "lyric";

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
    const [attachPropKind, setAttachPropKind] = useState<AssetEventKind>("on");
    const [attachPropPersonType, setAttachPropPersonType] = useState<PersonType>("none");
    const [attachPropCharacterId, setAttachPropCharacterId] = useState("");
    const [attachPropUserId, setAttachPropUserId] = useState("");
    const [attachPropNotes, setAttachPropNotes] = useState("");
    const [propsExpandSignal, setPropsExpandSignal] = useState(0);

    const [attachSetPieceId, setAttachSetPieceId] = useState("");
    const [attachSetPieceKind, setAttachSetPieceKind] = useState<AssetEventKind>("on");
    const [attachSetPiecePersonType, setAttachSetPiecePersonType] = useState<PersonType>("none");
    const [attachSetPieceCharacterId, setAttachSetPieceCharacterId] = useState("");
    const [attachSetPieceUserId, setAttachSetPieceUserId] = useState("");
    const [attachSetPieceNotes, setAttachSetPieceNotes] = useState("");
    const [setPiecesExpandSignal, setSetPiecesExpandSignal] = useState(0);

    const [attachCostumeCharacterId, setAttachCostumeCharacterId] = useState("");
    const [attachCostumeKind, setAttachCostumeKind] = useState<AssetEventKind>("on");
    const [attachCostumeId, setAttachCostumeId] = useState("");
    const [attachCostumeNotes, setAttachCostumeNotes] = useState("");

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
    const [addSectionExpanded, setAddSectionExpanded] = useState(true);

    function resetAttachmentDraft() {
      setAttachPropId("");
      setAttachPropKind("on");
      setAttachPropPersonType("none");
      setAttachPropCharacterId("");
      setAttachPropUserId("");
      setAttachPropNotes("");
      setAttachSetPieceId("");
      setAttachSetPieceKind("on");
      setAttachSetPiecePersonType("none");
      setAttachSetPieceCharacterId("");
      setAttachSetPieceUserId("");
      setAttachSetPieceNotes("");
      setAttachCostumeCharacterId("");
      setAttachCostumeKind("on");
      setAttachCostumeId("");
      setAttachCostumeNotes("");
      setAttachEntranceCharacterId("");
      setAttachEntranceNotes("");
      setAttachExitCharacterId("");
      setAttachExitNotes("");
      setAttachBlockingCharacterId("");
      setAttachBlockingNotes("");
      setNewCueCategoryId("");
      setNewCueTitle("");
      setNewCueNotes("");
    }

    function selectAttachmentType(next: AttachmentType) {
      if (addAttachmentType === next) {
        setAddAttachmentType("");
        resetAttachmentDraft();
        return;
      }
      setAddAttachmentType(next);
      resetAttachmentDraft();
    }

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
        toast.success("Moment saved");
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const proceed = await confirm({
            title: "Change moment type?",
            description: `${formatApiError(err, "Conflict")} Structured dialogue or stage direction data will be orphaned.`,
            confirmLabel: "Change type",
          });
          if (proceed) {
            await saveMomentFields(true);
            return;
          }
        } else {
          toast.error(formatApiError(err, "Failed to save moment"));
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
        toast.success("Stage direction saved");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to save stage direction"));
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
          toast.success("Bookmark removed");
        } else {
          await api.createBookmark(detail.id);
          toast.success("Bookmark added");
        }
        onChanged();
      } catch (err) {
        toast.error(formatApiError(err, "Bookmark action failed"));
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
        toast.success("Note added");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to add note"));
      } finally {
        setSaving(false);
      }
    }

    async function handleDeleteNote(noteId: number) {
      const ok = await confirm({
        title: "Delete this note?",
        description: "This cannot be undone.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!ok) return;

      setSaving(true);
      try {
        await api.deleteNote(productionId, noteId);
        onChanged();
        toast.success("Note deleted");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to delete note"));
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
        toast.success("Dialogue updated");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to update dialogue"));
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachProp(event: React.FormEvent) {
      event.preventDefault();
      if (!attachPropId) return;
      if (attachPropPersonType === "character" && !attachPropCharacterId) return;
      if (attachPropPersonType === "user" && !attachPropUserId) return;

      setSaving(true);
      try {
        await api.attachMomentProp(productionId, detail.id, {
          prop_id: Number(attachPropId),
          kind: attachPropKind,
          character_id:
            attachPropPersonType === "character" && attachPropCharacterId
              ? Number(attachPropCharacterId)
              : null,
          user_id:
            attachPropPersonType === "user" && attachPropUserId
              ? Number(attachPropUserId)
              : null,
          notes: attachPropNotes.trim() || null,
        });
        setAttachPropId("");
        setAttachPropKind("on");
        setAttachPropPersonType("none");
        setAttachPropCharacterId("");
        setAttachPropUserId("");
        setAttachPropNotes("");
        await onChanged();
        setPropsExpandSignal((n) => n + 1);
        toast.success("Prop event added");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to add prop event"));
      } finally {
        setSaving(false);
      }
    }

    async function handleUpdateMomentProp(
      momentPropId: number,
      body: {
        kind: AssetEventKind;
        character_id: number | null;
        user_id: number | null;
        notes: string | null;
      },
    ) {
      setSaving(true);
      try {
        await api.updateMomentProp(productionId, detail.id, momentPropId, body);
        await onChanged();
        setPropsExpandSignal((n) => n + 1);
        toast.success("Prop event updated");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to update prop event"));
        throw err;
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachProp(momentPropId: number) {
      const ok = await confirm({
        title: "Remove this prop event from the moment?",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;

      setSaving(true);
      try {
        await api.detachMomentProp(productionId, detail.id, momentPropId);
        await onChanged();
        toast.success("Prop event removed");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to detach prop event"));
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachSetPiece(event: React.FormEvent) {
      event.preventDefault();
      if (!attachSetPieceId) return;
      if (attachSetPiecePersonType === "character" && !attachSetPieceCharacterId) return;
      if (attachSetPiecePersonType === "user" && !attachSetPieceUserId) return;

      setSaving(true);
      try {
        await api.attachMomentSetPiece(productionId, detail.id, {
          set_piece_id: Number(attachSetPieceId),
          kind: attachSetPieceKind,
          character_id:
            attachSetPiecePersonType === "character" && attachSetPieceCharacterId
              ? Number(attachSetPieceCharacterId)
              : null,
          user_id:
            attachSetPiecePersonType === "user" && attachSetPieceUserId
              ? Number(attachSetPieceUserId)
              : null,
          notes: attachSetPieceNotes.trim() || null,
        });
        setAttachSetPieceId("");
        setAttachSetPieceKind("on");
        setAttachSetPiecePersonType("none");
        setAttachSetPieceCharacterId("");
        setAttachSetPieceUserId("");
        setAttachSetPieceNotes("");
        await onChanged();
        setSetPiecesExpandSignal((n) => n + 1);
        toast.success("Set piece event added");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to add set piece event"));
      } finally {
        setSaving(false);
      }
    }

    async function handleUpdateMomentSetPiece(
      momentSetPieceId: number,
      body: {
        kind: AssetEventKind;
        character_id: number | null;
        user_id: number | null;
        notes: string | null;
      },
    ) {
      setSaving(true);
      try {
        await api.updateMomentSetPiece(productionId, detail.id, momentSetPieceId, body);
        await onChanged();
        setSetPiecesExpandSignal((n) => n + 1);
        toast.success("Set piece event updated");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to update set piece event"));
        throw err;
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachSetPiece(momentSetPieceId: number) {
      const ok = await confirm({
        title: "Remove this set piece event from the moment?",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;

      setSaving(true);
      try {
        await api.detachMomentSetPiece(productionId, detail.id, momentSetPieceId);
        await onChanged();
        toast.success("Set piece event removed");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to detach set piece event"));
      } finally {
        setSaving(false);
      }
    }

    async function handleAttachCostume(event: React.FormEvent) {
      event.preventDefault();
      if (!attachCostumeCharacterId) return;
      if (attachCostumeKind === "on" && !attachCostumeId) return;

      setSaving(true);
      try {
        await api.attachMomentCostume(productionId, detail.id, {
          character_id: Number(attachCostumeCharacterId),
          kind: attachCostumeKind,
          costume_id: attachCostumeId ? Number(attachCostumeId) : null,
          notes: attachCostumeNotes.trim() || null,
        });
        setAttachCostumeCharacterId("");
        setAttachCostumeKind("on");
        setAttachCostumeId("");
        setAttachCostumeNotes("");
        await onChanged();
        toast.success("Costume event added");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to add costume event"));
      } finally {
        setSaving(false);
      }
    }

    async function handleUpdateMomentCostume(
      momentCostumeId: number,
      body: { kind: AssetEventKind; costume_id: number | null; notes: string | null },
    ) {
      setSaving(true);
      try {
        await api.updateMomentCostume(productionId, detail.id, momentCostumeId, body);
        await onChanged();
        toast.success("Costume event updated");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to update costume event"));
        throw err;
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachCostume(momentCostumeId: number) {
      const ok = await confirm({
        title: "Remove this costume event from the moment?",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;

      setSaving(true);
      try {
        await api.detachMomentCostume(productionId, detail.id, momentCostumeId);
        await onChanged();
        toast.success("Costume event removed");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to detach costume event"));
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
        toast.success("Entrance added");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to attach entrance"));
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachEntrance(entranceId: number) {
      const ok = await confirm({
        title: "Remove this entrance from the moment?",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;

      setSaving(true);
      try {
        await api.detachMomentEntrance(productionId, detail.id, entranceId);
        onChanged();
        toast.success("Entrance removed");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to detach entrance"));
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
        toast.success("Exit added");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to attach exit"));
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachExit(exitId: number) {
      const ok = await confirm({
        title: "Remove this exit from the moment?",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;

      setSaving(true);
      try {
        await api.detachMomentExit(productionId, detail.id, exitId);
        onChanged();
        toast.success("Exit removed");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to detach exit"));
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
        toast.success("Blocking added");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to attach blocking"));
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
        toast.success("Blocking updated");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to update blocking"));
      } finally {
        setSaving(false);
      }
    }

    async function handleDetachBlocking(blockingId: number) {
      const ok = await confirm({
        title: "Remove this blocking from the moment?",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;

      setSaving(true);
      try {
        await api.detachMomentBlocking(productionId, detail.id, blockingId);
        onChanged();
        toast.success("Blocking removed");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to detach blocking"));
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
        toast.success("Cue added");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to add cue"));
      } finally {
        setSaving(false);
      }
    }

    async function handleDeleteCue(cueId: number) {
      const ok = await confirm({
        title: "Remove this cue from the moment?",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;

      setSaving(true);
      try {
        await api.deleteMomentCue(productionId, detail.id, cueId);
        onChanged();
        toast.success("Cue removed");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to delete cue"));
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

        {/* Primary script content — emphasized above imported metadata */}
        {detail.moment_type === "stage_direction" && (detail.stage_direction || canEdit) && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stage direction
            </h3>
            {canEdit ? (
              <Textarea
                value={stageDirectionText}
                onChange={(e) => setStageDirectionText(e.target.value)}
                onBlur={() => void saveStageDirection()}
                rows={1}
                className="mt-2 min-h-[3rem] resize-none overflow-hidden whitespace-pre-wrap text-base italic leading-relaxed"
              />
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-base italic leading-relaxed">
                {detail.stage_direction}
              </p>
            )}
          </div>
        )}

        {detail.moment_type !== "stage_direction" && detail.dialogue.length > 0 && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dialogue
            </h3>
            <ul className="mt-2 space-y-2">
              {detail.dialogue.map((line) => (
                <li key={line.id} className="text-base leading-relaxed">
                  {canEdit ? (
                    <div className="flex flex-col gap-1">
                      <Select
                        value={String(line.character_id)}
                        disabled={saving}
                        onValueChange={(value) =>
                          void handleDialogueCharacterChange(line.id, Number(value))
                        }
                      >
                        <SelectTrigger size="sm" className="w-fit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedCharacters.map((character) => (
                            <SelectItem key={character.id} value={String(character.id)}>
                              {character.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

        {detail.moment_type === "lyric" && (detail.lyrics?.length ?? 0) > 0 && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lyric
            </h3>
            <ul className="mt-2 space-y-2">
              {detail.lyrics.map((line) => (
                <li key={line.id} className="text-base leading-relaxed">
                  <span className="font-medium">{line.character_name}:</span>{" "}
                  {line.lyric_text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(detail.moment_type === "song_header" ||
          detail.moment_type === "song_attribution" ||
          (detail.moment_type === "lyric" && (detail.lyrics?.length ?? 0) === 0)) &&
          (detail.parsed_text || detail.original_text) && (
            <div className="rounded-md bg-muted/60 px-3 py-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {detail.moment_type === "lyric"
                  ? "Lyric"
                  : detail.moment_type === "song_header"
                    ? "Song title"
                    : "Attribution"}
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed">
                {detail.parsed_text || detail.original_text}
              </p>
            </div>
          )}

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
            {isSongRelated && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Linked song</Label>
                <Select
                  value={selectedSongId || NO_SONG_VALUE}
                  onValueChange={(value) =>
                    setSelectedSongId(value === NO_SONG_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger
                    className="w-full"
                    onBlur={() => void saveMomentFields()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SONG_VALUE}>None</SelectItem>
                    {songs.map((song) => (
                      <SelectItem key={song.id} value={String(song.id)}>
                        {song.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Moment type</Label>
                    <Select
                      value={String(selectedTypeId)}
                      onValueChange={(value) => setSelectedTypeId(value)}
                    >
                      <SelectTrigger
                        className="w-full"
                        onBlur={() => void saveMomentFields()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {momentTypes.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {momentTypeLabel(type.name as MomentDetailResponse["moment_type"])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Imported text</Label>
                    <Textarea
                      value={parsedText}
                      onChange={(e) => setParsedText(e.target.value)}
                      onBlur={() => void saveMomentFields()}
                      rows={3}
                    />
                  </div>
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

        {detail.song_title && !canEdit && isSongRelated && (
          <div>
            <h3 className="text-sm font-medium">Song</h3>
            <p className="mt-1 text-sm">{detail.song_title}</p>
          </div>
        )}

        {canEdit && (
          <div className="rounded-md border border-border p-3">
            <button
              type="button"
              onClick={() => setAddSectionExpanded((open) => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-expanded={addSectionExpanded}
            >
              <span className="text-sm font-medium">Add to moment</span>
              <span className="text-xs text-muted-foreground">
                {addSectionExpanded ? "▾" : "▸"}
              </span>
            </button>

            {addSectionExpanded && (
              <>
            {availableAttachmentTypes.length > 0 ? (
              <div
                className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7"
                role="group"
                aria-label="Attachment type"
              >
                {availableAttachmentTypes.map((option) => {
                  const Icon = option.icon;
                  const selected = addAttachmentType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      title={option.label}
                      aria-pressed={selected}
                      onClick={() => selectAttachmentType(option.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-[10px] font-medium outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="leading-tight">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Need something to attach? Create items in{" "}
                <Link
                  to={`/productions/${productionId}/props`}
                  className="underline hover:text-foreground"
                >
                  Props
                </Link>
                ,{" "}
                <Link
                  to={`/productions/${productionId}/cue-categories`}
                  className="underline hover:text-foreground"
                >
                  Cue Categories
                </Link>
                ,{" "}
                <Link
                  to={`/productions/${productionId}/set-pieces`}
                  className="underline hover:text-foreground"
                >
                  Set Pieces
                </Link>
                , or{" "}
                <Link
                  to={costumesPagePath(productionId, detail)}
                  className="underline hover:text-foreground"
                >
                  Costumes
                </Link>{" "}
                first.
              </p>
            )}

            {addAttachmentType === "prop" && propsCatalog.length > 0 && (
              <form onSubmit={(e) => void handleAttachProp(e)} className="mt-3 space-y-2">
                <SearchableSelect
                  options={propOptions}
                  value={attachPropId}
                  onChange={setAttachPropId}
                  placeholder="Select prop…"
                  clearLabel="Clear selection"
                />
                <KindToggle value={attachPropKind} onChange={setAttachPropKind} />
                <SearchableSelect
                  options={personOptions}
                  value={encodePersonValue(
                    attachPropPersonType,
                    attachPropCharacterId,
                    attachPropUserId,
                  )}
                  onChange={(next) => {
                    const decoded = decodePersonValue(next);
                    setAttachPropPersonType(decoded.personType);
                    setAttachPropCharacterId(decoded.characterId);
                    setAttachPropUserId(decoded.userId);
                  }}
                  placeholder="Person (optional)"
                  clearLabel="No person"
                />
                <Input
                  value={attachPropNotes}
                  onChange={(e) => setAttachPropNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    saving ||
                    !attachPropId ||
                    (attachPropPersonType === "character" && !attachPropCharacterId) ||
                    (attachPropPersonType === "user" && !attachPropUserId)
                  }
                >
                  Add
                </Button>
              </form>
            )}

            {addAttachmentType === "cue" && cueCategories.length > 0 && (
              <form onSubmit={(e) => void handleAddCue(e)} className="mt-3 space-y-2">
                <SearchableSelect
                  options={cueCategoryOptions}
                  value={newCueCategoryId}
                  onChange={setNewCueCategoryId}
                  placeholder="Select category…"
                  clearLabel="Clear selection"
                />
                <Input
                  value={newCueTitle}
                  onChange={(e) => setNewCueTitle(e.target.value)}
                  placeholder="Cue title"
                />
                <Input
                  value={newCueNotes}
                  onChange={(e) => setNewCueNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={saving || !newCueCategoryId || !newCueTitle.trim()}
                >
                  Add
                </Button>
              </form>
            )}

            {addAttachmentType === "set_piece" && setPiecesCatalog.length > 0 && (
              <form onSubmit={(e) => void handleAttachSetPiece(e)} className="mt-3 space-y-2">
                <SearchableSelect
                  options={setPieceOptions}
                  value={attachSetPieceId}
                  onChange={setAttachSetPieceId}
                  placeholder="Select set piece…"
                  clearLabel="Clear selection"
                />
                <KindToggle value={attachSetPieceKind} onChange={setAttachSetPieceKind} />
                <SearchableSelect
                  options={personOptions}
                  value={encodePersonValue(
                    attachSetPiecePersonType,
                    attachSetPieceCharacterId,
                    attachSetPieceUserId,
                  )}
                  onChange={(next) => {
                    const decoded = decodePersonValue(next);
                    setAttachSetPiecePersonType(decoded.personType);
                    setAttachSetPieceCharacterId(decoded.characterId);
                    setAttachSetPieceUserId(decoded.userId);
                  }}
                  placeholder="Person (optional)"
                  clearLabel="No person"
                />
                <Input
                  value={attachSetPieceNotes}
                  onChange={(e) => setAttachSetPieceNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    saving ||
                    !attachSetPieceId ||
                    (attachSetPiecePersonType === "character" && !attachSetPieceCharacterId) ||
                    (attachSetPiecePersonType === "user" && !attachSetPieceUserId)
                  }
                >
                  Add
                </Button>
              </form>
            )}

            {addAttachmentType === "costume" && costumesCatalog.length > 0 && (
              <form onSubmit={(e) => void handleAttachCostume(e)} className="mt-3 space-y-2">
                <SearchableSelect
                  options={characterOptions}
                  value={attachCostumeCharacterId}
                  onChange={setAttachCostumeCharacterId}
                  placeholder="Select character…"
                  clearLabel="Clear selection"
                />
                <KindToggle
                  value={attachCostumeKind}
                  onChange={(kind) => {
                    setAttachCostumeKind(kind);
                    if (kind === "off") setAttachCostumeId("");
                  }}
                  onLabel="Wear"
                  offLabel="Clear"
                />
                {attachCostumeKind === "on" && (
                  <SearchableSelect
                    options={costumeOptions}
                    value={attachCostumeId}
                    onChange={setAttachCostumeId}
                    placeholder="Select costume…"
                    clearLabel="Clear selection"
                  />
                )}
                <Input
                  value={attachCostumeNotes}
                  onChange={(e) => setAttachCostumeNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    saving ||
                    !attachCostumeCharacterId ||
                    (attachCostumeKind === "on" && !attachCostumeId)
                  }
                >
                  Add
                </Button>
              </form>
            )}

            {addAttachmentType === "entrance" && characters.length > 0 && (
              <form onSubmit={(e) => void handleAttachEntrance(e)} className="mt-3 space-y-2">
                <SearchableSelect
                  options={characterOptions}
                  value={attachEntranceCharacterId}
                  onChange={setAttachEntranceCharacterId}
                  placeholder="Select character…"
                  clearLabel="Clear selection"
                />
                <Input
                  value={attachEntranceNotes}
                  onChange={(e) => setAttachEntranceNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <Button type="submit" variant="outline" disabled={saving || !attachEntranceCharacterId}>
                  Add
                </Button>
              </form>
            )}

            {addAttachmentType === "exit" && characters.length > 0 && (
              <form onSubmit={(e) => void handleAttachExit(e)} className="mt-3 space-y-2">
                <SearchableSelect
                  options={characterOptions}
                  value={attachExitCharacterId}
                  onChange={setAttachExitCharacterId}
                  placeholder="Select character…"
                  clearLabel="Clear selection"
                />
                <Input
                  value={attachExitNotes}
                  onChange={(e) => setAttachExitNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <Button type="submit" variant="outline" disabled={saving || !attachExitCharacterId}>
                  Add
                </Button>
              </form>
            )}

            {addAttachmentType === "blocking" && characters.length > 0 && (
              <form onSubmit={(e) => void handleAttachBlocking(e)} className="mt-3 space-y-2">
                <SearchableSelect
                  options={characterOptions}
                  value={attachBlockingCharacterId}
                  onChange={setAttachBlockingCharacterId}
                  placeholder="Select character…"
                  clearLabel="Clear selection"
                />
                <Textarea
                  value={attachBlockingNotes}
                  onChange={(e) => setAttachBlockingNotes(e.target.value)}
                  placeholder="Blocking notes"
                  rows={2}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    saving || !attachBlockingCharacterId || !attachBlockingNotes.trim()
                  }
                >
                  Add
                </Button>
              </form>
            )}
              </>
            )}
          </div>
        )}

        <AssetEventSection
          title="Props"
          emptyMessage="No prop events on this moment."
          canEdit={canEdit}
          saving={saving}
          productionId={productionId}
          defaultExpanded={detail.props.length > 0}
          expandSignal={propsExpandSignal}
          events={detail.props.map((prop) => ({
            id: prop.id,
            assetName: prop.prop_name,
            kind: prop.kind as AssetEventKind,
            character_id: prop.character_id,
            character_name: prop.character_name,
            user_id: prop.user_id,
            user_display_name: prop.user_display_name,
            notes: prop.notes,
            priorOnActNumber: prop.prior_on_act_number ?? null,
            priorOnSceneNumber: prop.prior_on_scene_number ?? null,
            priorOnSequenceNumber: prop.prior_on_sequence_number ?? null,
          }))}
          characters={sortedCharacters}
          castableUsers={sortedCastableUsers}
          onUpdate={handleUpdateMomentProp}
          onDetach={handleDetachProp}
          catalogLength={propsCatalog.length}
          inPlay={detail.props_in_play
            .filter((item) => item.source_moment_id !== detail.id)
            .map((item) => ({
              key: `prop-in-play-${item.prop_id}`,
              label: item.prop_name,
              personLabel: item.character_name ?? item.user_display_name,
              sourceActNumber: item.source_act_number,
              sourceSceneNumber: item.source_scene_number,
              sourceSequenceNumber: item.source_sequence_number,
              nextChangeActNumber: item.next_change_act_number,
              nextChangeSceneNumber: item.next_change_scene_number,
              nextChangeSequenceNumber: item.next_change_sequence_number,
            }))}
        />

        <AssetEventSection
          title="Set pieces"
          emptyMessage="No set piece events on this moment."
          canEdit={canEdit}
          saving={saving}
          productionId={productionId}
          defaultExpanded={detail.set_pieces.length > 0}
          expandSignal={setPiecesExpandSignal}
          events={detail.set_pieces.map((piece) => ({
            id: piece.id,
            assetName: piece.set_piece_name,
            kind: piece.kind as AssetEventKind,
            character_id: piece.character_id,
            character_name: piece.character_name,
            user_id: piece.user_id,
            user_display_name: piece.user_display_name,
            notes: piece.notes,
            priorOnActNumber: piece.prior_on_act_number ?? null,
            priorOnSceneNumber: piece.prior_on_scene_number ?? null,
            priorOnSequenceNumber: piece.prior_on_sequence_number ?? null,
          }))}
          characters={sortedCharacters}
          castableUsers={sortedCastableUsers}
          onUpdate={handleUpdateMomentSetPiece}
          onDetach={handleDetachSetPiece}
          catalogLength={setPiecesCatalog.length}
          inPlay={detail.set_pieces_in_play
            .filter((item) => item.source_moment_id !== detail.id)
            .map((item) => ({
              key: `set-piece-in-play-${item.set_piece_id}`,
              label: item.set_piece_name,
              personLabel: item.character_name ?? item.user_display_name,
              sourceActNumber: item.source_act_number,
              sourceSceneNumber: item.source_scene_number,
              sourceSequenceNumber: item.source_sequence_number,
              nextChangeActNumber: item.next_change_act_number,
              nextChangeSceneNumber: item.next_change_scene_number,
              nextChangeSequenceNumber: item.next_change_sequence_number,
            }))}
        />

        <CostumeEventSection
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={detail.costume_events.length > 0}
          events={detail.costume_events}
          costumesCatalog={costumesCatalog}
          onUpdate={handleUpdateMomentCostume}
          onDetach={handleDetachCostume}
          wearing={detail.costumes_wearing}
        />

        <AttachmentSection
          title="Entrances"
          emptyMessage="No entrances recorded."
          canEdit={canEdit}
          saving={saving}
          defaultExpanded={detail.entrances.length > 0}
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
          defaultExpanded={detail.exits.length > 0}
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
          defaultExpanded={detail.blocking.length > 0}
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
          defaultExpanded={detail.cues.length > 0}
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {note.visibility === "public" ? "Visible to cast" : "Only me"}
                      </Badge>
                      {note.is_mine && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          onClick={() => void handleDeleteNote(note.id)}
                          aria-label="Delete note"
                          title="Delete note"
                          className="shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={(e) => void handleAddNote(e)} className="mt-4 flex flex-col gap-3">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add a note…"
              rows={3}
            />
            {canChooseVisibility && (
              <Select
                value={noteVisibility}
                onValueChange={(value) => setNoteVisibility(value as "public" | "private")}
              >
                <SelectTrigger className="w-fit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Visible to cast</SelectItem>
                  <SelectItem value="private">Only me</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button type="submit" disabled={saving || !noteContent.trim()}>
              Add note
            </Button>
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
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);
  const hasContent = items.length > 0;

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                        <Textarea
                          defaultValue={item.notes}
                          disabled={saving}
                          onBlur={(e) => item.onNotesBlur?.(e.target.value)}
                          className="mt-2"
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

interface AssetEventItem {
  id: number;
  assetName: string;
  kind: AssetEventKind;
  character_id: number | null;
  character_name: string | null;
  user_id: number | null;
  user_display_name: string | null;
  notes: string | null;
  priorOnActNumber: number | null;
  priorOnSceneNumber: number | null;
  priorOnSequenceNumber: number | null;
}

interface AssetInPlayItem {
  key: string;
  label: string;
  personLabel: string | null;
  sourceActNumber: number;
  sourceSceneNumber: number;
  sourceSequenceNumber: number;
  nextChangeActNumber: number | null;
  nextChangeSceneNumber: number | null;
  nextChangeSequenceNumber: number | null;
}

function AssetEventSection({
  title,
  emptyMessage,
  canEdit,
  saving,
  productionId,
  events,
  characters,
  castableUsers,
  onUpdate,
  onDetach,
  catalogLength,
  defaultExpanded = true,
  expandSignal = 0,
  inPlay,
}: {
  title: string;
  emptyMessage: string;
  canEdit: boolean;
  saving: boolean;
  productionId: number;
  events: AssetEventItem[];
  characters: CharacterDetailResponse[];
  castableUsers: CastableUserResponse[];
  onUpdate: (
    eventId: number,
    body: {
      kind: AssetEventKind;
      character_id: number | null;
      user_id: number | null;
      notes: string | null;
    },
  ) => void | Promise<void>;
  onDetach: (eventId: number) => void;
  catalogLength: number;
  defaultExpanded?: boolean;
  expandSignal?: number;
  inPlay: AssetInPlayItem[];
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);
  useEffect(() => {
    if (expandSignal > 0) setExpanded(true);
  }, [expandSignal]);

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {events.length > 0 ? `${events.length}` : "—"} {expanded ? "▾" : "▸"}
        </span>
      </button>

      {inPlay.length > 0 && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Currently in play
          </h4>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {inPlay.map((item) => {
              const sourceCode = formatMomentCode(
                item.sourceActNumber,
                item.sourceSceneNumber,
                item.sourceSequenceNumber,
              );
              const hasNextChange =
                item.nextChangeActNumber != null &&
                item.nextChangeSceneNumber != null &&
                item.nextChangeSequenceNumber != null;
              const nextCode = hasNextChange
                ? formatMomentCode(
                    item.nextChangeActNumber!,
                    item.nextChangeSceneNumber!,
                    item.nextChangeSequenceNumber!,
                  )
                : null;

              return (
                <li key={item.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span>
                    <span className="font-medium text-foreground">{item.label}</span>
                    {item.personLabel ? ` — ${item.personLabel}` : ""}
                  </span>
                  <span className="inline-flex flex-wrap items-center gap-x-1.5">
                    <Link
                      to={humanTimelinePath(
                        productionId,
                        item.sourceActNumber,
                        item.sourceSceneNumber,
                        item.sourceSequenceNumber,
                      )}
                      className="underline underline-offset-2 hover:text-foreground"
                      aria-label={`Open moment ${sourceCode} that set this state`}
                    >
                      {sourceCode}
                    </Link>
                    {nextCode != null && (
                      <>
                        <span aria-hidden="true">→</span>
                        <Link
                          to={humanTimelinePath(
                            productionId,
                            item.nextChangeActNumber!,
                            item.nextChangeSceneNumber!,
                            item.nextChangeSequenceNumber!,
                          )}
                          className="underline underline-offset-2 hover:text-foreground"
                          aria-label={`Open moment ${nextCode} where this changes next`}
                        >
                          {nextCode}
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {expanded && (
        <>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {events.map((event) => (
                <AssetEventRow
                  key={event.id}
                  event={event}
                  canEdit={canEdit}
                  saving={saving}
                  productionId={productionId}
                  characters={characters}
                  castableUsers={castableUsers}
                  onUpdate={onUpdate}
                  onDetach={onDetach}
                />
              ))}
            </ul>
          )}

          {canEdit && catalogLength === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Add {title.toLowerCase()} to the catalog to attach them here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function AssetEventRow({
  event,
  canEdit,
  saving,
  productionId,
  characters,
  castableUsers,
  onUpdate,
  onDetach,
}: {
  event: AssetEventItem;
  canEdit: boolean;
  saving: boolean;
  productionId: number;
  characters: CharacterDetailResponse[];
  castableUsers: CastableUserResponse[];
  onUpdate: (
    eventId: number,
    body: {
      kind: AssetEventKind;
      character_id: number | null;
      user_id: number | null;
      notes: string | null;
    },
  ) => void | Promise<void>;
  onDetach: (eventId: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<AssetEventKind>(event.kind);
  const [personType, setPersonType] = useState<PersonType>(
    personTypeOf(event.character_id, event.user_id),
  );
  const [characterId, setCharacterId] = useState(
    event.character_id !== null ? String(event.character_id) : "",
  );
  const [userId, setUserId] = useState(event.user_id !== null ? String(event.user_id) : "");
  const [notes, setNotes] = useState(event.notes ?? "");

  useEffect(() => {
    setKind(event.kind);
    setPersonType(personTypeOf(event.character_id, event.user_id));
    setCharacterId(event.character_id !== null ? String(event.character_id) : "");
    setUserId(event.user_id !== null ? String(event.user_id) : "");
    setNotes(event.notes ?? "");
  }, [event.id, event.kind, event.character_id, event.user_id, event.notes]);

  const personLabel = event.character_name ?? event.user_display_name;
  const personReady =
    personType === "none" ||
    (personType === "character" && Boolean(characterId)) ||
    (personType === "user" && Boolean(userId));
  const priorOnCode =
    event.kind === "off" &&
    event.priorOnActNumber != null &&
    event.priorOnSceneNumber != null &&
    event.priorOnSequenceNumber != null
      ? formatMomentCode(
          event.priorOnActNumber,
          event.priorOnSceneNumber,
          event.priorOnSequenceNumber,
        )
      : null;

  async function handleSave() {
    if (!personReady) return;
    try {
      await onUpdate(event.id, {
        kind,
        character_id: personType === "character" && characterId ? Number(characterId) : null,
        user_id: personType === "user" && userId ? Number(userId) : null,
        notes: notes.trim() || null,
      });
      setEditing(false);
    } catch {
      // Parent already toasted; keep the edit form open with the user's draft.
    }
  }

  function handleCancel() {
    setKind(event.kind);
    setPersonType(personTypeOf(event.character_id, event.user_id));
    setCharacterId(event.character_id !== null ? String(event.character_id) : "");
    setUserId(event.user_id !== null ? String(event.user_id) : "");
    setNotes(event.notes ?? "");
    setEditing(false);
  }

  return (
    <li className="rounded-md border border-border p-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{event.assetName}</span>
            <Badge
              variant={event.kind === "on" ? "default" : "secondary"}
              className="uppercase"
            >
              {event.kind === "on" ? "On" : "Off"}
            </Badge>
          </div>
          {personLabel && <p className="text-muted-foreground">{personLabel}</p>}
          {!editing && event.notes && (
            <p className="mt-1 text-muted-foreground">{event.notes}</p>
          )}
          {!editing && priorOnCode != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Started{" "}
              <Link
                to={humanTimelinePath(
                  productionId,
                  event.priorOnActNumber!,
                  event.priorOnSceneNumber!,
                  event.priorOnSequenceNumber!,
                )}
                className="underline underline-offset-2 hover:text-foreground"
                aria-label={`Open start moment ${priorOnCode}`}
              >
                {priorOnCode}
              </Link>
            </p>
          )}

          {editing && (
            <div className="mt-2 space-y-2">
              <KindToggle value={kind} onChange={setKind} />
              <SearchableSelect
                options={buildPersonOptions(characters, castableUsers)}
                value={encodePersonValue(personType, characterId, userId)}
                onChange={(next) => {
                  const decoded = decodePersonValue(next);
                  setPersonType(decoded.personType);
                  setCharacterId(decoded.characterId);
                  setUserId(decoded.userId);
                }}
                placeholder="Person (optional)"
                clearLabel="No person"
              />
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || !personReady}
                  onClick={() => void handleSave()}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        {canEdit && !editing && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={saving}
              onClick={() => setEditing(true)}
              aria-label={`Edit ${event.assetName} event`}
              title="Edit"
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={saving}
              onClick={() => onDetach(event.id)}
              aria-label={`Remove ${event.assetName} event`}
              title="Remove"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function CostumeEventSection({
  canEdit,
  saving,
  events,
  costumesCatalog,
  onUpdate,
  onDetach,
  defaultExpanded = true,
  wearing,
}: {
  canEdit: boolean;
  saving: boolean;
  events: MomentCostumeEventResponse[];
  costumesCatalog: CostumeResponse[];
  onUpdate: (
    eventId: number,
    body: { kind: AssetEventKind; costume_id: number | null; notes: string | null },
  ) => void | Promise<void>;
  onDetach: (eventId: number) => void;
  defaultExpanded?: boolean;
  wearing: CostumeWearingResponse[];
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <h3 className="text-sm font-medium">Costumes</h3>
        <span className="text-xs text-muted-foreground">
          {events.length > 0 ? `${events.length}` : "—"} {expanded ? "▾" : "▸"}
        </span>
      </button>

      {wearing.length > 0 && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Currently wearing
          </h4>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {wearing.map((item) => (
              <li key={`wearing-${item.character_id}`}>
                <span className="font-medium text-foreground">{item.character_name}</span>
                {` — ${item.costume_name}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {expanded && (
        <>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No costume events on this moment.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {events.map((event) => (
                <CostumeEventRow
                  key={event.id}
                  event={event}
                  canEdit={canEdit}
                  saving={saving}
                  costumesCatalog={costumesCatalog}
                  onUpdate={onUpdate}
                  onDetach={onDetach}
                />
              ))}
            </ul>
          )}

          {canEdit && costumesCatalog.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Add costumes to the catalog to record wear/clear events here.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CostumeEventRow({
  event,
  canEdit,
  saving,
  costumesCatalog,
  onUpdate,
  onDetach,
}: {
  event: MomentCostumeEventResponse;
  canEdit: boolean;
  saving: boolean;
  costumesCatalog: CostumeResponse[];
  onUpdate: (
    eventId: number,
    body: { kind: AssetEventKind; costume_id: number | null; notes: string | null },
  ) => void | Promise<void>;
  onDetach: (eventId: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<AssetEventKind>(event.kind);
  const [costumeId, setCostumeId] = useState(
    event.costume_id !== null ? String(event.costume_id) : "",
  );
  const [notes, setNotes] = useState(event.notes ?? "");

  useEffect(() => {
    setKind(event.kind);
    setCostumeId(event.costume_id !== null ? String(event.costume_id) : "");
    setNotes(event.notes ?? "");
  }, [event.id, event.kind, event.costume_id, event.notes]);

  const ready = kind === "off" || Boolean(costumeId);

  async function handleSave() {
    if (!ready) return;
    try {
      await onUpdate(event.id, {
        kind,
        costume_id: kind === "on" && costumeId ? Number(costumeId) : null,
        notes: notes.trim() || null,
      });
      setEditing(false);
    } catch {
      // Parent already toasted; keep the edit form open with the user's draft.
    }
  }

  function handleCancel() {
    setKind(event.kind);
    setCostumeId(event.costume_id !== null ? String(event.costume_id) : "");
    setNotes(event.notes ?? "");
    setEditing(false);
  }

  return (
    <li className="rounded-md border border-border p-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{event.character_name}</span>
            <Badge variant={event.kind === "on" ? "default" : "secondary"}>
              {event.kind === "on" ? "Wear" : "Clear"}
            </Badge>
          </div>
          {event.costume_name && <p className="text-muted-foreground">{event.costume_name}</p>}
          {!editing && event.notes && (
            <p className="mt-1 text-muted-foreground">{event.notes}</p>
          )}

          {editing && (
            <div className="mt-2 space-y-2">
              <KindToggle
                value={kind}
                onChange={(next) => {
                  setKind(next);
                  if (next === "off") setCostumeId("");
                }}
                onLabel="Wear"
                offLabel="Clear"
              />
              {kind === "on" && (
                <SearchableSelect
                  options={costumesCatalog.map((costume) => ({
                    value: String(costume.id),
                    label: costume.name,
                    hint: costume.character_name,
                    keywords: costume.character_name,
                  }))}
                  value={costumeId}
                  onChange={setCostumeId}
                  placeholder="Select costume…"
                  clearLabel="Clear selection"
                />
              )}
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || !ready}
                  onClick={() => void handleSave()}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        {canEdit && !editing && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={saving}
              onClick={() => setEditing(true)}
              aria-label={`Edit ${event.character_name} costume event`}
              title="Edit"
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={saving}
              onClick={() => onDetach(event.id)}
              aria-label={`Remove ${event.character_name} costume event`}
              title="Remove"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

export default MomentDetailPanel;
