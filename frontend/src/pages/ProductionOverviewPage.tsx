import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { ProductionOverviewResponse } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export default function ProductionOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { canManagePreparation } = useAuth();

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
    return <p className="text-muted-foreground">Loading production…</p>;
  }

  if (error || !overview) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error ?? "Production not found"}
      </div>
    );
  }

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to={`/productions/${productionId}/timeline`} label="Timeline" />
        <QuickLink to={`/productions/${productionId}/characters`} label="Characters" />
        {canManagePreparation && (
          <QuickLink to={`/productions/${productionId}/reports`} label="Reports" />
        )}
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
