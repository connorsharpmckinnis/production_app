import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimelineSection } from "@/components/TimelineMomentList";
import { useAuth } from "@/context/AuthContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import {
  useMomentDetail,
  useMomentDetailCache,
} from "@/hooks/queries/useMomentDetail";
import {
  useCharactersCatalog,
  useCostumesCatalog,
  useCueCategoriesCatalog,
  useGroupsCatalog,
  usePropsCatalog,
  useSetPiecesCatalog,
  useSongsCatalog,
} from "@/hooks/queries/useProductionCatalogs";
import { api, formatApiError } from "@/lib/api";
import { deriveSceneSummary } from "@/lib/sceneSummary";
import type {
  ActSummary,
  AppSettingsResponse,
  CastableUserResponse,
  MomentDetailResponse,
  MomentListFilters,
  MomentSummary,
  MomentTypeResponse,
  SceneSummary,
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
  /** When set, used instead of "all scenes" on first catalog seed (invalid IDs dropped). */
  preferredSceneIds?: number[] | null;
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
  preferredSceneIds = null,
}: UseTimelineSceneOptions) {
  const { user } = useAuth();
  const { hasCapability } = useProductionAccess();
  const preferredSceneIdsRef = useRef(preferredSceneIds);
  preferredSceneIdsRef.current = preferredSceneIds;
  const canManagePreparation = [
    "timeline",
    "characters",
    "groups",
    "songs",
    "props",
    "costumes",
    "set_pieces",
    "cue_categories",
    "cues",
    "lav_chart",
    "rehearsals",
  ].some((resource) =>
    ["create", "update", "delete"].some((action) =>
      hasCapability(resource, action),
    ),
  );

  const charactersQuery = useCharactersCatalog(productionId);
  const songsQuery = useSongsCatalog(productionId);
  const propsQuery = usePropsCatalog(productionId);
  const setPiecesQuery = useSetPiecesCatalog(productionId);
  const costumesQuery = useCostumesCatalog(productionId);
  const cueCategoriesQuery = useCueCategoriesCatalog(productionId);
  const groupsQuery = useGroupsCatalog(productionId, canManagePreparation);

  const characters = charactersQuery.data ?? [];
  const songs = songsQuery.data ?? [];
  const propsCatalog = propsQuery.data ?? [];
  const setPiecesCatalog = setPiecesQuery.data ?? [];
  const costumesCatalog = costumesQuery.data ?? [];
  const cueCategories = cueCategoriesQuery.data ?? [];
  const groups = groupsQuery.data ?? [];

  const [productionTitle, setProductionTitle] = useState<string | null>(null);
  const [acts, setActs] = useState<ActSummary[]>([]);
  const [castableUsers, setCastableUsers] = useState<CastableUserResponse[]>([]);
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
  const [shellLoading, setShellLoading] = useState(true);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [momentsRefreshKey, setMomentsRefreshKey] = useState(0);
  const silentRefreshRef = useRef(false);
  const shellLoadIdRef = useRef(0);

  const momentDetailQuery = useMomentDetail(productionId, selectedMomentId);
  const momentCache = useMomentDetailCache(productionId);

  // Only expose detail that matches the current selection (avoids stale flash).
  const momentDetail: MomentDetailResponse | null =
    selectedMomentId != null &&
    momentDetailQuery.data != null &&
    momentDetailQuery.data.id === selectedMomentId
      ? momentDetailQuery.data
      : null;

  const setMomentDetail = useCallback(
    (detail: MomentDetailResponse | null) => {
      if (detail == null) return;
      momentCache.setMomentDetail(detail);
    },
    [momentCache],
  );

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

  const catalogsLoading =
    charactersQuery.isLoading ||
    songsQuery.isLoading ||
    propsQuery.isLoading ||
    setPiecesQuery.isLoading ||
    costumesQuery.isLoading ||
    cueCategoriesQuery.isLoading ||
    (canManagePreparation && groupsQuery.isLoading);

  const loading = shellLoading || catalogsLoading;

  useEffect(() => {
    setSelectedSceneIds([]);
    setSelectedMomentId(null);
    setShellLoading(true);
  }, [productionId]);

  useEffect(() => {
    const loadId = ++shellLoadIdRef.current;
    const requests: [
      ReturnType<typeof api.getProduction>,
      ReturnType<typeof api.listActs>,
      ReturnType<typeof api.listMomentTypes>,
      ReturnType<typeof api.getAppSettings>,
      Promise<CastableUserResponse[]>?,
    ] = [
      api.getProduction(productionId),
      api.listActs(productionId),
      api.listMomentTypes(),
      api.getAppSettings(),
    ];
    if (canManagePreparation) {
      requests.push(api.listActiveUsers(productionId));
    }

    void Promise.all(requests)
      .then((results) => {
        if (loadId !== shellLoadIdRef.current) return;

        const [production, actData, typeData, settingsData, castableUserData] =
          results;
        setProductionTitle(production.title);
        setActs(actData);
        setMomentTypes(typeData);
        setAppSettings(settingsData);
        setCastableUsers(castableUserData ?? []);
        // Only seed the default multi-scene selection when nothing is selected yet.
        // Deep links (and the user) may already have narrowed to one scene; a later
        // catalog reload must not wipe that (Strict Mode / canManagePreparation).
        // Restored Timeline prefs may supply a prior scene subset.
        setSelectedSceneIds((prev) => {
          if (prev.length > 0) return prev;
          const allIds = allSceneIdsFromActs(actData);
          const preferred = preferredSceneIdsRef.current;
          if (preferred && preferred.length > 0) {
            const valid = preferred.filter((id) => allIds.includes(id));
            if (valid.length > 0) return valid;
          }
          return allIds;
        });
      })
      .catch((err: unknown) => {
        if (loadId !== shellLoadIdRef.current) return;
        setError(formatApiError(err, "Failed to load timeline"));
      })
      .finally(() => {
        if (loadId !== shellLoadIdRef.current) return;
        setShellLoading(false);
      });
  }, [productionId, canManagePreparation]);

  useEffect(() => {
    setSelectedMomentId(null);
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
            summary: deriveSceneSummary(
              result.moments,
              characters,
              songs,
              propsCatalog,
              setPiecesCatalog,
            ),
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
    propsCatalog,
    setPiecesCatalog,
  ]);

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
    await momentCache.refreshMomentDetail(selectedMomentId);
  }

  function refreshMomentsList() {
    silentRefreshRef.current = true;
    setMomentsRefreshKey((key) => key + 1);
  }

  const sceneHasStageMovements = useMemo(
    () => moments.some((moment) => moment.has_entrance || moment.has_exit),
    [moments],
  );

  const catalogQueryError =
    charactersQuery.error ??
    songsQuery.error ??
    propsQuery.error ??
    setPiecesQuery.error ??
    costumesQuery.error ??
    cueCategoriesQuery.error ??
    (canManagePreparation ? groupsQuery.error : null);
  const momentQueryError =
    selectedMomentId != null ? momentDetailQuery.error : null;
  const displayError =
    error ??
    (catalogQueryError != null
      ? formatApiError(catalogQueryError, "Failed to load timeline catalogs")
      : null) ??
    (momentQueryError != null
      ? formatApiError(momentQueryError, "Failed to load moment detail")
      : null);

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
    removeMomentDetail: momentCache.removeMomentDetail,
    loading,
    momentsLoading,
    error: displayError,
    myCharacterIds,
    canManagePreparation,
    selectSceneById,
    sceneIdForMoment,
    refreshMomentDetail,
    refreshMomentsList,
    sceneHasStageMovements,
  };
}
