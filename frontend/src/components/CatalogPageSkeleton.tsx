import { Skeleton } from "@/components/ui/skeleton";

interface CatalogPageSkeletonProps {
  showBreadcrumb?: boolean;
  variant?: "table" | "block";
  tableRows?: number;
}

export default function CatalogPageSkeleton({
  showBreadcrumb = true,
  variant = "table",
  tableRows = 7,
}: CatalogPageSkeletonProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {showBreadcrumb && <Skeleton className="h-4 w-24" />}
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-32" />
      </div>
      {variant === "block" ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-2">
          {Array.from({ length: tableRows }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
