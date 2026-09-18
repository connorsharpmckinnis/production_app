/**
 * Production-scoped TanStack Query keys.
 * Always include productionId so caches never bleed across productions.
 */
export const queryKeys = {
  production: (productionId: number) => ["production", productionId] as const,

  moment: (productionId: number, momentId: number) =>
    [...queryKeys.production(productionId), "moment", momentId] as const,

  momentsList: (
    productionId: number,
    sceneId: number,
    filtersKey: string,
  ) =>
    [
      ...queryKeys.production(productionId),
      "momentsList",
      sceneId,
      filtersKey,
    ] as const,

  catalog: {
    all: (productionId: number) =>
      [...queryKeys.production(productionId), "catalog"] as const,
    characters: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "characters"] as const,
    groups: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "groups"] as const,
    songs: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "songs"] as const,
    props: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "props"] as const,
    setPieces: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "setPieces"] as const,
    costumes: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "costumes"] as const,
    cueCategories: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "cueCategories"] as const,
    people: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "people"] as const,
    peopleRoles: (productionId: number) =>
      [...queryKeys.catalog.all(productionId), "peopleRoles"] as const,
  },
} as const;
