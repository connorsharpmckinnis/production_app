import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import type { ProductionResponse } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";

export default function ProductionListPage() {
  const { isAdmin, isActorOnly } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [productions, setProductions] = useState<ProductionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    void api
      .listProductions()
      .then(setProductions)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load productions");
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
      const message =
        err instanceof ApiError ? String(err.detail) : "Failed to delete production";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading productions…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productions</h1>
          <p className="text-sm text-muted-foreground">Manage productions</p>
        </div>
        {isAdmin && (
          <Link
            to="/productions/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New Production
          </Link>
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
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {productions.map((production) => {
                const ready = Boolean(production.author);
                return (
                  <tr key={production.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {ready ? (
                        <Link
                          to={`/productions/${production.id}`}
                          className="hover:underline"
                        >
                          {production.title}
                        </Link>
                      ) : (
                        production.title
                      )}
                    </td>
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
                      <div className="flex justify-end gap-2">
                        {ready ? (
                          <Link
                            to={`/productions/${production.id}`}
                            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                          >
                            Open
                          </Link>
                        ) : isAdmin ? (
                          <Link
                            to={`/productions/${production.id}/import`}
                            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                          >
                            Import
                          </Link>
                        ) : null}
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
