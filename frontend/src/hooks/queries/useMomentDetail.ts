import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { MomentDetailResponse } from "@/lib/types";

export function useMomentDetail(
  productionId: number,
  momentId: number | null,
) {
  return useQuery({
    queryKey:
      momentId != null
        ? queryKeys.moment(productionId, momentId)
        : ["production", productionId, "moment", "none"],
    queryFn: () => api.getMoment(productionId, momentId!),
    enabled: momentId != null,
  });
}

/** Prefetch / shared read for Cue panel, Character scene context, ObjectLink hover. */
export function momentDetailQueryOptions(
  productionId: number,
  momentId: number,
) {
  return {
    queryKey: queryKeys.moment(productionId, momentId),
    queryFn: () => api.getMoment(productionId, momentId),
  } as const;
}

export function useMomentDetailCache(productionId: number) {
  const queryClient = useQueryClient();

  const setMomentDetail = useCallback(
    (detail: MomentDetailResponse | null) => {
      if (detail == null) return;
      queryClient.setQueryData(
        queryKeys.moment(productionId, detail.id),
        detail,
      );
    },
    [productionId, queryClient],
  );

  const removeMomentDetail = useCallback(
    (momentId: number) => {
      queryClient.removeQueries({
        queryKey: queryKeys.moment(productionId, momentId),
      });
    },
    [productionId, queryClient],
  );

  const invalidateMomentDetail = useCallback(
    async (momentId: number) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.moment(productionId, momentId),
      });
    },
    [productionId, queryClient],
  );

  const refreshMomentDetail = useCallback(
    async (momentId: number) => {
      await queryClient.refetchQueries({
        queryKey: queryKeys.moment(productionId, momentId),
      });
    },
    [productionId, queryClient],
  );

  return {
    setMomentDetail,
    removeMomentDetail,
    invalidateMomentDetail,
    refreshMomentDetail,
  };
}
