import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AnnouncementManager from "@/components/AnnouncementManager";
import EmptyState from "@/components/EmptyState";
import OverviewMessageEditor from "@/components/OverviewMessageEditor";
import OverviewSpotlight from "@/components/OverviewSpotlight";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { dimensionHref } from "@/lib/overviewSpotlight";
import type {
  CharacterDetailResponse,
  ProductionOverviewResponse,
  ReadinessDimension,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

const GAP_PREVIEW_LIMIT = 3;

export default function ProductionOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { user, canManagePreparation, isAdmin, isActorOnly } = useAuth();

  const [overview, setOverview] = useState<ProductionOverviewResponse | null>(null);
  const [myRoles, setMyRoles] = useState<CharacterDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getProductionOverview(productionId);
      setOverview(data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load overview"));
    } finally {
      setLoading(false);
    }
  }, [productionId]);

  useEffect(() => {
    setLoading(true);
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!isActorOnly || !user || !overview) {
      setMyRoles([]);
      setRolesError(null);
      setRolesLoading(false);
      return;
    }

    let cancelled = false;
    setRolesLoading(true);
    setRolesError(null);
    void api
      .listCharacters(productionId)
      .then((characters) => {
        if (!cancelled) {
          setMyRoles(
            characters.filter((character) => character.assigned_actor?.user_id === user.id),
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRolesError(formatApiError(err, "Could not load your roles."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRolesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isActorOnly, overview, productionId, user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Production not found"}</AlertDescription>
      </Alert>
    );
  }

  if (isActorOnly) {
    return (
      <ActorOverview
        productionId={productionId}
        overview={overview}
        myRoles={myRoles}
        rolesLoading={rolesLoading}
        rolesError={rolesError}
      />
    );
  }

  return (
    <StaffOverview
      productionId={productionId}
      overview={overview}
      canManagePreparation={canManagePreparation}
      isAdmin={isAdmin}
      onMessagesSaved={() => void loadOverview()}
    />
  );
}

function StaffOverview({
  productionId,
  overview,
  canManagePreparation,
  isAdmin,
  onMessagesSaved,
}: {
  productionId: number;
  overview: ProductionOverviewResponse;
  canManagePreparation: boolean;
  isAdmin: boolean;
  onMessagesSaved: () => void;
}) {
  const needsImport = overview.act_count === 0;
  const readinessLabel =
    overview.readiness_percent === null ? "—" : `${overview.readiness_percent}%`;

  return (
    <div className="space-y-8 pb-10">
      <header>
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
        <p className="mt-2 text-sm text-muted-foreground">
          Created {formatDate(overview.created_at)}
          {overview.imported_at ? ` · Imported ${formatDate(overview.imported_at)}` : ""}
          {overview.author ? ` · ${overview.author}` : ""}
        </p>
      </header>

      <OverviewSpotlight
        productionId={productionId}
        messages={overview.spotlight}
        rotationSeconds={overview.rotation_seconds}
      />

      {needsImport && (
        <EmptyState
          title="This production needs a script"
          description={
            isAdmin
              ? "Import a script to build the timeline."
              : "Ask an admin to import the script before rehearsal prep begins."
          }
          actionLabel={isAdmin ? "Import script" : undefined}
          actionTo={isAdmin ? `/productions/${productionId}/import` : undefined}
        />
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Prep readiness</h2>
            <p className="text-sm text-muted-foreground">
              Heuristic coverage from casting, costumes, cues, and catalogs — not a review checklist.
            </p>
          </div>
          <p className="text-3xl font-semibold tracking-tight" aria-label="Overall readiness">
            {readinessLabel}
          </p>
        </div>

        {overview.dimensions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {needsImport
              ? "Import a script to start measuring readiness."
              : "No readiness dimensions available yet."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.dimensions.map((dimension) => (
              <DimensionCard
                key={dimension.key}
                productionId={productionId}
                dimension={dimension}
              />
            ))}
          </div>
        )}
      </section>

      {canManagePreparation && (
        <OverviewMessageEditor productionId={productionId} onSaved={onMessagesSaved} />
      )}

      {canManagePreparation && <AnnouncementManager productionId={productionId} />}

      <section>
        <h2 className="mb-3 text-sm font-medium">Quick links</h2>
        <div className="flex flex-wrap gap-2">
          <QuickLink to={`/productions/${productionId}/timeline?rehearse=1`} label="Rehearse" />
          <QuickLink to={`/productions/${productionId}/timeline`} label="Timeline" />
          <QuickLink to={`/productions/${productionId}/characters`} label="Characters" />
          <QuickLink to={`/productions/${productionId}/reports`} label="Reports" />
          {isAdmin && needsImport && (
            <QuickLink to={`/productions/${productionId}/import`} label="Import script" />
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Catalogs and casting live in the production nav. Reports stay under Reports.
        </p>
      </section>
    </div>
  );
}

function ActorOverview({
  productionId,
  overview,
  myRoles,
  rolesLoading,
  rolesError,
}: {
  productionId: number;
  overview: ProductionOverviewResponse;
  myRoles: CharacterDetailResponse[];
  rolesLoading: boolean;
  rolesError: string | null;
}) {
  return (
    <div className="space-y-8 pb-10">
      <header>
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
      </header>

      <OverviewSpotlight
        productionId={productionId}
        messages={overview.spotlight}
        rotationSeconds={overview.rotation_seconds}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your roles</h2>
        {rolesError ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
            The overview loaded, but your roles could not be loaded: {rolesError}
          </p>
        ) : rolesLoading ? (
          <p className="text-sm text-muted-foreground">Loading your roles…</p>
        ) : myRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You are not cast in this production yet.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              You&apos;re on as{" "}
              {myRoles.map((role) => role.name).join(", ")}.
            </p>
            <ul className="flex flex-wrap gap-2">
              {myRoles.map((role) => (
                <li key={role.id}>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/productions/${productionId}/timeline?rehearse=1`}>{role.name}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div>
        <Button asChild size="lg">
          <Link to={`/productions/${productionId}/timeline?rehearse=1`}>Rehearse</Link>
        </Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium">Coming soon</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <PlaceholderCard label="Your mic" />
          <PlaceholderCard label="Notes for you" />
          <PlaceholderCard label="Call sheet" />
        </div>
      </section>
    </div>
  );
}

function DimensionCard({
  productionId,
  dimension,
}: {
  productionId: number;
  dimension: ReadinessDimension;
}) {
  const scoreLabel = dimension.score === null ? "—" : `${dimension.score}%`;
  const href = dimensionHref(productionId, dimension.href_hint);
  const previewGaps = dimension.gaps.slice(0, GAP_PREVIEW_LIMIT);
  const remaining = dimension.gaps.length - previewGaps.length;

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{dimension.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{dimension.summary}</p>
        </div>
        <p className="text-lg font-semibold tabular-nums">{scoreLabel}</p>
      </div>

      {previewGaps.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="underline-offset-2 group-open:no-underline hover:underline">
              {dimension.gaps.length} gap{dimension.gaps.length === 1 ? "" : "s"}
            </span>
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {previewGaps.map((gap, index) => (
              <li key={`${dimension.key}-${index}-${gap}`}>{gap}</li>
            ))}
            {remaining > 0 && <li>…and {remaining} more</li>}
          </ul>
        </details>
      )}

      <Button asChild variant="link" className="mt-3 h-auto p-0">
        <Link to={href}>Open {dimension.label.toLowerCase()}</Link>
      </Button>
    </article>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="outline" className="justify-start">
      <Link to={to}>{label}</Link>
    </Button>
  );
}

function PlaceholderCard({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">Coming soon</p>
    </div>
  );
}
