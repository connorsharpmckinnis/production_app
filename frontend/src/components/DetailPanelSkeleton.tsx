import { Skeleton } from "@/components/ui/skeleton";

/** Compact skeleton for Moment / object detail sheets while data loads. */
export default function DetailPanelSkeleton() {
  return (
    <div className="space-y-4 pt-2 pr-10" role="status" aria-label="Loading details">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="grid gap-2 pt-2 sm:grid-cols-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
