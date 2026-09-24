import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Trash2 } from "lucide-react";
import AttributionSubjectMultiSelect, {
  decodeAttributionSubjects,
  encodeAttributionSubject,
} from "@/components/AttributionSubjectMultiSelect";
import AttributionInfo from "@/components/AttributionInfo";
import NotesPanel from "@/components/notes/NotesPanel";
import SearchableSelect from "@/components/SearchableSelect";
import type { SearchableSelectOption } from "@/components/SearchableSelect";
import ObjectLink from "@/components/object-detail/ObjectLink";
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
import { Textarea } from "@/components/ui/textarea";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, ApiError, formatApiError } from "@/lib/api";
import { characterOptionSearchMeta } from "@/lib/characterSearch";
import {
  MOMENT_ATTACHMENT_OPTIONS,
  domainIcon,
  type MomentAttachmentKind,
} from "@/lib/domainIcons";
import type { ObjectDetailType } from "@/lib/objectDetail";
import { formatMomentCode, humanTimelinePath } from "@/lib/timelineDeepLinks";
import type {
  AppSettingsResponse,
  AssetEventKind,
  CastableUserResponse,
  CharacterDetailResponse,
  CostumeResponse,
  CostumeWearingResponse,
  CueCategoryResponse,
  GroupResponse,
  MomentCostumeEventResponse,
  MomentDetailResponse,
  MomentTypeResponse,
  PrepRecordFields,
  PropResponse,
  SetPieceResponse,
  SongDetailResponse,
} from "@/lib/types";
import { cn, momentTypeLabel, sortByName } from "@/lib/utils";

/** Radix Select cannot use an empty string value, so "no song" needs a sentinel. */
const NO_SONG_VALUE = "__none__";

type PersonType = "none" | "character" | "user";
type BlockingSubjectType = "character" | "user" | "group";

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

function encodeBlockingSubjectValue(
  subjectType: BlockingSubjectType | "",
  characterId: string,
  userId: string,
  groupId: string,
): string {
  if (subjectType === "character" && characterId) return `character:${characterId}`;
  if (subjectType === "user" && userId) return `user:${userId}`;
  if (subjectType === "group" && groupId) return `group:${groupId}`;
  return "";
}

function decodeBlockingSubjectValue(value: string): {
  subjectType: BlockingSubjectType | "";
  characterId: string;
  userId: string;
  groupId: string;
} {
  if (value.startsWith("character:")) {
    return {
      subjectType: "character",
      characterId: value.slice("character:".length),
      userId: "",
      groupId: "",
    };
  }
  if (value.startsWith("user:")) {
    return {
      subjectType: "user",
      characterId: "",
      userId: value.slice("user:".length),
      groupId: "",
    };
  }
  if (value.startsWith("group:")) {
    return {
      subjectType: "group",
      characterId: "",
      userId: "",
      groupId: value.slice("group:".length),
    };
  }
  return { subjectType: "", characterId: "", userId: "", groupId: "" };
}

function buildPersonOptions(
  characters: CharacterDetailResponse[],
  users: CastableUserResponse[],
): SearchableSelectOption[] {
  const characterOptions = characters.map((character) => {
    const search = characterOptionSearchMeta(character);
    return {
      value: `character:${character.id}`,
      label: character.name,
      hint: search.hint,
      keywords: search.keywords,
    };
  });
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

function buildMovementSubjectOptions(
  characters: CharacterDetailResponse[],
  users: CastableUserResponse[],
  groups: GroupResponse[],
): SearchableSelectOption[] {
  const groupOptions = groups.map((group) => ({
    value: `group:${group.id}`,
    label: group.name,
    hint: "Group",
    keywords: "group",
  }));
  return [...buildPersonOptions(characters, users), ...groupOptions].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

function decodeMovementSubject(value: string): {
  characterId: number | null;
  userId: number | null;
  groupId: number | null;
} {
  if (value.startsWith("character:")) {
    return {
      characterId: Number(value.slice("character:".length)),
      userId: null,
      groupId: null,
    };
  }
  if (value.startsWith("user:")) {
    return {
      characterId: null,
      userId: Number(value.slice("user:".length)),
      groupId: null,
    };
  }
  if (value.startsWith("group:")) {
    return {
      characterId: null,
      userId: null,
      groupId: Number(value.slice("group:".length)),
    };
  }
  return { characterId: null, userId: null, groupId: null };
}

function movementRowLabel(row: {
  character_name: string | null;
  user_display_name?: string | null;
  group_name: string | null;
}): string {
  return row.character_name ?? row.user_display_name ?? row.group_name ?? "Unknown";
}

function movementSubjectObject(
  row: {
    character_id: number | null;
    user_id?: number | null;
    group_id: number | null;
  },
): { objectType?: ObjectDetailType; objectId?: number | null } {
  if (row.character_id != null) {
    return { objectType: "character", objectId: row.character_id };
  }
  if (row.group_id != null) {
    return { objectType: "group", objectId: row.group_id };
  }
  if (row.user_id != null) {
    return { objectType: "person", objectId: row.user_id };
  }
  return {};
}

function buildBlockingSubjectOptions(
  characters: CharacterDetailResponse[],
  users: CastableUserResponse[],
  groups: GroupResponse[],
): SearchableSelectOption[] {
  return buildMovementSubjectOptions(characters, users, groups);
}

function dialogueSpeakerLabel(line: {
  character_name: string | null;
  group_name?: string | null;
}): string {
  return line.character_name ?? line.group_name ?? "Unknown";
}

function uniqueEncodedSubjects(
  rows: { character_id: number | null; group_id?: number | null }[],
): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const value = encodeAttributionSubject(row);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

function sameSubjectValues(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((value) => set.has(value));
}

function blockingSubjectLabel(row: {
  character_name: string | null;
  user_display_name: string | null;
  group_name: string | null;
}): string {
  return row.character_name ?? row.user_display_name ?? row.group_name ?? "Unknown";
}

function DetailObjectLabel({
  label,
  objectType,
  objectId,
  momentId,
  className,
}: {
  label: string;
  objectType?: ObjectDetailType;
  objectId?: number | null;
  momentId?: number;
  className?: string;
}) {
  if (objectType != null && objectId != null) {
    return (
      <ObjectLink
        objectType={objectType}
        objectId={objectId}
        momentId={momentId}
        label={label}
        className={className}
      />
    );
  }
  return <span className={cn("font-medium", className)}>{label}</span>;
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
          "rounded-sm px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
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
          "rounded-sm px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
          value === "off" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        )}
      >
        {offLabel}
      </button>
    </div>
  );
}

type AttachmentType = MomentAttachmentKind;

const ATTACHMENT_TYPE_OPTIONS = MOMENT_ATTACHMENT_OPTIONS;
function costumesPagePath(productionId: number, detail: MomentDetailResponse): string {
  const params = new URLSearchParams();
  if (detail.dialogue.length === 1 && detail.dialogue[0].character_id != null) {
    params.set("characterId", String(detail.dialogue[0].character_id));
  }
  const query = params.toString();
  return `/productions/${productionId}/costumes${query ? `?${query}` : ""}`;
}

