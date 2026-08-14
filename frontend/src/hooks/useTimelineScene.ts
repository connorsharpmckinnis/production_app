import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimelineSection } from "@/components/TimelineMomentList";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { deriveSceneSummary } from "@/lib/sceneSummary";
import type {
  ActSummary,
  AppSettingsResponse,
  CastableUserResponse,
  CharacterDetailResponse,
  CostumeResponse,
  CueCategoryResponse,
  GroupResponse,
  MomentDetailResponse,
  MomentListFilters,
  MomentSummary,
  MomentTypeResponse,
  PropResponse,
  SceneSummary,
  SetPieceResponse,
  SongDetailResponse,
} from "@/lib/types";
import { formatSceneSectionLabel, sortByName } from "@/lib/utils";

export interface TimelineFilterInput {
  characterIds: number[];
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
  setPieceFilter: "all" | string;
}

export interface UseTimelineSceneOptions {
  productionId: number;
  momentFilters?: MomentListFilters;
  filterInput?: TimelineFilterInput;
}

function buildMomentFilters(
  filterInput: TimelineFilterInput | undefined,
): MomentListFilters | undefined {
  if (!filterInput) return undefined;

  const characterIds =
    filterInput.groupFilter === "all" && filterInput.characterIds.length > 0
      ? filterInput.characterIds
      : undefined;

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
    setPieceId:
      filterInput.setPieceFilter === "all" ? undefined : Number(filterInput.setPieceFilter),
  };
}

