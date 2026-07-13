import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { ProductionOverviewResponse } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export default function ProductionOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation, isAdmin } = useAuth();

  const [overview, setOverview] = useState<ProductionOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getProductionOverview(productionId)
      .then(setOverview)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load overview");
      })
      .finally(() => setLoading(false));
  }, [productionId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error ?? "Production not found"}
      </div>
    );
  }

  const needsImport = overview.act_count === 0;
  const needsCasting =
    overview.character_count > 0 && overview.cast_count < overview.character_count;
  const castLabel =
    overview.character_count > 0
      ? `${overview.cast_count} of ${overview.character_count} characters cast`
      : "No characters yet";

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/productions"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Productions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{overview.title}</h1>
        {overview.season && (
          <p className="text-sm text-muted-foreground">Season {overview.season}</p>
        )}
      </div>

      {needsImport && (
        <EmptyState
          title="This production needs a script"
          description={
            isAdmin
              ? "Import a Theater App markdown or Word (.docx) script to build the timeline."
              : "Ask an admin to import the script before rehearsal prep begins."
          }
          actionLabel={isAdmin ? "Import script" : undefined}
          actionTo={isAdmin ? `/productions/${productionId}/import` : undefined}
        />
      )}

      {!needsImport && needsCasting && (
        <EmptyState
          title="Casting is incomplete"
          description={`${overview.character_count - overview.cast_count} character${
            overview.character_count - overview.cast_count === 1 ? "" : "s"
          } still need an actor.`}
          actionLabel="Open characters"
          actionTo={`/productions/${productionId}/characters`}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Acts" value={overview.act_count} />
        <StatCard label="Scenes" value={overview.scene_count} />
        <StatCard label="Moments" value={overview.moment_count} />
        <StatCard label="Characters" value={overview.character_count} />
        <StatCard label="Casting" value={castLabel} />
        <StatCard
          label="Script author"
          value={overview.author ?? "Not imported"}
        />
      </div>

      <div className="text-sm text-muted-foreground">
        <p>Created {formatDate(overview.created_at)}</p>
        {overview.imported_at && <p>Imported {formatDate(overview.imported_at)}</p>}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium">Quick links</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to={`/productions/${productionId}/rehearse`} label="Rehearse" />
          <QuickLink to={`/productions/${productionId}/timeline`} label="Timeline" />
          <QuickLink to={`/productions/${productionId}/characters`} label="Characters" />
          <QuickLink to={`/productions/${productionId}/props`} label="Props" />
          <QuickLink to={`/productions/${productionId}/songs`} label="Songs" />
          {canManagePreparation && (
            <QuickLink to={`/productions/${productionId}/reports`} label="Reports" />
          )}
          {isAdmin && needsImport && (
            <QuickLink to={`/productions/${productionId}/import`} label="Import script" />
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-muted"
    >
      {label}
    </Link>
  );
}
