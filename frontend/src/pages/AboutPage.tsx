import { useEffect, useState } from "react";
import { Mail, Pencil } from "lucide-react";
import AboutPageEditor from "@/components/AboutPageEditor";
import MarkdownContent from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import {
  ABOUT_FEEDBACK_EMAIL,
  defaultAboutMarkdown,
  feedbackMailtoHref,
} from "@/aboutContent";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";

export default function AboutPage() {
  const { isAdmin } = useAuth();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const displayMarkdown = markdown ?? defaultAboutMarkdown();

  async function loadAboutPage() {
    setError(null);
    try {
      const data = await api.getAboutPage();
      setMarkdown(data.markdown);
      setUpdatedAt(data.updated_at);
    } catch (err) {
      setError(formatApiError(err, "Failed to load About page"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAboutPage();
  }, []);

  function handleSaved(savedMarkdown: string) {
    setMarkdown(savedMarkdown);
    setUpdatedAt(new Date().toISOString());
    setEditing(false);
  }

  if (loading) {
    return <CatalogPageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">About the App</h1>
          {updatedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Last updated {new Date(updatedAt).toLocaleString()}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              What this is, what works today, and where I want it to go.
            </p>
          )}
        </div>
        {isAdmin && !editing ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Edit page
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {editing ? (
        <AboutPageEditor
          initialMarkdown={displayMarkdown}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <MarkdownContent markdown={displayMarkdown} className="space-y-4" />
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Prefer the in-app form: open your name in the header and choose{" "}
              <span className="font-medium text-foreground">Send feedback</span> (bug or idea). Or
              email{" "}
              <span className="font-medium text-foreground">{ABOUT_FEEDBACK_EMAIL}</span>.
            </p>
            <Button asChild className="mt-3" variant="outline">
              <a href={feedbackMailtoHref()}>
                <Mail />
                Email me
              </a>
            </Button>
          </div>
        </>
      )}

      {isAdmin && !editing ? (
        <p className="text-xs text-muted-foreground">
          Admins can edit this page in place with Markdown. Use the Edit button above to update
          copy, add images, and format sections without touching code.
        </p>
      ) : null}
    </div>
  );
}
