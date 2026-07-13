import { useCallback, useEffect, useMemo, useState } from "react";
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

export interface TimelineFilterInput {
  characterFilter: "all" | "mine" | string;
  groupFilter: "all" | string;
  searchQuery: string;
  costumeOnly: boolean;
  entranceOnly: boolean;
  exitOnly: boolean;
  blockingOnly: boolean;
  blockingCharacterFilter: "all" | string;
  songFilter: "all" | string;
  propFilter: "all" | string;
  cueCategoryFilter: "all" | string;
  microphoneFilter: "all" | string;
  setPieceFilter: "all" | string;
}

export interface UseTimelineSceneOptions {
  productionId: number;
  momentFilters?: MomentListFilters;
  filterInput?: TimelineFilterInput;
}

function buildMomentFilters(
  filterInput: TimelineFilterInput | undefined,
  myCharacterIds: number[],
): MomentListFilters | undefined {
  if (!filterInput) return undefined;

  let characterIds: number[] | undefined;
  if (filterInput.groupFilter === "all") {
    if (filterInput.characterFilter === "all") {
      characterIds = undefined;
    } else if (filterInput.characterFilter === "mine") {
      characterIds = myCharacterIds.length > 0 ? myCharacterIds : undefined;
    } else {
      characterIds = [Number(filterInput.characterFilter)];
    }
  }

  return {
    characterIds,
    groupId:
      filterInput.groupFilter === "all" ? undefined : Number(filterInput.groupFilter),
    search: filterInput.searchQuery || undefined,
    costumeOnly: filterInput.costumeOnly || undefined,
    entranceOnly: filterInput.entranceOnly || undefined,
    exitOnly: filterInput.exitOnly || undefined,
    blockingOnly:
      filterInput.blockingOnly || filterInput.blockingCharacterFilter !== "all" || undefined,
    blockingCharacterId:
      filterInput.blockingCharacterFilter === "all"
        ? undefined
        : Number(filterInput.blockingCharacterFilter),
    songId: filterInput.songFilter === "all" ? undefined : Number(filterInput.songFilter),
    propId: filterInput.propFilter === "all" ? undefined : Number(filterInput.propFilter),
    cueCategoryId:
      filterInput.cueCategoryFilter === "all"
        ? undefined
        : Number(filterInput.cueCategoryFilter),
    microphoneId:
      filterInput.microphoneFilter === "all"
        ? undefined
        : Number(filterInput.microphoneFilter),
    setPieceId:
      filterInput.setPieceFilter === "all" ? undefined : Number(filterInput.setPieceFilter),
  };
}

export function useTimelineScene({
  productionId,
  momentFilters: explicitMomentFilters,
  filterInput,
}: UseTimelineSceneOptions) {
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
  const [momentsRefreshKey, setMomentsRefreshKey] = useState(0);

  const myCharacterIds = useMemo(() => {
    if (!user) return [];
    return characters
      .filter((character) => character.assigned_actor?.user_id === user.id)
      .map((character) => character.id);
  }, [characters, user]);

  const momentFilters = useMemo(() => {
    if (explicitMomentFilters) return explicitMomentFilters;
    return buildMomentFilters(filterInput, myCharacterIds);
  }, [explicitMomentFilters, filterInput, myCharacterIds]);

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
    const act = acts.find((item) => item.id === actId);
    setSelectedSceneId(act?.scenes[0]?.id ?? null);
  }

  const selectSceneById = useCallback((sceneId: number): boolean => {
    for (const act of acts) {
      if (act.scenes.some((item) => item.id === sceneId)) {
        setSelectedActId(act.id);
        setSelectedSceneId(sceneId);
        return true;
      }
    }
    return false;
  }, [acts]);

  async function refreshMomentDetail() {
    if (selectedMomentId === null) return;
    const detail = await api.getMoment(productionId, selectedMomentId);
    setMomentDetail(detail);
  }

  function refreshMomentsList() {
    setMomentsRefreshKey((key) => key + 1);
  }

  const sceneHasStageMovements = useMemo(
    () => moments.some((moment) => moment.has_entrance || moment.has_exit),
    [moments],
  );

  return {
    productionTitle,
    acts,
    characters,
    groups,
    songs,
    propsCatalog,
    microphonesCatalog,
    setPiecesCatalog,
    cueCategories,
    momentTypes,
    appSettings,
    selectedActId,
    selectedSceneId,
    selectedAct,
    selectedScene,
    moments,
    selectedMomentId,
    setSelectedMomentId,
    momentDetail,
    setMomentDetail,
    loading,
    momentsLoading,
    error,
    myCharacterIds,
    canManagePreparation,
    handleActChange,
    selectSceneById,
    setSelectedSceneId,
    refreshMomentDetail,
    refreshMomentsList,
    sceneHasStageMovements,
  };
}
