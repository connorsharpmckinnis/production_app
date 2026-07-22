import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { ProductionResponse } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { cn, formatDate } from "@/lib/utils";

export default function ProductionListPage() {
  const { isAdmin, isActorOnly } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [productions, setProductions] = useState<ProductionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    void api
      .listProductions()
      .then(setProductions)
      .catch((err: unknown) => {
        setError(formatApiError(err, "Failed to load productions"));
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    const ok = await confirm({
      title: "Delete this production?",
      description: "This cannot be undone. All timeline and prep data will be removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(id);
    try {
      await api.deleteProduction(id);
      setProductions((prev) => prev.filter((p) => p.id !== id));
      toast.success("Production deleted");
    } catch (err) {
      const message = formatApiError(err, "Failed to delete production");
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  function productionHref(production: ProductionResponse): string | null {
    if (production.author) return `/productions/${production.id}`;
    if (isAdmin) return `/productions/${production.id}/import`;
    return null;
  }

  if (loading) {
    return <CatalogPageSkeleton showBreadcrumb={false} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productions</h1>
          <p className="text-sm text-muted-foreground">Manage productions</p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/productions/new">New Production</Link>
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {productions.length === 0 ? (
        <EmptyState
          title={
            isActorOnly
              ? "No productions yet"
              : "No productions yet"
          }
          description={
            isActorOnly
              ? "Ask your director to cast you in a production."
              : isAdmin
                ? "Create a production to get started."
                : "Ask an admin to create a production."
          }
          actionLabel={isAdmin ? "New production" : undefined}
          actionTo={isAdmin ? "/productions/new" : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Season</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {productions.map((production) => {
                const ready = Boolean(production.author);
                const href = productionHref(production);
                const clickable = Boolean(href);

                return (
                  <tr
                    key={production.id}
                    className={cn(
                      "border-b border-border last:border-0",
                      clickable && "cursor-pointer hover:bg-muted/50",
                    )}
                    onClick={() => {
                      if (href) navigate(href);
                    }}
                    onKeyDown={(event) => {
                      if (!href) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(href);
                      }
                    }}
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? "link" : undefined}
                    aria-label={
                      clickable
                        ? ready
                          ? `Open ${production.title}`
                          : `Import script for ${production.title}`
                        : undefined
                    }
                  >
                    <td className="px-4 py-3 font-medium">{production.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {production.season ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {ready ? (
                        <Badge variant="secondary">Ready</Badge>
                      ) : (
                        <Badge variant="outline">Needs import</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(production.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {!ready && isAdmin && (
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/productions/${production.id}/import`}>Import</Link>
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={deletingId === production.id}
                            onClick={() => void handleDelete(production.id)}
                            aria-label={`Delete ${production.title}`}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        )}
                        {clickable && (
                          <ChevronRight
                            className="size-4 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
