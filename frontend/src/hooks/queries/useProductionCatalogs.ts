import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type {
  CharacterDetailResponse,
  CostumeResponse,
  CueCategoryResponse,
  GroupResponse,
  PropResponse,
  SetPieceResponse,
  SongDetailResponse,
} from "@/lib/types";

export function useCharactersCatalog(productionId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.characters(productionId),
    queryFn: () => api.listCharacters(productionId),
    enabled,
  });
}

export function useGroupsCatalog(productionId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.groups(productionId),
    queryFn: () => api.listGroups(productionId),
    enabled,
  });
}

export function useSongsCatalog(productionId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.songs(productionId),
    queryFn: () => api.listSongs(productionId),
    enabled,
  });
}

export function usePropsCatalog(productionId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.props(productionId),
    queryFn: () => api.listProps(productionId),
    enabled,
  });
}

export function useSetPiecesCatalog(productionId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.setPieces(productionId),
    queryFn: () => api.listSetPieces(productionId),
    enabled,
  });
}

export function useCostumesCatalog(productionId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.costumes(productionId),
    queryFn: () => api.listCostumes(productionId),
    enabled,
  });
}

export function useCueCategoriesCatalog(productionId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.catalog.cueCategories(productionId),
    queryFn: () => api.listCueCategories(productionId),
    enabled,
  });
}

type CatalogRow =
  | CharacterDetailResponse
  | GroupResponse
  | SongDetailResponse
  | PropResponse
  | SetPieceResponse
  | CostumeResponse
  | CueCategoryResponse;

function upsertById<T extends { id: number }>(list: T[] | undefined, row: T): T[] {
  const prev = list ?? [];
  const idx = prev.findIndex((item) => item.id === row.id);
  if (idx === -1) return [...prev, row];
  const next = prev.slice();
  next[idx] = row;
  return next;
}

/** Write-through helpers so Object detail saves update Timeline-shared catalogs. */
export function useCatalogWriteThrough(productionId: number) {
  const queryClient = useQueryClient();

  const patchCatalogRow = useCallback(
    <T extends CatalogRow>(
      key: readonly unknown[],
      row: T,
    ) => {
      queryClient.setQueryData<T[]>(key, (prev) => upsertById(prev, row));
    },
    [queryClient],
  );

  const setCharacter = useCallback(
    (row: CharacterDetailResponse) =>
      patchCatalogRow(queryKeys.catalog.characters(productionId), row),
    [patchCatalogRow, productionId],
  );
  const setGroup = useCallback(
    (row: GroupResponse) =>
      patchCatalogRow(queryKeys.catalog.groups(productionId), row),
    [patchCatalogRow, productionId],
  );
  const setSong = useCallback(
    (row: SongDetailResponse) =>
      patchCatalogRow(queryKeys.catalog.songs(productionId), row),
    [patchCatalogRow, productionId],
  );
  const setProp = useCallback(
    (row: PropResponse) =>
      patchCatalogRow(queryKeys.catalog.props(productionId), row),
    [patchCatalogRow, productionId],
  );
  const setSetPiece = useCallback(
    (row: SetPieceResponse) =>
      patchCatalogRow(queryKeys.catalog.setPieces(productionId), row),
    [patchCatalogRow, productionId],
  );
  const setCostume = useCallback(
    (row: CostumeResponse) =>
      patchCatalogRow(queryKeys.catalog.costumes(productionId), row),
    [patchCatalogRow, productionId],
  );
  const setCueCategory = useCallback(
    (row: CueCategoryResponse) =>
      patchCatalogRow(queryKeys.catalog.cueCategories(productionId), row),
    [patchCatalogRow, productionId],
  );

  return {
    setCharacter,
    setGroup,
    setSong,
    setProp,
    setSetPiece,
    setCostume,
    setCueCategory,
  };
}

export function catalogPrefetchOptions(productionId: number) {
  return {
    characters: {
      queryKey: queryKeys.catalog.characters(productionId),
      queryFn: () => api.listCharacters(productionId),
    },
    props: {
      queryKey: queryKeys.catalog.props(productionId),
      queryFn: () => api.listProps(productionId),
    },
    songs: {
      queryKey: queryKeys.catalog.songs(productionId),
      queryFn: () => api.listSongs(productionId),
    },
    setPieces: {
      queryKey: queryKeys.catalog.setPieces(productionId),
      queryFn: () => api.listSetPieces(productionId),
    },
    costumes: {
      queryKey: queryKeys.catalog.costumes(productionId),
      queryFn: () => api.listCostumes(productionId),
    },
    cueCategories: {
      queryKey: queryKeys.catalog.cueCategories(productionId),
      queryFn: () => api.listCueCategories(productionId),
    },
    groups: {
      queryKey: queryKeys.catalog.groups(productionId),
      queryFn: () => api.listGroups(productionId),
    },
  } as const;
}

/** Seed shared catalog queries after list-page loads so Timeline/peeks stay in sync. */
export function seedCharactersCatalog(
  queryClient: QueryClient,
  productionId: number,
  rows: CharacterDetailResponse[],
) {
  queryClient.setQueryData(queryKeys.catalog.characters(productionId), rows);
}

export function seedPropsCatalog(
  queryClient: QueryClient,
  productionId: number,
  rows: PropResponse[],
) {
  queryClient.setQueryData(queryKeys.catalog.props(productionId), rows);
}

export function seedSongsCatalog(
  queryClient: QueryClient,
  productionId: number,
  rows: SongDetailResponse[],
) {
  queryClient.setQueryData(queryKeys.catalog.songs(productionId), rows);
}

export function seedSetPiecesCatalog(
  queryClient: QueryClient,
  productionId: number,
  rows: SetPieceResponse[],
) {
  queryClient.setQueryData(queryKeys.catalog.setPieces(productionId), rows);
}

export function seedCostumesCatalog(
  queryClient: QueryClient,
  productionId: number,
  rows: CostumeResponse[],
) {
  queryClient.setQueryData(queryKeys.catalog.costumes(productionId), rows);
}

export function seedGroupsCatalog(
  queryClient: QueryClient,
  productionId: number,
  rows: GroupResponse[],
) {
  queryClient.setQueryData(queryKeys.catalog.groups(productionId), rows);
}

export function seedCueCategoriesCatalog(
  queryClient: QueryClient,
  productionId: number,
  rows: CueCategoryResponse[],
) {
  queryClient.setQueryData(queryKeys.catalog.cueCategories(productionId), rows);
}