export interface MomentDetailPanelHandle {
  /** Save script drafts if dirty (used on sheet close). */
  flushPendingSaves: () => Promise<void>;
  saveScript: () => Promise<void>;
  discardScript: () => void;
  isScriptDirty: () => boolean;
}

interface MomentDetailPanelProps {
  productionId: number;
  detail: MomentDetailResponse;
  sceneId: number | null;
  canEdit: boolean;
  /** Admin-only: edit script content (dialogue/lyrics/stage direction/imported data). */
  canEditScript: boolean;
  canChooseVisibility: boolean;
  characters: CharacterDetailResponse[];
  castableUsers: CastableUserResponse[];
  groups: GroupResponse[];
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
  onScriptDirtyChange?: (dirty: boolean) => void;
  /**
   * When true, hide read-only script blocks that already appear on the Timeline
   * row (dialogue / lyric / stage direction / song text). Edit fields remain.
   */
  hideScriptPreview?: boolean;
}

const MomentDetailPanel = forwardRef<MomentDetailPanelHandle, MomentDetailPanelProps>(
  function MomentDetailPanel(
    {
      productionId,
      detail,
      canEdit,
      canEditScript,
      characters,
      castableUsers,
      groups,
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
      onScriptDirtyChange,
      hideScriptPreview = false,
    },
    ref,
  ) {
    const confirm = useConfirm();
    const toast = useToast();
    const { hasCapability } = useProductionAccess();
    const canApprove = hasCapability("timeline", "approve");
    const canPublishNotes = hasCapability("notes", "publish");
    const canAttach =
      canEdit || hasCapability("timeline", "suggest") || canApprove;

    async function handleApprove(kind: string, id: number) {
      try {
        await api.approveAttachment(productionId, { kind, id });
        await onChanged();
        toast.success("Approved");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to approve"));
      }
    }
    const [saveAsSuggestion, setSaveAsSuggestion] = useState(false);
    const attachmentStatus = canApprove && saveAsSuggestion ? "suggested" as const : undefined;

    const sortedCharacters = sortByName(characters);
    const sortedCastableUsers = [...castableUsers].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
    );
    const personOptions = useMemo(
      () => buildPersonOptions(sortByName(characters), [...castableUsers]),
      [characters, castableUsers],
    );
    const blockingSubjectOptions = useMemo(
      () => buildBlockingSubjectOptions(sortByName(characters), castableUsers, groups),
      [characters, castableUsers, groups],
    );
    const characterOptions = useMemo(
      () =>
        sortByName(characters).map((character) => {
          const search = characterOptionSearchMeta(character);
          return {
            value: String(character.id),
            label: character.name,
            hint: search.hint,
            keywords: search.keywords,
          };
        }),
      [characters],
    );
    const movementSubjectOptions = useMemo(
      () =>
        buildMovementSubjectOptions(
          sortByName(characters),
          castableUsers,
          sortByName(groups),
        ),
      [characters, castableUsers, groups],
    );
    const onStageSubjectValues = useMemo(() => {
      const values = new Set<string>();
      for (const character of detail.on_stage_characters) {
        values.add(`character:${character.id}`);
      }
      for (const group of detail.on_stage_groups ?? []) {
        values.add(`group:${group.id}`);
      }
      for (const person of detail.on_stage_users ?? []) {
        values.add(`user:${person.id}`);
      }
      return values;
    }, [detail.on_stage_characters, detail.on_stage_groups, detail.on_stage_users]);
    const entranceMovementOptions = useMemo(
      () => movementSubjectOptions.filter((option) => !onStageSubjectValues.has(option.value)),
      [movementSubjectOptions, onStageSubjectValues],
    );
    const exitMovementOptions = useMemo(
      () => movementSubjectOptions.filter((option) => onStageSubjectValues.has(option.value)),
      [movementSubjectOptions, onStageSubjectValues],
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
      if (characters.length > 0 || castableUsers.length > 0 || groups.length > 0) {
        available.add("entrance");
        available.add("exit");
      }
      if (characters.length > 0 || castableUsers.length > 0 || groups.length > 0) {
        available.add("blocking");
      }
      return ATTACHMENT_TYPE_OPTIONS.filter((option) => available.has(option.value));
    }, [
      propsCatalog.length,
      setPiecesCatalog.length,
      costumesCatalog.length,
      cueCategories.length,
      characters.length,
      castableUsers.length,
      groups.length,
    ]);

    const [saving, setSaving] = useState(false);
    const [importedDataExpanded, setImportedDataExpanded] = useState(false);

    const [parsedText, setParsedText] = useState(detail.parsed_text ?? "");
    const [stageDirectionText, setStageDirectionText] = useState(detail.stage_direction ?? "");
    const [selectedTypeId, setSelectedTypeId] = useState(
      () => momentTypes.find((type) => type.name === detail.moment_type)?.id ?? "",
    );
    const [selectedSongId, setSelectedSongId] = useState(
      detail.song_id !== null ? String(detail.song_id) : "",
    );

    const [dialogueSubjects, setDialogueSubjects] = useState(() =>
      uniqueEncodedSubjects(detail.dialogue),
    );
    const [dialogueText, setDialogueText] = useState(
      () => detail.dialogue[0]?.dialogue_text ?? "",
    );

    const [lyricSubjects, setLyricSubjects] = useState(() =>
      uniqueEncodedSubjects(detail.lyrics ?? []),
    );
    const [lyricText, setLyricText] = useState(() => detail.lyrics?.[0]?.lyric_text ?? "");

    const [songSubjects, setSongSubjects] = useState(() =>
      uniqueEncodedSubjects(detail.song_attribution ?? []),
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

    const [attachEntranceSubject, setAttachEntranceSubject] = useState("");
    const [attachEntranceNotes, setAttachEntranceNotes] = useState("");
    const [attachExitSubject, setAttachExitSubject] = useState("");
    const [attachExitNotes, setAttachExitNotes] = useState("");
    const [attachBlockingSubjectType, setAttachBlockingSubjectType] = useState<
      BlockingSubjectType | ""
    >("");
    const [attachBlockingCharacterId, setAttachBlockingCharacterId] = useState("");
    const [attachBlockingUserId, setAttachBlockingUserId] = useState("");
    const [attachBlockingGroupId, setAttachBlockingGroupId] = useState("");
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
      setAttachEntranceSubject("");
      setAttachEntranceNotes("");
      setAttachExitSubject("");
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

    const draftMomentType =
      momentTypes.find((t) => String(t.id) === String(selectedTypeId))?.name ??
      detail.moment_type;

    const isSongRelated =
      Boolean(selectedSongId) ||
      draftMomentType === "song_header" ||
      draftMomentType === "song_attribution" ||
      draftMomentType === "lyric";

    const momentFieldsDirty =
      parsedText !== (detail.parsed_text ?? "") ||
      String(selectedTypeId) !==
        String(momentTypes.find((type) => type.name === detail.moment_type)?.id ?? "") ||
      selectedSongId !== (detail.song_id !== null ? String(detail.song_id) : "");

    const stageDirty =
      draftMomentType === "stage_direction" &&
      stageDirectionText !== (detail.stage_direction ?? "");

    const dialogueDirty =
      draftMomentType === "dialogue" &&
      (!sameSubjectValues(dialogueSubjects, uniqueEncodedSubjects(detail.dialogue)) ||
        ((dialogueSubjects.length > 0 || detail.dialogue.length > 0) &&
          dialogueText.trim() !== (detail.dialogue[0]?.dialogue_text ?? "").trim()));

    const lyricDirty =
      draftMomentType === "lyric" &&
      (!sameSubjectValues(lyricSubjects, uniqueEncodedSubjects(detail.lyrics ?? [])) ||
        ((lyricSubjects.length > 0 || (detail.lyrics?.length ?? 0) > 0) &&
          lyricText.trim() !== (detail.lyrics?.[0]?.lyric_text ?? "").trim()));

    const songAttributionDirty =
      draftMomentType === "song_attribution" &&
      !sameSubjectValues(
        songSubjects,
        uniqueEncodedSubjects(detail.song_attribution ?? []),
      );

    const scriptDirty =
      canEditScript &&
      (momentFieldsDirty ||
        stageDirty ||
        dialogueDirty ||
        lyricDirty ||
        songAttributionDirty);

    function resetScriptDraftsFromDetail(source: MomentDetailResponse) {
      setParsedText(source.parsed_text ?? "");
      setStageDirectionText(source.stage_direction ?? "");
      setSelectedTypeId(
        momentTypes.find((type) => type.name === source.moment_type)?.id ?? "",
      );
      setSelectedSongId(source.song_id !== null ? String(source.song_id) : "");
      setDialogueSubjects(uniqueEncodedSubjects(source.dialogue));
      setDialogueText(source.dialogue[0]?.dialogue_text ?? "");
      setLyricSubjects(uniqueEncodedSubjects(source.lyrics ?? []));
      setLyricText(source.lyrics?.[0]?.lyric_text ?? "");
      setSongSubjects(uniqueEncodedSubjects(source.song_attribution ?? []));
    }

    useEffect(() => {
      setParsedText(detail.parsed_text ?? "");
      setStageDirectionText(detail.stage_direction ?? "");
      setSelectedTypeId(
        momentTypes.find((type) => type.name === detail.moment_type)?.id ?? "",
      );
      setSelectedSongId(detail.song_id !== null ? String(detail.song_id) : "");
      setDialogueSubjects(uniqueEncodedSubjects(detail.dialogue));
      setDialogueText(detail.dialogue[0]?.dialogue_text ?? "");
      setLyricSubjects(uniqueEncodedSubjects(detail.lyrics ?? []));
      setLyricText(detail.lyrics?.[0]?.lyric_text ?? "");
      setSongSubjects(uniqueEncodedSubjects(detail.song_attribution ?? []));
    }, [detail, momentTypes]);

    useEffect(() => {
      onScriptDirtyChange?.(scriptDirty);
    }, [scriptDirty, onScriptDirtyChange]);

    async function saveScript(forceTypeChange = false) {
      if (!canEditScript) return;

      // Capture drafts before any await so mid-save detail sync cannot wipe them.
      const captured = {
        momentFieldsDirty,
        stageDirty,
        dialogueDirty,
        lyricDirty,
        songAttributionDirty,
        scriptDirty,
        draftMomentType,
        parsedText,
        selectedTypeId,
        selectedSongId,
        stageDirectionText,
        dialogueSubjects: [...dialogueSubjects],
        dialogueText,
        lyricSubjects: [...lyricSubjects],
        lyricText,
        songSubjects: [...songSubjects],
      };

      if (!captured.scriptDirty && !forceTypeChange) return;

      if (
        captured.draftMomentType === "dialogue" &&
        captured.dialogueSubjects.length > 0 &&
        !captured.dialogueText.trim()
      ) {
        toast.error("Dialogue text is required");
        return;
      }
      if (
        captured.draftMomentType === "lyric" &&
        captured.lyricSubjects.length > 0 &&
        !captured.lyricText.trim()
      ) {
        toast.error("Lyric text is required");
        return;
      }

      setSaving(true);
      let latest = detailRef.current;
      try {
        if (captured.momentFieldsDirty || forceTypeChange) {
          try {
            latest = await api.updateMoment(productionId, latest.id, {
              moment_type_id: captured.selectedTypeId
                ? Number(captured.selectedTypeId)
                : undefined,
              parsed_text: captured.parsedText.trim() || null,
              song_id: captured.selectedSongId ? Number(captured.selectedSongId) : null,
              force_type_change: forceTypeChange || undefined,
            });
            onDetailUpdate(latest);
          } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
              const proceed = await confirm({
                title: "Change moment type?",
                description: `${formatApiError(err, "Conflict")} Structured dialogue or stage direction data will be orphaned.`,
                confirmLabel: "Change type",
              });
              if (proceed) {
                await saveScript(true);
                return;
              }
              return;
            }
            throw err;
          }
        }

        if (
          captured.draftMomentType === "stage_direction" &&
          captured.stageDirty &&
          (latest.stage_direction || captured.stageDirectionText.trim())
        ) {
          latest = await api.updateStageDirection(productionId, latest.id, {
            direction_text: captured.stageDirectionText,
          });
          onDetailUpdate(latest);
        }

        if (captured.draftMomentType === "dialogue" && captured.dialogueDirty) {
          const hadDialogue = (latest.dialogue?.length ?? 0) > 0;
          if (captured.dialogueSubjects.length > 0 || hadDialogue) {
            const text =
              captured.dialogueText.trim() ||
              latest.dialogue[0]?.dialogue_text ||
              "";
            latest = await api.replaceDialogueAttributions(productionId, latest.id, {
              subjects: decodeAttributionSubjects(captured.dialogueSubjects),
              dialogue_text: text,
            });
            onDetailUpdate(latest);
          }
        }

        if (captured.draftMomentType === "lyric" && captured.lyricDirty) {
          const hadLyrics = (latest.lyrics?.length ?? 0) > 0;
          if (captured.lyricSubjects.length > 0 || hadLyrics) {
            const text =
              captured.lyricText.trim() || latest.lyrics?.[0]?.lyric_text || "";
            latest = await api.replaceLyricAttributions(productionId, latest.id, {
              subjects: decodeAttributionSubjects(captured.lyricSubjects),
              lyric_text: text,
            });
            onDetailUpdate(latest);
          }
        }

        if (
          captured.draftMomentType === "song_attribution" &&
          captured.songAttributionDirty
        ) {
          const hadSongAttribution = (latest.song_attribution?.length ?? 0) > 0;
          if (captured.songSubjects.length > 0 || hadSongAttribution) {
            latest = await api.replaceSongAttributions(productionId, latest.id, {
              subjects: decodeAttributionSubjects(captured.songSubjects),
            });
            onDetailUpdate(latest);
          }
        }

        await onChanged();
        toast.success("Moment saved");
      } catch (err) {
        toast.error(formatApiError(err, "Failed to save moment"));
      } finally {
        setSaving(false);
      }
    }

    function discardScript() {
      resetScriptDraftsFromDetail(detailRef.current);
    }

    useImperativeHandle(ref, () => ({
      flushPendingSaves: async () => {
        await saveScript();
      },
      saveScript: async () => {
        await saveScript();
      },
      discardScript,
      isScriptDirty: () => scriptDirty,
    }));

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
          status: attachmentStatus,
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
          status: attachmentStatus,
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
          status: attachmentStatus,
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
      if (!attachEntranceSubject) return;
      const subject = decodeMovementSubject(attachEntranceSubject);

      setSaving(true);
      try {
        await api.attachMomentEntrance(productionId, detail.id, {
          character_id: subject.characterId,
          user_id: subject.userId,
          group_id: subject.groupId,
          notes: attachEntranceNotes.trim() || null,
          status: attachmentStatus,
        });
        setAttachEntranceSubject("");
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
      if (!attachExitSubject) return;
      const subject = decodeMovementSubject(attachExitSubject);

      setSaving(true);
      try {
        await api.attachMomentExit(productionId, detail.id, {
          character_id: subject.characterId,
          user_id: subject.userId,
          group_id: subject.groupId,
          notes: attachExitNotes.trim() || null,
          status: attachmentStatus,
        });
        setAttachExitSubject("");
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
      if (!attachBlockingSubjectType || !attachBlockingNotes.trim()) return;
      if (attachBlockingSubjectType === "character" && !attachBlockingCharacterId) return;
      if (attachBlockingSubjectType === "user" && !attachBlockingUserId) return;
      if (attachBlockingSubjectType === "group" && !attachBlockingGroupId) return;

      setSaving(true);
      try {
        await api.attachMomentBlocking(productionId, detail.id, {
          character_id:
            attachBlockingSubjectType === "character"
              ? Number(attachBlockingCharacterId)
              : null,
          user_id:
            attachBlockingSubjectType === "user" ? Number(attachBlockingUserId) : null,
          group_id:
            attachBlockingSubjectType === "group" ? Number(attachBlockingGroupId) : null,
          notes: attachBlockingNotes.trim(),
          status: attachmentStatus,
        });
        setAttachBlockingSubjectType("");
        setAttachBlockingCharacterId("");
        setAttachBlockingUserId("");
        setAttachBlockingGroupId("");
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
          status: attachmentStatus,
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
        {/* Plain header — panel is used both in Sheet and co-planar aside (no Dialog context). */}
        <div className="space-y-1.5">
          <p
            className={cn(
              "text-sm text-muted-foreground",
              hideScriptPreview && "sr-only",
            )}
          >
            Moment #{detail.sequence_number}
          </p>
          <div className="flex items-center gap-2">
            <h2 className="sr-only">Moment {detail.sequence_number}</h2>
            {!hideScriptPreview && (
              <Badge className={cn("capitalize", momentBadgeClass(detail.moment_type))}>
                {momentTypeLabel(detail.moment_type)}
              </Badge>
            )}
            {saving && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
          </div>
        </div>

        {/* Primary script content — emphasized above imported metadata */}
        {((canEditScript && draftMomentType === "stage_direction") ||
          (!canEditScript &&
            !hideScriptPreview &&
            detail.moment_type === "stage_direction")) &&
          (canEditScript || detail.stage_direction) && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stage direction
            </h3>
            {canEditScript ? (
              <Textarea
                value={stageDirectionText}
                onChange={(e) => setStageDirectionText(e.target.value)}
                rows={1}
                className="mt-2 min-h-[3rem] resize-none overflow-hidden font-script whitespace-pre-wrap text-base italic leading-relaxed"
              />
            ) : (
              <p className="mt-1 font-script whitespace-pre-wrap text-base italic leading-relaxed">
                {detail.stage_direction}
              </p>
            )}
          </div>
        )}

        {canEditScript && draftMomentType === "dialogue" && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dialogue
            </h3>
            <div className="mt-2 space-y-2">
              <AttributionSubjectMultiSelect
                characters={sortedCharacters}
                groups={sortByName(groups)}
                selectedValues={dialogueSubjects}
                disabled={saving}
                emptyLabel="Add speaker"
                ariaLabel="Select dialogue speakers"
                onChange={setDialogueSubjects}
              />
              <Textarea
                value={dialogueText}
                onChange={(e) => setDialogueText(e.target.value)}
                rows={3}
                placeholder="Dialogue text"
                className="min-h-[4rem] resize-y font-script whitespace-pre-wrap text-base leading-relaxed"
              />
            </div>
          </div>
        )}

        {detail.moment_type !== "stage_direction" &&
          detail.dialogue.length > 0 &&
          !canEditScript &&
          !hideScriptPreview && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dialogue
            </h3>
            <ul className="mt-2 space-y-2">
              {detail.dialogue.map((line) => (
                <li key={line.id} className="font-script text-base leading-relaxed">
                  <DetailObjectLabel
                    label={dialogueSpeakerLabel(line)}
                    objectType={
                      line.group_id != null
                        ? "group"
                        : line.character_id != null
                          ? "character"
                          : undefined
                    }
                    objectId={line.group_id ?? line.character_id}
                  />
                  : {line.dialogue_text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {canEditScript && draftMomentType === "lyric" && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lyric
            </h3>
            <div className="mt-2 space-y-2">
              <AttributionSubjectMultiSelect
                characters={sortedCharacters}
                groups={sortByName(groups)}
                selectedValues={lyricSubjects}
                disabled={saving}
                emptyLabel="Add singer"
                ariaLabel="Select lyric singers"
                onChange={setLyricSubjects}
              />
              <Textarea
                value={lyricText}
                onChange={(e) => setLyricText(e.target.value)}
                rows={3}
                placeholder="Lyric text"
                className="min-h-[4rem] resize-y font-script whitespace-pre-wrap text-base leading-relaxed"
              />
            </div>
          </div>
        )}

        {detail.moment_type === "lyric" &&
          (detail.lyrics?.length ?? 0) > 0 &&
          !canEditScript &&
          !hideScriptPreview && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lyric
            </h3>
            <ul className="mt-2 space-y-2">
              {detail.lyrics.map((line) => (
                <li key={line.id} className="font-script text-base leading-relaxed">
                  <DetailObjectLabel
                    label={dialogueSpeakerLabel(line)}
                    objectType={
                      line.group_id != null
                        ? "group"
                        : line.character_id != null
                          ? "character"
                          : undefined
                    }
                    objectId={line.group_id ?? line.character_id}
                  />
                  : {line.lyric_text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {canEditScript && draftMomentType === "song_attribution" && (
          <div className="rounded-md bg-muted/60 px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Attribution
            </h3>
            <div className="mt-2 space-y-2">
              <AttributionSubjectMultiSelect
                characters={sortedCharacters}
                groups={sortByName(groups)}
                selectedValues={songSubjects}
                disabled={saving}
                emptyLabel="Add attribution"
                ariaLabel="Select song attribution subjects"
                onChange={setSongSubjects}
              />
              {(detail.parsed_text || detail.original_text) && (
                <p className="font-script whitespace-pre-wrap text-sm text-muted-foreground">
                  {detail.parsed_text || detail.original_text}
                </p>
              )}
            </div>
          </div>
        )}

        {((canEditScript && draftMomentType === "song_header") ||
          (!hideScriptPreview &&
            !canEditScript &&
            (detail.moment_type === "song_header" ||
              detail.moment_type === "song_attribution" ||
              (detail.moment_type === "lyric" &&
                (detail.lyrics?.length ?? 0) === 0)))) &&
          (detail.parsed_text || detail.original_text) && (
            <div className="rounded-md bg-muted/60 px-3 py-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {(canEditScript ? draftMomentType : detail.moment_type) === "lyric"
                  ? "Lyric"
                  : (canEditScript ? draftMomentType : detail.moment_type) ===
                      "song_header"
                    ? "Song title"
                    : "Attribution"}
              </h3>
              <p className="mt-1 font-script whitespace-pre-wrap text-base leading-relaxed">
                {detail.parsed_text || detail.original_text}
              </p>
            </div>
          )}

        {appSettings.show_original_text && !hideScriptPreview && (
          <div>
            <h3 className="text-sm font-medium">Original text</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {detail.original_text}
            </p>
          </div>
        )}

        {canEditScript && isSongRelated && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Linked song</Label>
            <Select
              value={selectedSongId || NO_SONG_VALUE}
              onValueChange={(value) =>
                setSelectedSongId(value === NO_SONG_VALUE ? "" : value)
              }
            >
              <SelectTrigger className="w-full">
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

        {!canEditScript &&
          !hideScriptPreview &&
          appSettings.show_parsed_text &&
          detail.parsed_text && (
          <div>
            <h3 className="text-sm font-medium">Imported text</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {detail.parsed_text}
            </p>
          </div>
        )}

        {detail.song_title && !canEditScript && isSongRelated && detail.song_id != null && (
          <div>
            <h3 className="text-sm font-medium">Song</h3>
            <p className="mt-1 text-sm">
              <ObjectLink
                objectType="song"
                objectId={detail.song_id}
                label={detail.song_title}
              />
            </p>
          </div>
        )}

        {canEdit && (
          <div className="rounded-md border border-border p-3">
            <button
              type="button"
              onClick={() => setAddSectionExpanded((open) => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                      aria-label={option.label}
                      aria-pressed={selected}
                      onClick={() => selectAttachmentType(option.value)}
                      className={cn(
                        "flex min-w-0 flex-col items-center gap-1 rounded-md border px-1 py-2 text-[10px] font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="w-full text-center leading-tight break-words">
                        {option.label}
                      </span>
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

            {addAttachmentType === "entrance" &&
              (characters.length > 0 || groups.length > 0) && (
              <form onSubmit={(e) => void handleAttachEntrance(e)} className="mt-3 space-y-2">
                {entranceMovementOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Everyone listed is already on stage at this moment.
                  </p>
                ) : (
                  <SearchableSelect
                    options={entranceMovementOptions}
                    value={attachEntranceSubject}
                    onChange={setAttachEntranceSubject}
                    placeholder="Select who is not on stage…"
                    clearLabel="Clear selection"
                  />
                )}
                <Input
                  value={attachEntranceNotes}
                  onChange={(e) => setAttachEntranceNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    saving || !attachEntranceSubject || entranceMovementOptions.length === 0
                  }
                >
                  Add
                </Button>
              </form>
            )}

            {addAttachmentType === "exit" &&
              (characters.length > 0 || groups.length > 0) && (
              <form onSubmit={(e) => void handleAttachExit(e)} className="mt-3 space-y-2">
                {exitMovementOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No characters or groups are on stage at this moment yet.
                  </p>
                ) : (
                <SearchableSelect
                  options={exitMovementOptions}
                  value={attachExitSubject}
                  onChange={setAttachExitSubject}
                  placeholder="Select who is on stage…"
                  clearLabel="Clear selection"
                />
                )}
                <Input
                  value={attachExitNotes}
                  onChange={(e) => setAttachExitNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={saving || !attachExitSubject || exitMovementOptions.length === 0}
                >
                  Add
                </Button>
              </form>
            )}

            {addAttachmentType === "blocking" &&
              (characters.length > 0 || castableUsers.length > 0 || groups.length > 0) && (
              <form onSubmit={(e) => void handleAttachBlocking(e)} className="mt-3 space-y-2">
                <SearchableSelect
                  options={blockingSubjectOptions}
                  value={encodeBlockingSubjectValue(
                    attachBlockingSubjectType,
                    attachBlockingCharacterId,
                    attachBlockingUserId,
                    attachBlockingGroupId,
                  )}
                  onChange={(value) => {
                    const decoded = decodeBlockingSubjectValue(value);
                    setAttachBlockingSubjectType(decoded.subjectType);
                    setAttachBlockingCharacterId(decoded.characterId);
                    setAttachBlockingUserId(decoded.userId);
                    setAttachBlockingGroupId(decoded.groupId);
                  }}
                  placeholder="Select character, user, or group…"
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
                    saving ||
                    !attachBlockingSubjectType ||
                    !attachBlockingNotes.trim() ||
                    (attachBlockingSubjectType === "character" &&
                      !attachBlockingCharacterId) ||
                    (attachBlockingSubjectType === "user" && !attachBlockingUserId) ||
                    (attachBlockingSubjectType === "group" && !attachBlockingGroupId)
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
          iconKind="prop"
          emptyMessage="No prop events on this moment."
          canEdit={canAttach}
          saving={saving}
          productionId={productionId}
          defaultExpanded={detail.props.length > 0}
          expandSignal={propsExpandSignal}
          events={detail.props.map((prop) => ({
            id: prop.id,
            assetName: prop.prop_name,
            assetObjectType: "prop" as const,
            assetObjectId: prop.prop_id,
            kind: prop.kind as AssetEventKind,
            character_id: prop.character_id,
            character_name: prop.character_name,
            user_id: prop.user_id,
            user_display_name: prop.user_display_name,
            notes: prop.notes,
            priorOnActNumber: prop.prior_on_act_number ?? null,
            priorOnSceneNumber: prop.prior_on_scene_number ?? null,
            priorOnSequenceNumber: prop.prior_on_sequence_number ?? null,
            ...prepDisplay(prop),
            onApprove:
              prop.status === "suggested" && canApprove
                ? () => void handleApprove("prop_event", prop.id)
                : undefined,
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
              labelObjectType: "prop" as const,
              labelObjectId: item.prop_id,
              personLabel: item.character_name ?? item.user_display_name,
              personObjectType: item.character_id != null ? ("character" as const) : undefined,
              personObjectId: item.character_id,
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
          iconKind="set_piece"
          emptyMessage="No set piece events on this moment."
          canEdit={canAttach}
          saving={saving}
          productionId={productionId}
          defaultExpanded={detail.set_pieces.length > 0}
          expandSignal={setPiecesExpandSignal}
          events={detail.set_pieces.map((piece) => ({
            id: piece.id,
            assetName: piece.set_piece_name,
            assetObjectType: "set_piece" as const,
            assetObjectId: piece.set_piece_id,
            kind: piece.kind as AssetEventKind,
            character_id: piece.character_id,
            character_name: piece.character_name,
            user_id: piece.user_id,
            user_display_name: piece.user_display_name,
            notes: piece.notes,
            priorOnActNumber: piece.prior_on_act_number ?? null,
            priorOnSceneNumber: piece.prior_on_scene_number ?? null,
            priorOnSequenceNumber: piece.prior_on_sequence_number ?? null,
            ...prepDisplay(piece),
            onApprove:
              piece.status === "suggested" && canApprove
                ? () => void handleApprove("set_piece_event", piece.id)
                : undefined,
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
              labelObjectType: "set_piece" as const,
              labelObjectId: item.set_piece_id,
              personLabel: item.character_name ?? item.user_display_name,
              personObjectType: item.character_id != null ? ("character" as const) : undefined,
              personObjectId: item.character_id,
              sourceActNumber: item.source_act_number,
              sourceSceneNumber: item.source_scene_number,
              sourceSequenceNumber: item.source_sequence_number,
              nextChangeActNumber: item.next_change_act_number,
              nextChangeSceneNumber: item.next_change_scene_number,
              nextChangeSequenceNumber: item.next_change_sequence_number,
            }))}
        />

        <CostumeEventSection
          canEdit={canAttach}
          canApprove={canApprove}
          saving={saving}
          productionId={productionId}
          defaultExpanded={detail.costume_events.length > 0}
          events={detail.costume_events}
          costumesCatalog={costumesCatalog}
          onUpdate={handleUpdateMomentCostume}
          onDetach={handleDetachCostume}
          onApprove={(eventId) => void handleApprove("costume_event", eventId)}
          wearing={detail.costumes_wearing.filter(
            (item) => item.source_moment_id !== detail.id,
          )}
        />

        {canApprove && (
          <label className="flex items-center gap-2 border-t border-border pt-4 text-sm">
            <input
              type="checkbox"
              checked={saveAsSuggestion}
              onChange={(event) => setSaveAsSuggestion(event.target.checked)}
            />
            Save new actions as suggestions
          </label>
        )}

        <AttachmentSection
          productionId={productionId}
          title="Entrances"
          iconKind="entrance"
          emptyMessage="No entrances recorded."
          canEdit={canAttach}
          saving={saving}
          defaultExpanded={detail.entrances.length > 0}
          items={detail.entrances.map((entrance) => {
            const subject = movementSubjectObject(entrance);
            return {
            id: entrance.id,
            label: movementRowLabel(entrance),
            objectType: subject.objectType,
            objectId: subject.objectId,
            notes: entrance.notes ?? undefined,
            status: entrance.status,
            createdBy: entrance.created_by_display_name,
            createdAt: entrance.created_at,
            updatedBy: entrance.updated_by_display_name,
            updatedAt: entrance.updated_at,
            rehearsalId: entrance.rehearsal_id,
            rehearsalLabel: entrance.rehearsal_label,
            onApprove:
              entrance.status === "suggested" && canApprove
                ? () => void handleApprove("entrance", entrance.id)
                : undefined,
          };
          })}
          onDetach={handleDetachEntrance}
          catalogLength={characters.length + castableUsers.length + groups.length}
        />

        <AttachmentSection
          productionId={productionId}
          title="Exits"
          iconKind="exit"
          emptyMessage="No exits recorded."
          canEdit={canAttach}
          saving={saving}
          defaultExpanded={detail.exits.length > 0}
          items={detail.exits.map((exitRow) => {
            const subject = movementSubjectObject(exitRow);
            return {
            id: exitRow.id,
            label: movementRowLabel(exitRow),
            objectType: subject.objectType,
            objectId: subject.objectId,
            notes: exitRow.notes ?? undefined,
            status: exitRow.status,
            createdBy: exitRow.created_by_display_name,
            createdAt: exitRow.created_at,
            updatedBy: exitRow.updated_by_display_name,
            updatedAt: exitRow.updated_at,
            rehearsalId: exitRow.rehearsal_id,
            rehearsalLabel: exitRow.rehearsal_label,
            onApprove:
              exitRow.status === "suggested" && canApprove
                ? () => void handleApprove("exit", exitRow.id)
                : undefined,
          };
          })}
          onDetach={handleDetachExit}
          catalogLength={characters.length + castableUsers.length + groups.length}
        />

        <AttachmentSection
          productionId={productionId}
          title="Blocking"
          iconKind="blocking"
          emptyMessage="No blocking notes."
          canEdit={canAttach}
          saving={saving}
          defaultExpanded={detail.blocking.length > 0}
          items={detail.blocking.map((row) => ({
            id: row.id,
            label: blockingSubjectLabel(row),
            objectType:
              row.character_id != null
                ? ("character" as const)
                : row.group_id != null
                  ? ("group" as const)
                  : undefined,
            objectId: row.character_id ?? row.group_id,
            notes: row.notes ?? undefined,
            status: row.status,
            createdBy: row.created_by_display_name,
            createdAt: row.created_at,
            updatedBy: row.updated_by_display_name,
            updatedAt: row.updated_at,
            rehearsalId: row.rehearsal_id,
            rehearsalLabel: row.rehearsal_label,
            onApprove:
              row.status === "suggested" && canApprove
                ? () => void handleApprove("blocking", row.id)
                : undefined,
            editableNotes: canEdit,
            onNotesBlur: (notes: string) => {
              if (notes.trim() !== (row.notes ?? "")) {
                void handleUpdateBlockingNotes(row.id, notes);
              }
            },
          }))}
          onDetach={handleDetachBlocking}
          catalogLength={characters.length + castableUsers.length + groups.length}
        />

        <AttachmentSection
          productionId={productionId}
          title="Cues"
          iconKind="cue"
          emptyMessage="No cues attached."
          canEdit={canAttach}
          saving={saving}
          defaultExpanded={detail.cues.length > 0}
          items={detail.cues.map((cue) => ({
            id: cue.id,
            label: cue.title,
            objectType: "cue" as const,
            objectId: cue.id,
            momentId: detail.id,
            sublabel: cue.cue_category_name,
            notes: cue.notes ?? undefined,
            status: cue.status,
            createdBy: cue.created_by_display_name,
            createdAt: cue.created_at,
            updatedBy: cue.updated_by_display_name,
            updatedAt: cue.updated_at,
            rehearsalId: cue.rehearsal_id,
            rehearsalLabel: cue.rehearsal_label,
            onApprove:
              cue.status === "suggested" && canApprove
                ? () => void handleApprove("cue", cue.id)
                : undefined,
          }))}
          onDetach={handleDeleteCue}
          catalogLength={cueCategories.length}
        />

        <div className="border-t border-border pt-4">
          <NotesPanel
            productionId={productionId}
            momentId={detail.id}
            canPublish={canPublishNotes}
            canDeleteAny={hasCapability("notes", "delete") && canApprove}
          />
        </div>

        {canEditScript && (
          <div className="rounded-md border border-border p-3">
            <button
              type="button"
              onClick={() => setImportedDataExpanded((open) => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-expanded={importedDataExpanded}
            >
              <h3 className="text-sm font-medium">Imported data</h3>
              <span className="text-xs text-muted-foreground">
                {importedDataExpanded ? "▾" : "▸"}
              </span>
            </button>

            {importedDataExpanded && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Moment type</Label>
                  <Select
                    value={String(selectedTypeId)}
                    onValueChange={(value) => {
                      setSelectedTypeId(value);
                      const nextType = momentTypes.find(
                        (type) => String(type.id) === String(value),
                      )?.name;
                      if (nextType === "dialogue") {
                        if (!dialogueText.trim() && detail.dialogue.length === 0) {
                          setDialogueText(
                            lyricText.trim() ||
                              detail.parsed_text ||
                              detail.original_text ||
                              "",
                          );
                        }
                        if (
                          dialogueSubjects.length === 0 &&
                          lyricSubjects.length > 0 &&
                          detail.dialogue.length === 0
                        ) {
                          setDialogueSubjects(lyricSubjects);
                        }
                      }
                      if (nextType === "lyric") {
                        if (!lyricText.trim() && (detail.lyrics?.length ?? 0) === 0) {
                          setLyricText(
                            dialogueText.trim() ||
                              detail.parsed_text ||
                              detail.original_text ||
                              "",
                          );
                        }
                        if (
                          lyricSubjects.length === 0 &&
                          dialogueSubjects.length > 0 &&
                          (detail.lyrics?.length ?? 0) === 0
                        ) {
                          setLyricSubjects(dialogueSubjects);
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
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
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

function AttachmentSection({
  productionId,
  title,
  iconKind,
  emptyMessage,
  canEdit,
  saving,
  items,
  onDetach,
  catalogLength,
  defaultExpanded = true,
  attachForm,
}: {
  productionId: number;
  title: string;
  /** When set, section header uses the shared domain icon. */
  iconKind?: MomentAttachmentKind;
  emptyMessage: string;
  canEdit: boolean;
  saving: boolean;
  items: {
    id: number;
    label: string;
    objectType?: ObjectDetailType;
    objectId?: number | null;
    momentId?: number;
    sublabel?: string;
    notes?: string;
    status?: "suggested" | "official";
    createdBy?: string | null;
    createdAt?: string | null;
    updatedBy?: string | null;
    updatedAt?: string | null;
    rehearsalId?: number | null;
    rehearsalLabel?: string | null;
    onApprove?: () => void;
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
  const Icon = iconKind ? domainIcon(iconKind) : null;

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">
          {hasContent ? `${items.length}` : "—"} {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded && (
        <>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-sm",
                    item.status === "suggested"
                      ? "border-dashed border-amber-500"
                      : "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-x-1 gap-y-1">
                    <div className="min-w-0 flex-1 leading-snug">
                      <DetailObjectLabel
                        label={item.label}
                        objectType={item.objectType}
                        objectId={item.objectId}
                        momentId={item.momentId}
                      />
                      {item.sublabel && (
                        <span className="text-muted-foreground"> — {item.sublabel}</span>
                      )}
                      {!item.editableNotes && item.notes ? (
                        <span className="text-muted-foreground"> — {item.notes}</span>
                      ) : null}
                      {item.editableNotes && canEdit ? (
                        <Input
                          defaultValue={item.notes}
                          disabled={saving}
                          onBlur={(e) => item.onNotesBlur?.(e.target.value)}
                          className="mt-1 h-7"
                          placeholder="Notes"
                        />
                      ) : null}
                    </div>
                    <AttributionInfo
                      createdBy={item.createdBy}
                      createdAt={item.createdAt}
                      updatedBy={item.updatedBy}
                      updatedAt={item.updatedAt}
                      rehearsalId={item.rehearsalId}
                      rehearsalLabel={item.rehearsalLabel}
                      productionId={productionId}
                    />
                    {item.onApprove && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={item.onApprove}
                        aria-label="Approve suggestion"
                        title="Approve"
                        className="shrink-0 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                      >
                        <Check />
                      </Button>
                    )}
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

function prepDisplay(row: PrepRecordFields) {
  return {
    status: row.status,
    createdBy: row.created_by_display_name,
    createdAt: row.created_at,
    updatedBy: row.updated_by_display_name,
    updatedAt: row.updated_at,
    rehearsalId: row.rehearsal_id,
    rehearsalLabel: row.rehearsal_label,
  };
}

interface AssetEventItem {
  id: number;
  assetName: string;
  assetObjectType?: ObjectDetailType;
  assetObjectId?: number | null;
  kind: AssetEventKind;
  character_id: number | null;
  character_name: string | null;
  user_id: number | null;
  user_display_name: string | null;
  notes: string | null;
  priorOnActNumber: number | null;
  priorOnSceneNumber: number | null;
  priorOnSequenceNumber: number | null;
  status?: "suggested" | "official";
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  rehearsalId?: number | null;
  rehearsalLabel?: string | null;
  onApprove?: () => void;
}

interface AssetInPlayItem {
  key: string;
  label: string;
  labelObjectType?: ObjectDetailType;
  labelObjectId?: number | null;
  personLabel: string | null;
  personObjectType?: ObjectDetailType;
  personObjectId?: number | null;
  sourceActNumber: number;
  sourceSceneNumber: number;
  sourceSequenceNumber: number;
  nextChangeActNumber: number | null;
  nextChangeSceneNumber: number | null;
  nextChangeSequenceNumber: number | null;
}

function AssetEventSection({
  title,
  iconKind,
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
  iconKind?: MomentAttachmentKind;
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
  const Icon = iconKind ? domainIcon(iconKind) : null;

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
          {title}
        </h3>
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
                  <span className="inline-flex flex-wrap items-baseline gap-x-1">
                    <DetailObjectLabel
                      label={item.label}
                      objectType={item.labelObjectType}
                      objectId={item.labelObjectId}
                      className="text-foreground"
                    />
                    {item.personLabel ? (
                      <>
                        <span>—</span>
                        <DetailObjectLabel
                          label={item.personLabel}
                          objectType={item.personObjectType}
                          objectId={item.personObjectId}
                        />
                      </>
                    ) : null}
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
            <ul className="mt-2 space-y-1.5">
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
    <li
      className={cn(
        "rounded-md border px-2 py-1.5 text-sm",
        event.status === "suggested" ? "border-dashed border-amber-500" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start gap-x-1 gap-y-1">
        <div
          className={cn(
            "min-w-0 flex-1 leading-snug",
            canEdit && !editing && "cursor-pointer rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          role={canEdit && !editing ? "button" : undefined}
          tabIndex={canEdit && !editing ? 0 : undefined}
          onClick={
            canEdit && !editing
              ? () => setEditing(true)
              : undefined
          }
          onKeyDown={
            canEdit && !editing
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditing(true);
                  }
                }
              : undefined
          }
        >
          {!editing ? (
            <>
              <DetailObjectLabel
                label={event.assetName}
                objectType={event.assetObjectType}
                objectId={event.assetObjectId}
              />
              <Badge
                variant={event.kind === "on" ? "default" : "secondary"}
                className="ml-1.5 align-middle uppercase"
              >
                {event.kind === "on" ? "On" : "Off"}
              </Badge>
              {personLabel && (
                <>
                  <span className="text-muted-foreground"> — </span>
                  <DetailObjectLabel
                    label={personLabel}
                    objectType={event.character_id != null ? "character" : undefined}
                    objectId={event.character_id}
                  />
                </>
              )}
              {event.notes && (
                <span className="text-muted-foreground"> — {event.notes}</span>
              )}
              {priorOnCode != null && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · Started{" "}
                  <Link
                    to={humanTimelinePath(
                      productionId,
                      event.priorOnActNumber!,
                      event.priorOnSceneNumber!,
                      event.priorOnSequenceNumber!,
                    )}
                    className="underline underline-offset-2 hover:text-foreground"
                    aria-label={`Open start moment ${priorOnCode}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {priorOnCode}
                  </Link>
                </span>
              )}
            </>
          ) : (
            <div className="space-y-2">
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
        {!editing && (
          <>
            <AttributionInfo
              createdBy={event.createdBy}
              createdAt={event.createdAt}
              updatedBy={event.updatedBy}
              updatedAt={event.updatedAt}
              rehearsalId={event.rehearsalId}
              rehearsalLabel={event.rehearsalLabel}
              productionId={productionId}
            />
            {event.onApprove && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  event.onApprove?.();
                }}
                aria-label="Approve suggestion"
                title="Approve"
                className="shrink-0 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
              >
                <Check />
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={saving}
                onClick={() => onDetach(event.id)}
                aria-label={`Remove ${event.assetName} event`}
                title="Remove"
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 />
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function CostumeEventSection({
  canEdit,
  canApprove,
  saving,
  productionId,
  events,
  costumesCatalog,
  onUpdate,
  onDetach,
  onApprove,
  defaultExpanded = true,
  wearing,
}: {
  canEdit: boolean;
  canApprove: boolean;
  saving: boolean;
  productionId: number;
  events: MomentCostumeEventResponse[];
  costumesCatalog: CostumeResponse[];
  onUpdate: (
    eventId: number,
    body: { kind: AssetEventKind; costume_id: number | null; notes: string | null },
  ) => void | Promise<void>;
  onDetach: (eventId: number) => void;
  onApprove: (eventId: number) => void;
  defaultExpanded?: boolean;
  wearing: CostumeWearingResponse[];
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const CostumeIcon = domainIcon("costume");

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <CostumeIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          Costumes
        </h3>
        <span className="text-xs text-muted-foreground">
          {events.length > 0 ? `${events.length}` : "—"} {expanded ? "▾" : "▸"}
        </span>
      </button>

      {wearing.length > 0 && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Currently wearing
          </h4>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {wearing.map((item) => {
              const sourceCode = formatMomentCode(
                item.source_act_number,
                item.source_scene_number,
                item.source_sequence_number,
              );
              const hasNextChange =
                item.next_change_act_number != null &&
                item.next_change_scene_number != null &&
                item.next_change_sequence_number != null;
              const nextCode = hasNextChange
                ? formatMomentCode(
                    item.next_change_act_number!,
                    item.next_change_scene_number!,
                    item.next_change_sequence_number!,
                  )
                : null;

              return (
                <li
                  key={`wearing-${item.character_id}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                >
                  <span className="inline-flex flex-wrap items-baseline gap-x-1">
                    <DetailObjectLabel
                      label={item.character_name}
                      objectType="character"
                      objectId={item.character_id}
                      className="text-foreground"
                    />
                    <span>—</span>
                    <DetailObjectLabel
                      label={item.costume_name}
                      objectType="costume"
                      objectId={item.costume_id}
                    />
                  </span>
                  <span className="inline-flex flex-wrap items-center gap-x-1.5">
                    <Link
                      to={humanTimelinePath(
                        productionId,
                        item.source_act_number,
                        item.source_scene_number,
                        item.source_sequence_number,
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
                            item.next_change_act_number!,
                            item.next_change_scene_number!,
                            item.next_change_sequence_number!,
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
            <p className="mt-2 text-sm text-muted-foreground">
              No costume events on this moment.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {events.map((event) => (
                <CostumeEventRow
                  key={event.id}
                  event={event}
                  canEdit={canEdit}
                  saving={saving}
                  productionId={productionId}
                  costumesCatalog={costumesCatalog}
                  onUpdate={onUpdate}
                  onDetach={onDetach}
                  onApprove={
                    canApprove && event.status === "suggested"
                      ? () => onApprove(event.id)
                      : undefined
                  }
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
  productionId,
  costumesCatalog,
  onUpdate,
  onDetach,
  onApprove,
}: {
  event: MomentCostumeEventResponse;
  canEdit: boolean;
  saving: boolean;
  productionId: number;
  costumesCatalog: CostumeResponse[];
  onUpdate: (
    eventId: number,
    body: { kind: AssetEventKind; costume_id: number | null; notes: string | null },
  ) => void | Promise<void>;
  onDetach: (eventId: number) => void;
  onApprove?: () => void;
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
  const priorOnCode =
    event.kind === "off" &&
    event.prior_on_act_number != null &&
    event.prior_on_scene_number != null &&
    event.prior_on_sequence_number != null
      ? formatMomentCode(
          event.prior_on_act_number,
          event.prior_on_scene_number,
          event.prior_on_sequence_number,
        )
      : null;

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
    <li
      className={cn(
        "rounded-md border px-2 py-1.5 text-sm",
        event.status === "suggested" ? "border-dashed border-amber-500" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start gap-x-1 gap-y-1">
        <div
          className={cn(
            "min-w-0 flex-1 leading-snug",
            canEdit && !editing && "cursor-pointer rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          role={canEdit && !editing ? "button" : undefined}
          tabIndex={canEdit && !editing ? 0 : undefined}
          onClick={
            canEdit && !editing
              ? () => setEditing(true)
              : undefined
          }
          onKeyDown={
            canEdit && !editing
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditing(true);
                  }
                }
              : undefined
          }
        >
          {!editing ? (
            <>
              <DetailObjectLabel
                label={event.character_name}
                objectType="character"
                objectId={event.character_id}
              />
              <Badge
                variant={event.kind === "on" ? "default" : "secondary"}
                className="ml-1.5 align-middle"
              >
                {event.kind === "on" ? "Wear" : "Clear"}
              </Badge>
              {event.costume_name && event.costume_id != null ? (
                <>
                  <span className="text-muted-foreground"> — </span>
                  <DetailObjectLabel
                    label={event.costume_name}
                    objectType="costume"
                    objectId={event.costume_id}
                  />
                </>
              ) : event.costume_name ? (
                <span className="text-muted-foreground"> — {event.costume_name}</span>
              ) : null}
              {event.notes && (
                <span className="text-muted-foreground"> — {event.notes}</span>
              )}
              {priorOnCode != null && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · Started{" "}
                  <Link
                    to={humanTimelinePath(
                      productionId,
                      event.prior_on_act_number!,
                      event.prior_on_scene_number!,
                      event.prior_on_sequence_number!,
                    )}
                    className="underline underline-offset-2 hover:text-foreground"
                    aria-label={`Open start moment ${priorOnCode}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {priorOnCode}
                  </Link>
                </span>
              )}
            </>
          ) : (
            <div className="space-y-2">
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
        {!editing && (
          <>
            <AttributionInfo
              createdBy={event.created_by_display_name}
              createdAt={event.created_at}
              updatedBy={event.updated_by_display_name}
              updatedAt={event.updated_at}
              rehearsalId={event.rehearsal_id}
              rehearsalLabel={event.rehearsal_label}
              productionId={productionId}
            />
            {onApprove && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove();
                }}
                aria-label="Approve suggestion"
                title="Approve"
                className="shrink-0 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
              >
                <Check />
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={saving}
                onClick={() => onDetach(event.id)}
                aria-label={`Remove ${event.character_name} costume event`}
                title="Remove"
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 />
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export default MomentDetailPanel;
