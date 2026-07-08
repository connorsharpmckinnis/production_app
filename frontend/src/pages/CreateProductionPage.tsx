import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";

export default function CreateProductionPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [season, setSeason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const production = await api.createProduction({
        title: title.trim(),
        season: season.trim() || null,
      });
      navigate(`/productions/${production.id}/import`);
    } catch (err) {
      const message =
        err instanceof ApiError ? String(err.detail) : "Failed to create production";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Production</h1>
        <p className="text-sm text-muted-foreground">
          Create a production, then import its script.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="season" className="text-sm font-medium">
            Season
          </label>
          <input
            id="season"
            type="text"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="e.g. Spring 2026"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Production"}
          </button>
          <Link
            to="/productions"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