function allSceneIdsFromActs(acts: ActSummary[]): number[] {
  return acts.flatMap((act) => act.scenes.map((scene) => scene.id));
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
  const [castableUsers, setCastableUsers] = useState<CastableUserResponse[]>([]);
  const [songs, setSongs] = useState<SongDetailResponse[]>([]);
  const [propsCatalog, setPropsCatalog] = useState<PropResponse[]>([]);
  const [setPiecesCatalog, setSetPiecesCatalog] = useState<SetPieceResponse[]>([]);
  const [costumesCatalog, setCostumesCatalog] = useState<CostumeResponse[]>([]);
  const [cueCategories, setCueCategories] = useState<CueCategoryResponse[]>([]);
  const [momentTypes, setMomentTypes] = useState<MomentTypeResponse[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettingsResponse>({
    show_original_text: true,
    show_parsed_text: true,
    default_message_rotation_seconds: 20,
  });
  const [selectedSceneIds, setSelectedSceneIds] = useState<number[]>([]);
  const [moments, setMoments] = useState<MomentSummary[]>([]);
  const [momentSections, setMomentSections] = useState<TimelineSection[]>([]);
  const [selectedMomentId, setSelectedMomentId] = useState<number | null>(null);
  const [momentDetail, setMomentDetail] = useState<MomentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [momentsRefreshKey, setMomentsRefreshKey] = useState(0);
  const silentRefreshRef = useRef(false);
  const catalogLoadIdRef = useRef(0);

  const myCharacterIds = useMemo(() => {
    if (!user) return [];
    return characters
      .filter((character) => character.assigned_actor?.user_id === user.id)
      .map((character) => character.id);
  }, [characters, user]);

  const momentFilters = useMemo(() => {
    if (explicitMomentFilters) return explicitMomentFilters;
    return buildMomentFilters(filterInput);
  }, [explicitMomentFilters, filterInput]);

  const sortedCharacters = useMemo(() => sortByName(characters), [characters]);

  const sceneLookup = useMemo(() => {
    const map = new Map<number, { act: ActSummary; scene: SceneSummary }>();
    for (const act of acts) {
      for (const scene of act.scenes) {
        map.set(scene.id, { act, scene });
      }
    }
    return map;
  }, [acts]);

  /** When exactly one scene is selected, expose it for structural insert-at-end helpers. */
  const selectedSceneId = selectedSceneIds.length === 1 ? selectedSceneIds[0] : null;

  const selectedScene: SceneSummary | null = useMemo(() => {
    if (selectedSceneId === null) return null;
    return sceneLookup.get(selectedSceneId)?.scene ?? null;
  }, [selectedSceneId, sceneLookup]);

  const selectedAct = useMemo(() => {
    if (selectedSceneId === null) return null;
    return sceneLookup.get(selectedSceneId)?.act ?? null;
  }, [selectedSceneId, sceneLookup]);

  const selectionLabel = useMemo(() => {
    if (selectedSceneIds.length === 0) return "No scenes selected";
    const allIds = allSceneIdsFromActs(acts);
    if (allIds.length > 0 && selectedSceneIds.length === allIds.length) {
      return "Full script";
    }
    if (selectedSceneIds.length === 1 && selectedScene) {
      const actNumber = selectedAct?.number ?? 0;
      return formatSceneSectionLabel(actNumber, selectedScene);
    }
    return `${selectedSceneIds.length} scenes`;
  }, [acts, selectedSceneIds, selectedScene, selectedAct]);

  useEffect(() => {
    setSelectedSceneIds([]);
    setSelectedMomentId(null);
    setMomentDetail(null);
    setLoading(true);
  }, [productionId]);

  useEffect(() => {
    const loadId = ++catalogLoadIdRef.current;
    const requests: [
      ReturnType<typeof api.getProduction>,
      ReturnType<typeof api.listActs>,
      ReturnType<typeof api.listCharacters>,
      ReturnType<typeof api.listSongs>,
      ReturnType<typeof api.listProps>,
      ReturnType<typeof api.listSetPieces>,
      ReturnType<typeof api.listCostumes>,
      ReturnType<typeof api.listCueCategories>,
      ReturnType<typeof api.listMomentTypes>,
      ReturnType<typeof api.getAppSettings>,
      Promise<GroupResponse[]>?,
      Promise<CastableUserResponse[]>?,
    ] = [
      api.getProduction(productionId),
      api.listActs(productionId),
      api.listCharacters(productionId),
      api.listSongs(productionId),
      api.listProps(productionId),
      api.listSetPieces(productionId),
      api.listCostumes(productionId),
      api.listCueCategories(productionId),
      api.listMomentTypes(),
      api.getAppSettings(),
    ];
    if (canManagePreparation) {
      requests.push(api.listGroups(productionId));
      requests.push(api.listActiveUsers(productionId));
    }

    void Promise.all(requests)
      .then((results) => {
        if (loadId !== catalogLoadIdRef.current) return;

        const [
          production,
          actData,
          characterData,
          songData,
          propData,
          setPieceData,
          costumeData,
          categoryData,
          typeData,
          settingsData,
          groupData,
          castableUserData,
        ] = results;
        setProductionTitle(production.title);
        setActs(actData);
        setCharacters(characterData);
        setSongs(songData);
        setPropsCatalog(propData);
        setSetPiecesCatalog(setPieceData);
        setCostumesCatalog(costumeData);
        setCueCategories(categoryData);
        setMomentTypes(typeData);
        setAppSettings(settingsData);
        setGroups(groupData ?? []);
        setCastableUsers(castableUserData ?? []);
        // Only seed the default multi-scene selection when nothing is selected yet.
        // Deep links (and the user) may already have narrowed to one scene; a later
        // catalog reload must not wipe that (Strict Mode / canManagePreparation).
        setSelectedSceneIds((prev) =>
          prev.length > 0 ? prev : allSceneIdsFromActs(actData),
        );
      })
      .catch((err: unknown) => {
        if (loadId !== catalogLoadIdRef.current) return;
        setError(formatApiError(err, "Failed to load timeline"));
      })
      .finally(() => {
        if (loadId !== catalogLoadIdRef.current) return;
        setLoading(false);
      });
  }, [productionId, canManagePreparation]);

  useEffect(() => {
    setSelectedMomentId(null);
    setMomentDetail(null);
  }, [productionId, selectedSceneIds, momentFilters]);

  useEffect(() => {
    if (selectedSceneIds.length === 0) {
      setMoments([]);
      setMomentSections([]);
      return;
    }

    const silent = silentRefreshRef.current;
    silentRefreshRef.current = false;
    if (!silent) {
      setMomentsLoading(true);
    }

    const orderedSceneIds = allSceneIdsFromActs(acts).filter((id) =>
      selectedSceneIds.includes(id),
    );

    let cancelled = false;

    void Promise.all(
      orderedSceneIds.map(async (sceneId) => {
        const sceneMoments = await api.listMoments(productionId, sceneId, momentFilters);
        return { sceneId, moments: sceneMoments };
      }),
    )
      .then((results) => {
        if (cancelled) return;

        const sections: TimelineSection[] = [];
        const flat: MomentSummary[] = [];

        for (const result of results) {
          const lookup = sceneLookup.get(result.sceneId);
          if (!lookup) continue;
          const label = formatSceneSectionLabel(lookup.act.number, lookup.scene);
          sections.push({
            sceneId: result.sceneId,
            label,
            moments: result.moments,
            summary: deriveSceneSummary(result.moments, characters, songs),
          });
          flat.push(...result.moments);
        }

        setMomentSections(sections);
        setMoments(flat);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(formatApiError(err, "Failed to load moments"));
        }
      })
      .finally(() => {
        if (!cancelled) setMomentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    productionId,
    selectedSceneIds,
    momentFilters,
    momentsRefreshKey,
    acts,
    sceneLookup,
    characters,
    songs,
  ]);

  useEffect(() => {
    if (selectedMomentId === null) {
      setMomentDetail(null);
      return;
    }

    void api
      .getMoment(productionId, selectedMomentId)
      .then(setMomentDetail)
      .catch((err: unknown) => {
        setError(formatApiError(err, "Failed to load moment detail"));
      });
  }, [productionId, selectedMomentId]);

  const selectSceneById = useCallback(
    (sceneId: number): boolean => {
      if (!sceneLookup.has(sceneId)) return false;
      setSelectedSceneIds((prev) =>
        prev.length === 1 && prev[0] === sceneId ? prev : [sceneId],
      );
      return true;
    },
    [sceneLookup],
  );

  function sceneIdForMoment(momentId: number): number | null {
    for (const section of momentSections) {
      if (section.moments.some((moment) => moment.id === momentId)) {
        return section.sceneId;
      }
    }
    return null;
  }

  async function refreshMomentDetail() {
    if (selectedMomentId === null) return;
    const detail = await api.getMoment(productionId, selectedMomentId);
    setMomentDetail(detail);
  }

  function refreshMomentsList() {
    silentRefreshRef.current = true;
    setMomentsRefreshKey((key) => key + 1);
  }

  const sceneHasStageMovements = useMemo(
    () => moments.some((moment) => moment.has_entrance || moment.has_exit),
    [moments],
  );

  return {
    productionTitle,
    acts,
    characters: sortedCharacters,
    groups,
    castableUsers,
    songs,
    propsCatalog,
    setPiecesCatalog,
    costumesCatalog,
    cueCategories,
    momentTypes,
    appSettings,
    selectedSceneIds,
    setSelectedSceneIds,
    selectedSceneId,
    selectedAct,
    selectedScene,
    selectionLabel,
    moments,
    momentSections,
    selectedMomentId,
    setSelectedMomentId,
    momentDetail,
    setMomentDetail,
    loading,
    momentsLoading,
    error,
    myCharacterIds,
    canManagePreparation,
    selectSceneById,
    sceneIdForMoment,
    refreshMomentDetail,
    refreshMomentsList,
    sceneHasStageMovements,
  };
}
