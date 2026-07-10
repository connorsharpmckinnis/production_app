import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type {
  ActSummary,
  CharacterDetailResponse,
  CueCategoryResponse,
  GroupResponse,
  MomentDetailResponse,
  MomentListFilters,
  MomentSummary,
  MomentTypeResponse,
  PropResponse,
  SceneSummary,
  SongDetailResponse,
} from "@/lib/types";
import { cn, formatActLabel, momentTypeLabel, truncate } from "@/lib/utils";

function momentBadgeClass(type: string): string {
  switch (type) {
    case "dialogue":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "stage_direction":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "song_header":
    case "song_attribution":
    case "lyric":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function useIsLargeScreen() {
  const [isLarge, setIsLarge] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : true,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLarge(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isLarge;
}

type CharacterFilterValue = "all" | "mine" | string;
type GroupFilterValue = "all" | string;
type ResourceFilterValue = "all" | string;

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const isLargeScreen = useIsLargeScreen();
  const { user, canManagePreparation } = useAuth();

  const [productionTitle, setProductionTitle] = useState<string | null>(null);
  const [acts, setActs] = useState<ActSummary[]>([]);
  const [characters, setCharacters] = useState<CharacterDetailResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [songs, setSongs] = useState<SongDetailResponse[]>([]);
  const [propsCatalog, setPropsCatalog] = useState<PropResponse[]>([]);
  const [cueCategories, setCueCategories] = useState<CueCategoryResponse[]>([]);
  const [momentTypes, setMomentTypes] = useState<MomentTypeResponse[]>([]);
  const [selectedActId, setSelectedActId] = useState<number | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [moments, setMoments] = useState<MomentSummary[]>([]);
  const [selectedMomentId, setSelectedMomentId] = useState<number | null>(null);
  const [momentDetail, setMomentDetail] = useState<MomentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cueOnly, setCueOnly] = useState(false);
  const [characterFilter, setCharacterFilter] = useState<CharacterFilterValue>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilterValue>("all");
  const [songFilter, setSongFilter] = useState<ResourceFilterValue>("all");
  const [propFilter, setPropFilter] = useState<ResourceFilterValue>("all");
  const [cueCategoryFilter, setCueCategoryFilter] = useState<ResourceFilterValue>("all");
  const [momentsRefreshKey, setMomentsRefreshKey] = useState(0);

  const myCharacterIds = useMemo(() => {
    if (!user) return [];
    return characters
      .filter((character) => character.assigned_actor?.user_id === user.id)
      .map((character) => character.id);
  }, [characters, user]);

  const activeCharacterIds = useMemo(() => {
    if (groupFilter !== "all") {
      const group = groups.find((item) => item.id === Number(groupFilter));
      return group?.character_ids;
    }
    if (characterFilter === "all") return undefined;
    if (characterFilter === "mine") return myCharacterIds;
    return [Number(characterFilter)];
  }, [characterFilter, groupFilter, groups, myCharacterIds]);

  const momentFilters: MomentListFilters = useMemo(
    () => ({
      characterIds: groupFilter === "all" ? activeCharacterIds : undefined,
      groupId: groupFilter === "all" ? undefined : Number(groupFilter),
      search: searchQuery || undefined,
      cueOnly: cueOnly || undefined,
      songId: songFilter === "all" ? undefined : Number(songFilter),
      propId: propFilter === "all" ? undefined : Number(propFilter),
      cueCategoryId: cueCategoryFilter === "all" ? undefined : Number(cueCategoryFilter),
    }),
    [
      activeCharacterIds,
      groupFilter,
      searchQuery,
      cueOnly,
      songFilter,
      propFilter,
      cueCategoryFilter,
    ],
  );

  const selectedAct = useMemo(
    () => acts.find((act) => act.id === selectedActId) ?? null,
    [acts, selectedActId],
  );

  const selectedScene: SceneSummary | null = useMemo(() => {
    if (!selectedAct || selectedSceneId === null) return null;
    return selectedAct.scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  }, [selectedAct, selectedSceneId]);

  useEffect(() => {
    const requests: [
      ReturnType<typeof api.getProduction>,
      ReturnType<typeof api.listActs>,
      ReturnType<typeof api.listCharacters>,
      ReturnType<typeof api.listSongs>,
      ReturnType<typeof api.listProps>,
      ReturnType<typeof api.listCueCategories>,
      ReturnType<typeof api.listMomentTypes>,
      Promise<GroupResponse[]>?,
    ] = [
      api.getProduction(productionId),
      api.listActs(productionId),
      api.listCharacters(productionId),
      api.listSongs(productionId),
      api.listProps(productionId),
      api.listCueCategories(productionId),
      api.listMomentTypes(),
    ];
    if (canManagePreparation) {
      requests.push(api.listGroups(productionId));
    }

    void Promise.all(requests)
      .then((results) => {
        const [
          production,
          actData,
          characterData,
          songData,
          propData,
          categoryData,
          typeData,
          groupData,
        ] = results;
        setProductionTitle(production.title);
        setActs(actData);
        setCharacters(characterData);
        setSongs(songData);
        setPropsCatalog(propData);
        setCueCategories(categoryData);
        setMomentTypes(typeData);
        setGroups(groupData ?? []);
        if (actData.length > 0) {
          const firstAct = actData[0];
          setSelectedActId(firstAct.id);
          if (firstAct.scenes.length > 0) {
            setSelectedSceneId(firstAct.scenes[0].id);
          }
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load timeline");
      })
      .finally(() => setLoading(false));
  }, [productionId, canManagePreparation]);

  useEffect(() => {
    if (selectedSceneId === null) {
      setMoments([]);
      return;
    }

    setMomentsLoading(true);
    setSelectedMomentId(null);
    setMomentDetail(null);

    void api
      .listMoments(productionId, selectedSceneId, momentFilters)
      .then(setMoments)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load moments");
      })
      .finally(() => setMomentsLoading(false));
  }, [productionId, selectedSceneId, momentFilters, momentsRefreshKey]);

  useEffect(() => {
    if (selectedMomentId === null) {
      setMomentDetail(null);
      return;
    }

    void api
      .getMoment(productionId, selectedMomentId)
      .then(setMomentDetail)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load moment detail");
      });
  }, [productionId, selectedMomentId]);

  function handleActChange(actId: number) {
    setSelectedActId(actId);
    const act = acts.find((a) => a.id === actId);
    setSelectedSceneId(act?.scenes[0]?.id ?? null);
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  const activeCharacterNames = useMemo(() => {
    if (!activeCharacterIds?.length) return [];
    return characters
      .filter((character) => activeCharacterIds.includes(character.id))
      .map((character) => character.name);
  }, [activeCharacterIds, characters]);

  function isHighlighted(moment: MomentSummary): boolean {
    if (!activeCharacterIds?.length) return false;
    if (moment.speaking_character_ids.some((id) => activeCharacterIds.includes(id))) {
      return true;
    }
    if (moment.moment_type === "stage_direction" && activeCharacterNames.length > 0) {
      return activeCharacterNames.some((name) => {
        const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        return pattern.test(moment.original_text);
      });
    }
    return false;
  }

  async function refreshMomentDetail() {
    if (selectedMomentId === null) return;
    const detail = await api.getMoment(productionId, selectedMomentId);
    setMomentDetail(detail);
  }

  function refreshMomentsList() {
    setMomentsRefreshKey((key) => key + 1);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading timeline…</p>;
  }

  if (acts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-muted-foreground">No acts found. Import a script first.</p>
        <Link to="/productions" className="text-sm text-primary hover:underline">
          Back to productions
        </Link>
      </div>
    );
  }

  const sceneLabel = selectedScene
    ? `Act ${selectedAct?.number} › Scene ${selectedScene.number}${
        selectedScene.title ? ` — ${selectedScene.title}` : ""
      }`
    : "Select a scene";

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/productions"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Productions
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {productionTitle ?? "Timeline"}
          </h1>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search this scene…"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
              }}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={selectedActId ?? ""}
            onChange={(e) => handleActChange(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {acts.map((act) => (
              <option key={act.id} value={act.id}>
                {formatActLabel(act)}
              </option>
            ))}
          </select>

          <select
            value={selectedSceneId ?? ""}
            onChange={(e) => setSelectedSceneId(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={!selectedAct?.scenes.length}
          >
            {selectedAct?.scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                Scene {scene.number}{scene.title ? `: ${scene.title}` : ""}
              </option>
            ))}
          </select>

          {canManagePreparation && groups.length > 0 && (
            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value as GroupFilterValue);
                setCharacterFilter("all");
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All groups</option>
              {groups.map((group) => (
                <option key={group.id} value={String(group.id)}>
                  {group.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={characterFilter}
            onChange={(e) => {
              setCharacterFilter(e.target.value as CharacterFilterValue);
              setGroupFilter("all");
            }}
            disabled={groupFilter !== "all"}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="all">All characters</option>
            {myCharacterIds.length > 0 && (
              <option value="mine">My characters</option>
            )}
            {characters.map((character) => (
              <option key={character.id} value={String(character.id)}>
                {character.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cueOnly}
              onChange={(e) => setCueOnly(e.target.checked)}
            />
            Cue-only mode
          </label>

          {songs.length > 0 && (
            <select
              value={songFilter}
              onChange={(e) => setSongFilter(e.target.value as ResourceFilterValue)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All songs</option>
              {songs.map((song) => (
                <option key={song.id} value={String(song.id)}>
                  {song.title}
                </option>
              ))}
            </select>
          )}

          {canManagePreparation && propsCatalog.length > 0 && (
            <select
              value={propFilter}
              onChange={(e) => setPropFilter(e.target.value as ResourceFilterValue)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All props</option>
              {propsCatalog.map((prop) => (
                <option key={prop.id} value={String(prop.id)}>
                  {prop.name}
                </option>
              ))}
            </select>
          )}

          {canManagePreparation && cueCategories.length > 0 && (
            <select
              value={cueCategoryFilter}
              onChange={(e) =>
                setCueCategoryFilter(e.target.value as ResourceFilterValue)
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All cue categories</option>
              {cueCategories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground">{sceneLabel}</p>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {momentsLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading moments…</p>
        ) : moments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No moments match these filters.</p>
        ) : (
          <ul className="h-full overflow-y-auto divide-y divide-border">
            {moments.map((moment) => (
              <li key={moment.id}>
                <button
                  type="button"
                  onClick={() => setSelectedMomentId(moment.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50",
                    selectedMomentId === moment.id && "bg-muted",
                    isHighlighted(moment) && "border-l-4 border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20",
                  )}
                >
                  <span className="w-8 shrink-0 font-mono text-muted-foreground">
                    {moment.sequence_number}
                  </span>
                  <span className="min-w-0 flex-1">{truncate(moment.original_text)}</span>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {moment.has_props && (
                      <Badge variant="outline" className="text-xs">
                        Prop
                      </Badge>
                    )}
                    {moment.has_cues && (
                      <Badge variant="outline" className="text-xs">
                        Cue
                      </Badge>
                    )}
                    <Badge
                      className={cn("capitalize", momentBadgeClass(moment.moment_type))}
                    >
                      {momentTypeLabel(moment.moment_type)}
                    </Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet
        open={selectedMomentId !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setSelectedMomentId(null);
        }}
      >
        <SheetContent
          side={isLargeScreen ? "right" : "bottom"}
          className={cn(
            "overflow-y-auto",
            isLargeScreen ? "w-96 sm:max-w-md" : "max-h-[70vh]",
          )}
        >
          {momentDetail ? (
            <MomentDetailPanel
              productionId={productionId}
              detail={momentDetail}
              canEdit={canManagePreparation}
              canChooseVisibility={canManagePreparation}
              characters={characters}
              songs={songs}
              propsCatalog={propsCatalog}
              cueCategories={cueCategories}
              momentTypes={momentTypes}
              onChanged={() => {
                void refreshMomentDetail();
                refreshMomentsList();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading moment detail…</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MomentDetailPanel({
  productionId,
  detail,
  canEdit,
  canChooseVisibility,
  characters,
  songs,
  propsCatalog,
  cueCategories,
  momentTypes,
  onChanged,
}: {
  productionId: number;
  detail: MomentDetailResponse;
  canEdit: boolean;
  canChooseVisibility: boolean;
  characters: CharacterDetailResponse[];
  songs: SongDetailResponse[];
  propsCatalog: PropResponse[];
  cueCategories: CueCategoryResponse[];
  momentTypes: MomentTypeResponse[];
  onChanged: () => void;
}) {
  const [noteContent, setNoteContent] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"public" | "private">("private");
  const [saving, setSaving] = useState(false);

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

  const [newCueCategoryId, setNewCueCategoryId] = useState("");
  const [newCueTitle, setNewCueTitle] = useState("");
  const [newCueNotes, setNewCueNotes] = useState("");

  useEffect(() => {
    setParsedText(detail.parsed_text ?? "");
    setStageDirectionText(detail.stage_direction ?? "");
    setSelectedTypeId(
      momentTypes.find((type) => type.name === detail.moment_type)?.id ?? "",
    );
    setSelectedSongId(detail.song_id !== null ? String(detail.song_id) : "");
  }, [detail, momentTypes]);

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

  async function handleSaveMomentFields() {
    setSaving(true);
    try {
      await api.updateMoment(productionId, detail.id, {
        moment_type_id: selectedTypeId ? Number(selectedTypeId) : undefined,
        parsed_text: parsedText.trim() || null,
        song_id: selectedSongId ? Number(selectedSongId) : null,
      });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to save moment");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStageDirection() {
    if (!detail.stage_direction && !stageDirectionText.trim()) return;
    setSaving(true);
    try {
      await api.updateStageDirection(productionId, detail.id, {
        direction_text: stageDirectionText,
      });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to save stage direction");
    } finally {
      setSaving(false);
    }
  }

  async function handleDialogueCharacterChange(lineId: number, characterId: number) {
    setSaving(true);
    try {
      await api.updateDialogue(productionId, detail.id, lineId, { character_id: characterId });
      onChanged();
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

      <div>
        <h3 className="text-sm font-medium">Original text</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
          {detail.original_text}
        </p>
      </div>

      {canEdit && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <h3 className="text-sm font-medium">Edit parsed data</h3>

          <label className="block text-xs text-muted-foreground">
            Moment type
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
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
            Linked song
            <select
              value={selectedSongId}
              onChange={(e) => setSelectedSongId(e.target.value)}
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

          <label className="block text-xs text-muted-foreground">
            Parsed text
            <textarea
              value={parsedText}
              onChange={(e) => setParsedText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveMomentFields()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save moment fields
          </button>
        </div>
      )}

      {!canEdit && detail.parsed_text && (
        <div>
          <h3 className="text-sm font-medium">Parsed text</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {detail.parsed_text}
          </p>
        </div>
      )}

      {(detail.stage_direction || canEdit) && (
        <div>
          <h3 className="text-sm font-medium">Stage direction</h3>
          {canEdit ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={stageDirectionText}
                onChange={(e) => setStageDirectionText(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={saving || !detail.stage_direction}
                onClick={() => void handleSaveStageDirection()}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Save stage direction
              </button>
            </div>
          ) : (
            <p className="mt-1 text-sm">{detail.stage_direction}</p>
          )}
        </div>
      )}

      {detail.dialogue.length > 0 && (
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

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-medium">Props</h3>
        {detail.props.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No props attached.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {detail.props.map((prop) => (
              <li key={prop.id} className="rounded-md border border-border p-2 text-sm">
                <span className="font-medium">{prop.prop_name}</span>
                {prop.character_name && (
                  <span className="text-muted-foreground"> — {prop.character_name}</span>
                )}
                {prop.notes && <p className="mt-1 text-muted-foreground">{prop.notes}</p>}
                {canEdit && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDetachProp(prop.id)}
                    className="mt-1 text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && propsCatalog.length > 0 && (
          <form onSubmit={(e) => void handleAttachProp(e)} className="mt-3 space-y-2">
            <select
              value={attachPropId}
              onChange={(e) => setAttachPropId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select prop…</option>
              {propsCatalog.map((prop) => (
                <option key={prop.id} value={String(prop.id)}>
                  {prop.name}
                </option>
              ))}
            </select>
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
            <button
              type="submit"
              disabled={saving || !attachPropId}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Attach prop
            </button>
          </form>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-medium">Cues</h3>
        {detail.cues.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No cues attached.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {detail.cues.map((cue) => (
              <li key={cue.id} className="rounded-md border border-border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{cue.title}</span>
                  <Badge variant="secondary">{cue.cue_category_name}</Badge>
                </div>
                {cue.notes && <p className="mt-1 text-muted-foreground">{cue.notes}</p>}
                {canEdit && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDeleteCue(cue.id)}
                    className="mt-1 text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && cueCategories.length > 0 && (
          <form onSubmit={(e) => void handleAddCue(e)} className="mt-3 space-y-2">
            <select
              value={newCueCategoryId}
              onChange={(e) => setNewCueCategoryId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select category…</option>
              {cueCategories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
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
            <button
              type="submit"
              disabled={saving || !newCueCategoryId || !newCueTitle.trim()}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Add cue
            </button>
          </form>
        )}
      </div>

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
}
