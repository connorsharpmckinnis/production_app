import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { ProductionResponse } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";

export default function ProductionListPage() {
  const { isAdmin, isActorOnly } = useAuth();
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
    if (!confirm("Delete this production? This cannot be undone.")) return;

    setDeletingId(id);
    try {
      await api.deleteProduction(id);
      setProductions((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      const message =
        err instanceof ApiError ? String(err.detail) : "Failed to delete production";
      alert(message);
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
          <p className="text-sm text-muted-foreground">Manage theater productions</p>
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
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          {isActorOnly
            ? "No productions yet — ask your director to cast you."
            : "No productions yet."}
          {isAdmin && " Create one to get started."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Season</th>
                <th className="px-4 py-3 text-left font-medium">Author</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {productions.map((production) => (
                <tr key={production.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{production.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {production.season ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {production.author ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(production.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {production.author ? (
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
                        <button
                          type="button"
                          disabled={deletingId === production.id}
                          onClick={() => void handleDelete(production.id)}
                          className="rounded-md border border-destructive/30 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
