import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { momentDetailQueryOptions } from "@/hooks/queries/useMomentDetail";
import { catalogPrefetchOptions } from "@/hooks/queries/useProductionCatalogs";
import type { ObjectDetailType } from "@/lib/objectDetail";

const PREFETCH_DELAY_MS = 180;

/**
 * Debounced hover/focus prefetch for ObjectLink (and future hover peek #128).
 * Cancels if the pointer leaves before the delay — avoids Timeline scroll storms.
 */
export function usePrefetchObjectDetail(productionId: number | null) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const prefetch = useCallback(
    (objectType: ObjectDetailType, _objectId: number, momentId?: number) => {
      cancel();
      if (productionId == null) return;

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const catalogs = catalogPrefetchOptions(productionId);

        switch (objectType) {
          case "character":
            void queryClient.prefetchQuery(catalogs.characters);
            break;
          case "prop":
            void queryClient.prefetchQuery(catalogs.props);
            break;
          case "song":
            void queryClient.prefetchQuery(catalogs.songs);
            break;
          case "set_piece":
            void queryClient.prefetchQuery(catalogs.setPieces);
            break;
          case "costume":
            void queryClient.prefetchQuery(catalogs.costumes);
            void queryClient.prefetchQuery(catalogs.characters);
            break;
          case "group":
            void queryClient.prefetchQuery(catalogs.groups);
            void queryClient.prefetchQuery(catalogs.characters);
            break;
          case "cue_category":
            void queryClient.prefetchQuery(catalogs.cueCategories);
            break;
          case "cue":
            if (momentId != null) {
              void queryClient.prefetchQuery(
                momentDetailQueryOptions(productionId, momentId),
              );
            }
            void queryClient.prefetchQuery(catalogs.cueCategories);
            break;
          case "person":
            // Person roster not on shared catalog hooks yet — skip.
            break;
        }
      }, PREFETCH_DELAY_MS);
    },
    [cancel, productionId, queryClient],
  );

  return { prefetch, cancelPrefetch: cancel };
}
