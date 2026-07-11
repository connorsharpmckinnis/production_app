import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import MomentDetailPanel, {
  type MomentDetailPanelHandle,
} from "@/components/MomentDetailPanel";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import type {
  ActSummary,
  AppSettingsResponse,
  CharacterDetailResponse,
  CueCategoryResponse,
  GroupResponse,
  MicrophoneResponse,
  MomentDetailResponse,
  MomentListFilters,
  MomentSummary,
  MomentTypeResponse,
  PropResponse,
  SceneSummary,
  SetPieceResponse,
  SongDetailResponse,
} from "@/lib/types";
import { cn, formatActLabel, momentTypeLabel } from "@/lib/utils";

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

const DETAIL_PANEL_WIDTH_KEY = "timelineDetailPanelWidth";
const DEFAULT_DETAIL_PANEL_WIDTH = 384;
const MIN_DETAIL_PANEL_WIDTH = 320;
const MAX_DETAIL_PANEL_WIDTH = 720;

function useDetailPanelWidth() {
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_DETAIL_PANEL_WIDTH;
    const stored = sessionStorage.getItem(DETAIL_PANEL_WIDTH_KEY);
    const parsed = stored ? Number(stored) : DEFAULT_DETAIL_PANEL_WIDTH;
    return Number.isFinite(parsed) ? parsed : DEFAULT_DETAIL_PANEL_WIDTH;
  });

  function persistWidth(nextWidth: number) {
    const clamped = Math.min(MAX_DETAIL_PANEL_WIDTH, Math.max(MIN_DETAIL_PANEL_WIDTH, nextWidth));
    setWidth(clamped);
    sessionStorage.setItem(DETAIL_PANEL_WIDTH_KEY, String(clamped));
  }

  return { width, persistWidth };
}

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const isLargeScreen = useIsLargeScreen();
  const { width: detailPanelWidth, persistWidth: persistDetailPanelWidth } =
    useDetailPanelWidth();
  const { user, canManagePreparation } = useAuth();

  const [productionTitle, setProductionTitle] = useState<string | null>(null);
  const [acts, setActs] = useState<ActSummary[]>([]);
  const [characters, setCharacters] = useState<CharacterDetailResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [songs, setSongs] = useState<SongDetailResponse[]>([]);
  const [propsCatalog, setPropsCatalog] = useState<PropResponse[]>([]);
  const [microphonesCatalog, setMicrophonesCatalog] = useState<MicrophoneResponse[]>([]);
  const [setPiecesCatalog, setSetPiecesCatalog] = useState<SetPieceResponse[]>([]);
  const [cueCategories, setCueCategories] = useState<CueCategoryResponse[]>([]);
  const [momentTypes, setMomentTypes] = useState<MomentTypeResponse[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettingsResponse>({
    show_original_text: true,
    show_parsed_text: true,
  });
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
  const [costumeOnly, setCostumeOnly] = useState(false);
  const [entranceOnly, setEntranceOnly] = useState(false);
  const [exitOnly, setExitOnly] = useState(false);
  const [blockingOnly, setBlockingOnly] = useState(false);
  const [characterFilter, setCharacterFilter] = useState<CharacterFilterValue>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilterValue>("all");
  const [songFilter, setSongFilter] = useState<ResourceFilterValue>("all");
  const [propFilter, setPropFilter] = useState<ResourceFilterValue>("all");
  const [cueCategoryFilter, setCueCategoryFilter] = useState<ResourceFilterValue>("all");
  const [microphoneFilter, setMicrophoneFilter] = useState<ResourceFilterValue>("all");
  const [setPieceFilter, setSetPieceFilter] = useState<ResourceFilterValue>("all");
  const [momentsRefreshKey, setMomentsRefreshKey] = useState(0);

  const [insertAfterSequence, setInsertAfterSequence] = useState<number | null>(null);
  const [insertAtEnd, setInsertAtEnd] = useState(false);
  const [insertTypeId, setInsertTypeId] = useState("");
  const [insertText, setInsertText] = useState("");
  const [insertCharacterId, setInsertCharacterId] = useState("");
  const [structuralSaving, setStructuralSaving] = useState(false);

  const detailPanelRef = useRef<MomentDetailPanelHandle>(null);

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
      costumeOnly: costumeOnly || undefined,
      entranceOnly: entranceOnly || undefined,
      exitOnly: exitOnly || undefined,
      blockingOnly: blockingOnly || undefined,
      songId: songFilter === "all" ? undefined : Number(songFilter),
      propId: propFilter === "all" ? undefined : Number(propFilter),
      cueCategoryId: cueCategoryFilter === "all" ? undefined : Number(cueCategoryFilter),
      microphoneId: microphoneFilter === "all" ? undefined : Number(microphoneFilter),
      setPieceId: setPieceFilter === "all" ? undefined : Number(setPieceFilter),
    }),
    [
      activeCharacterIds,
      groupFilter,
      searchQuery,
      cueOnly,
      costumeOnly,
      entranceOnly,
      exitOnly,
      blockingOnly,
      songFilter,
      propFilter,
      cueCategoryFilter,
      microphoneFilter,
      setPieceFilter,
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
      ReturnType<typeof api.listMicrophones>,
      ReturnType<typeof api.listSetPieces>,
      ReturnType<typeof api.listCueCategories>,
      ReturnType<typeof api.listMomentTypes>,
      ReturnType<typeof api.getAppSettings>,
      Promise<GroupResponse[]>?,
    ] = [
      api.getProduction(productionId),
      api.listActs(productionId),
      api.listCharacters(productionId),
      api.listSongs(productionId),
      api.listProps(productionId),
      api.listMicrophones(productionId),
      api.listSetPieces(productionId),
      api.listCueCategories(productionId),
      api.listMomentTypes(),
      api.getAppSettings(),
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
          micData,
          setPieceData,
          categoryData,
          typeData,
          settingsData,
          groupData,
        ] = results;
        setProductionTitle(production.title);
        setActs(actData);
        setCharacters(characterData);
        setSongs(songData);
        setPropsCatalog(propData);
        setMicrophonesCatalog(micData);
        setSetPiecesCatalog(setPieceData);
        setCueCategories(categoryData);
        setMomentTypes(typeData);
        setAppSettings(settingsData);
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
    setSelectedMomentId(null);
    setMomentDetail(null);
  }, [productionId, selectedSceneId, momentFilters]);

  useEffect(() => {
    if (selectedSceneId === null) {
      setMoments([]);
      return;
    }

    setMomentsLoading(true);

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
        return pattern.test(moment.display_text);
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

  function resetInsertForm() {
    setInsertAfterSequence(null);
    setInsertAtEnd(false);
    setInsertTypeId("");
    setInsertText("");
    setInsertCharacterId("");
  }

  function speakingCharacterName(moment: MomentSummary): string | null {
    if (moment.moment_type !== "dialogue" || moment.speaking_character_ids.length === 0) {
      return null;
    }
    const character = characters.find((c) => c.id === moment.speaking_character_ids[0]);
    return character?.name ?? null;
  }

  async function handleInsertMoment(event: React.FormEvent) {
    event.preventDefault();
    if (selectedSceneId === null || !insertTypeId || !insertText.trim()) return;

    if (insertTypeName === "dialogue" && !insertCharacterId) {
      alert("Select a speaking character for dialogue moments.");
      return;
    }

    const sequenceNumber = insertAtEnd
      ? (moments[moments.length - 1]?.sequence_number ?? 0) + 1
      : (insertAfterSequence ?? 0) + 1;

    setStructuralSaving(true);
    try {
      const created = await api.createMoment(productionId, selectedSceneId, {
        sequence_number: sequenceNumber,
        moment_type_id: Number(insertTypeId),
        original_text: insertText.trim(),
        character_id: insertCharacterId ? Number(insertCharacterId) : null,
      });
      resetInsertForm();
      setSelectedMomentId(created.id);
      setMomentDetail(created);
      refreshMomentsList();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to insert moment");
    } finally {
      setStructuralSaving(false);
    }
  }

  async function handleDeleteMoment(momentId: number) {
    if (!confirm("Delete this moment and all attached data?")) return;

    setStructuralSaving(true);
    try {
      await api.deleteMoment(productionId, momentId);
      if (selectedMomentId === momentId) {
        setSelectedMomentId(null);
        setMomentDetail(null);
      }
      refreshMomentsList();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to delete moment");
    } finally {
      setStructuralSaving(false);
    }
  }

  async function handleMoveMoment(moment: MomentSummary, direction: "up" | "down") {
    const targetSequence =
      direction === "up" ? moment.sequence_number - 1 : moment.sequence_number + 1;
    if (targetSequence < 1) return;

    setStructuralSaving(true);
    try {
      const updated = await api.reorderMoment(productionId, moment.id, targetSequence);
      if (selectedMomentId === moment.id) {
        setMomentDetail(updated);
      }
      refreshMomentsList();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to reorder moment");
    } finally {
      setStructuralSaving(false);
    }
  }

  const insertTypeName = momentTypes.find((t) => String(t.id) === insertTypeId)?.name;

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

          {canManagePreparation && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={costumeOnly}
                onChange={(e) => setCostumeOnly(e.target.checked)}
              />
              Costume moments only
            </label>
          )}

          {canManagePreparation && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={entranceOnly}
                onChange={(e) => setEntranceOnly(e.target.checked)}
              />
              Entrance moments only
            </label>
          )}

          {canManagePreparation && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={exitOnly}
                onChange={(e) => setExitOnly(e.target.checked)}
              />
              Exit moments only
            </label>
          )}

          {canManagePreparation && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={blockingOnly}
                onChange={(e) => setBlockingOnly(e.target.checked)}
              />
              Blocking moments only
            </label>
          )}

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

          {canManagePreparation && microphonesCatalog.length > 0 && (
            <select
              value={microphoneFilter}
              onChange={(e) => setMicrophoneFilter(e.target.value as ResourceFilterValue)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All microphones</option>
              {microphonesCatalog.map((mic) => (
                <option key={mic.id} value={String(mic.id)}>
                  {mic.identifier}
                </option>
              ))}
            </select>
          )}

          {canManagePreparation && setPiecesCatalog.length > 0 && (
            <select
              value={setPieceFilter}
              onChange={(e) => setSetPieceFilter(e.target.value as ResourceFilterValue)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All set pieces</option>
              {setPiecesCatalog.map((piece) => (
                <option key={piece.id} value={String(piece.id)}>
                  {piece.name}
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
            {moments.map((moment, index) => (
              <li key={moment.id}>
                <div
                  className={cn(
                    "flex w-full items-start gap-2 px-4 py-3 text-left text-sm",
                    selectedMomentId === moment.id && "bg-muted",
                    isHighlighted(moment) &&
                      "border-l-4 border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20",
                  )}
                >
                  {canManagePreparation && (
                    <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={structuralSaving || index === 0}
                        onClick={() => void handleMoveMoment(moment, "up")}
                        aria-label="Move up"
                        title="Move up"
                      >
                        <ChevronUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={structuralSaving || index === moments.length - 1}
                        onClick={() => void handleMoveMoment(moment, "down")}
                        aria-label="Move down"
                        title="Move down"
                      >
                        <ChevronDown />
                      </Button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedMomentId(moment.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left hover:opacity-90"
                  >
                    <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                      {moment.sequence_number}
                    </span>
                    {speakingCharacterName(moment) && (
                      <span className="w-24 shrink-0 font-medium text-muted-foreground">
                        {speakingCharacterName(moment)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed">
                      {moment.moment_type === "dialogue" && speakingCharacterName(moment)
                        ? moment.display_text.replace(/^[^:]+:\s*/, "")
                        : moment.display_text}
                    </span>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
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
                      {moment.has_microphone && (
                        <Badge variant="outline" className="text-xs">
                          Mic
                        </Badge>
                      )}
                      {moment.has_set_piece && (
                        <Badge variant="outline" className="text-xs">
                          Set
                        </Badge>
                      )}
                      {moment.has_costume && (
                        <Badge variant="outline" className="text-xs">
                          Costume
                        </Badge>
                      )}
                      {moment.has_entrance && (
                        <Badge variant="outline" className="text-xs">
                          Entrance
                        </Badge>
                      )}
                      {moment.has_exit && (
                        <Badge variant="outline" className="text-xs">
                          Exit
                        </Badge>
                      )}
                      {moment.has_blocking && (
                        <Badge variant="outline" className="text-xs">
                          Blocking
                        </Badge>
                      )}
                      <Badge
                        className={cn("capitalize", momentBadgeClass(moment.moment_type))}
                      >
                        {momentTypeLabel(moment.moment_type)}
                      </Badge>
                    </div>
                  </button>

                  {canManagePreparation && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={structuralSaving}
                        onClick={() => {
                          resetInsertForm();
                          setInsertAfterSequence(moment.sequence_number);
                        }}
                        aria-label="Insert moment after"
                        title="Insert moment after"
                      >
                        <Plus />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={structuralSaving}
                        onClick={() => void handleDeleteMoment(moment.id)}
                        aria-label="Delete moment"
                        title="Delete moment"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>

                {insertAfterSequence === moment.sequence_number && (
                  <InsertMomentForm
                    momentTypes={momentTypes}
                    characters={characters}
                    insertTypeId={insertTypeId}
                    insertText={insertText}
                    insertCharacterId={insertCharacterId}
                    insertTypeName={insertTypeName}
                    saving={structuralSaving}
                    onTypeChange={setInsertTypeId}
                    onTextChange={setInsertText}
                    onCharacterChange={setInsertCharacterId}
                    onSubmit={handleInsertMoment}
                    onCancel={resetInsertForm}
                  />
                )}
              </li>
            ))}

            {canManagePreparation && (
              <li className="border-t border-border px-4 py-3">
                {insertAtEnd ? (
                  <InsertMomentForm
                    momentTypes={momentTypes}
                    characters={characters}
                    insertTypeId={insertTypeId}
                    insertText={insertText}
                    insertCharacterId={insertCharacterId}
                    insertTypeName={insertTypeName}
                    saving={structuralSaving}
                    onTypeChange={setInsertTypeId}
                    onTextChange={setInsertText}
                    onCharacterChange={setInsertCharacterId}
                    onSubmit={handleInsertMoment}
                    onCancel={resetInsertForm}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={structuralSaving}
                    onClick={() => {
                      resetInsertForm();
                      setInsertAtEnd(true);
                    }}
                    className="text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    + Insert moment at end of scene
                  </button>
                )}
              </li>
            )}
          </ul>
        )}
      </div>

      <Sheet
        open={selectedMomentId !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            void detailPanelRef.current?.flushPendingSaves().finally(() => {
              setSelectedMomentId(null);
            });
          }
        }}
      >
        <SheetContent
          side={isLargeScreen ? "right" : "bottom"}
          className={cn(
            "overflow-y-auto",
            isLargeScreen ? "sm:max-w-none" : "max-h-[70vh]",
          )}
          style={
            isLargeScreen
              ? { width: detailPanelWidth, maxWidth: detailPanelWidth }
              : undefined
          }
        >
          {isLargeScreen && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize detail panel"
              onMouseDown={(event) => {
                event.preventDefault();
                const startX = event.clientX;
                const startWidth = detailPanelWidth;

                function onMouseMove(moveEvent: MouseEvent) {
                  persistDetailPanelWidth(startWidth - (moveEvent.clientX - startX));
                }

                function onMouseUp() {
                  window.removeEventListener("mousemove", onMouseMove);
                  window.removeEventListener("mouseup", onMouseUp);
                }

                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
              }}
              className="absolute top-0 left-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize hover:bg-primary/20"
            />
          )}
          {momentDetail ? (
            <MomentDetailPanel
              ref={detailPanelRef}
              productionId={productionId}
              detail={momentDetail}
              canEdit={canManagePreparation}
              canChooseVisibility={canManagePreparation}
              characters={characters}
              songs={songs}
              propsCatalog={propsCatalog}
              microphonesCatalog={microphonesCatalog}
              setPiecesCatalog={setPiecesCatalog}
              cueCategories={cueCategories}
              momentTypes={momentTypes}
              appSettings={appSettings}
              momentBadgeClass={momentBadgeClass}
              onDetailUpdate={setMomentDetail}
              onChanged={async () => {
                await refreshMomentDetail();
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

function InsertMomentForm({
  momentTypes,
  characters,
  insertTypeId,
  insertText,
  insertCharacterId,
  insertTypeName,
  saving,
  onTypeChange,
  onTextChange,
  onCharacterChange,
  onSubmit,
  onCancel,
}: {
  momentTypes: MomentTypeResponse[];
  characters: CharacterDetailResponse[];
  insertTypeId: string;
  insertText: string;
  insertCharacterId: string;
  insertTypeName: string | undefined;
  saving: boolean;
  onTypeChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onCharacterChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mx-4 mb-3 space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3"
    >
      <p className="text-xs font-medium text-muted-foreground">Insert new moment</p>
      <select
        value={insertTypeId}
        onChange={(e) => onTypeChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Moment type…</option>
        {momentTypes.map((type) => (
          <option key={type.id} value={String(type.id)}>
            {momentTypeLabel(type.name as MomentDetailResponse["moment_type"])}
          </option>
        ))}
      </select>
      <textarea
        value={insertText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Original text for new moment"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {insertTypeName === "dialogue" && (
        <select
          value={insertCharacterId}
          onChange={(e) => onCharacterChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Speaking character…</option>
          {characters.map((character) => (
            <option key={character.id} value={String(character.id)}>
              {character.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !insertTypeId || !insertText.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Insert
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
