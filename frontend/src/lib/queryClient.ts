import { QueryClient } from "@tanstack/react-query";

/**
 * How long cached detail/catalog data stays "fresh enough" not to auto-refetch.
 * Generous for solo/pilot prep snappiness; own mutations still write-through or invalidate.
 */
export const STALE_TIME_MS = 2 * 60 * 1000;

/** Keep unused cache entries around for back-navigation / re-open. */
export const GC_TIME_MS = 30 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      // Prefer cache hits over opportunistic refetch while we prove snappiness.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
