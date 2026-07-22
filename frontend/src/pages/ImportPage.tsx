import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { api, ApiError, formatApiError, isImportErrorsDetail } from "@/lib/api";
import type { ImportErrorsDetail, ImportLineErrorDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = [".md", ".docx"] as const;

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function IssueCard({ issue, index }: { issue: ImportLineErrorDetail; index: number }) {
  const isSong = issue.kind === "song";
  return (
    <article className="rounded-md border border-destructive/40 bg-background/60 p-3">
      <h3 className="text-sm font-semibold text-destructive">
        {isSong ? "Song issue" : "Line issue"} #{index}
        <span className="font-normal text-muted-foreground">
          {" "}
          · line {issue.line_number}
          {issue.song_title ? ` · “${issue.song_title}”` : ""}
        </span>
      </h3>
      {(issue.source_format ||
        issue.paragraph_number != null ||
        issue.paragraph_style) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {[
            issue.source_format ? `Format: ${issue.source_format}` : null,
            issue.paragraph_number != null
              ? `Paragraph: ${issue.paragraph_number}`
              : null,
            issue.paragraph_style ? `Style: ${issue.paragraph_style}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {issue.context_snippet && (
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap">
          {issue.context_snippet.split("\n").map((snippetLine, lineIndex, lines) => {
            const isFailingLine = lineIndex === lines.length - 1;
            return (
              <span
                key={`${lineIndex}-${snippetLine}`}
                className={cn(
                  "block",
                  isFailingLine && "font-semibold text-destructive",
                )}
              >
                {isFailingLine ? `→ ${snippetLine}` : snippetLine}
              </span>
            );
          })}
        </pre>
      )}
      <p className="mt-2 text-sm">
        <span className="font-medium">Reason:</span> {issue.message}
      </p>
    </article>
  );
}

export default function ImportPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ImportErrorsDetail | null>(null);
  const [productionTitle, setProductionTitle] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getProduction(productionId)
      .then((production) => setProductionTitle(production.title))
      .catch(() => setProductionTitle(null));
  }, [productionId]);

  useEffect(() => {
    if (!importErrors && !error) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [importErrors, error]);

  function clearResults() {
    setError(null);
    setImportErrors(null);
  }

  function handleFileChange(selected: File | null) {
    setFile(selected);
    clearResults();
  }

  function acceptFile(selected: File | null) {
    if (!selected) return;
    if (!hasAcceptedExtension(selected.name)) {
      setImportErrors(null);
      setError("Only .md and .docx script files are accepted.");
      return;
    }
    handleFileChange(selected);
  }

  function openFilePicker() {
    const input = fileInputRef.current;
    if (!input) return;
    // Allow re-selecting the same path after a failed import.
    input.value = "";
    input.click();
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
    const dropped = event.dataTransfer.files[0] ?? null;
    acceptFile(dropped);
  }

  async function handleImport() {
    if (!file) {
      setImportErrors(null);
      setError("Please select a .md or .docx script file.");
      return;
    }

    if (!hasAcceptedExtension(file.name)) {
      setImportErrors(null);
      setError("Only .md and .docx script files are accepted.");
      return;
    }

    setImporting(true);
    clearResults();

    try {
      await api.importScript(productionId, file);
      toast.success("Script imported");
      navigate(`/productions/${productionId}/timeline`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (isImportErrorsDetail(err.detail)) {
          setImportErrors(err.detail);
        } else {
          setError(formatApiError(err, "Import failed"));
        }
      } else {
        setError("Import failed");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link
            to={`/productions/${productionId}`}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Overview
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/productions" className="text-muted-foreground hover:text-foreground">
            All productions
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Import Script</h1>
        {productionTitle && (
          <p className="mt-1 text-sm font-medium text-foreground">{productionTitle}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a markdown (`.md`) or Word (`.docx`) script to build the timeline.
          Production name stays as set when you created it; the script title page does
          not rename it. See{" "}
          <Link to="/about" className="text-primary hover:underline">
            About the App
          </Link>{" "}
          for workflow context.
        </p>
      </div>

      <form
        className="space-y-4 rounded-lg border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleImport();
        }}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Script file (.md or .docx)</p>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50 hover:bg-muted/30",
            )}
          >
            <p className="text-sm font-medium">Drop your script here</p>
            <p className="mt-1 text-xs text-muted-foreground">or choose a file to upload</p>
            <button
              type="button"
              onClick={openFilePicker}
              className="mt-4 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
            >
              Choose file
            </button>
            {file && (
              <p className="mt-3 text-xs text-muted-foreground">Selected: {file.name}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            id="script-file"
            type="file"
            accept=".md,.docx"
            className="sr-only"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={importing || !file}>
            {importing ? "Importing…" : "Import Script"}
          </Button>
          {file && (
            <button
              type="button"
              onClick={openFilePicker}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Change file
            </button>
          )}
        </div>
      </form>

      {importErrors && (
        <div
          ref={errorRef}
          className="rounded-lg border border-destructive bg-destructive/10 p-4"
        >
          <h2 className="font-semibold text-destructive">
            {importErrors.message ||
              `Import failed with ${importErrors.errors.length} issue(s)`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing was saved. Fix the items below, choose an updated file, then
            import again.
          </p>
          <div className="mt-4 max-h-[min(70vh,40rem)] space-y-3 overflow-y-auto pr-1">
            {importErrors.errors.map((issue, index) => (
              <IssueCard
                key={`${issue.line_number}-${issue.message}-${index}`}
                issue={issue}
                index={index + 1}
              />
            ))}
          </div>
        </div>
      )}

      {error && !importErrors && (
        <div
          ref={errorRef}
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Format tips</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Start with title page lines like <code className="text-xs">Title:</code> and{" "}
            <code className="text-xs">Author:</code>, then <code className="text-xs">Act 1</code>.
          </li>
          <li>
            Scene headings use <code className="text-xs">Scene 1 - Title</code> (number,
            hyphen, title).
          </li>
          <li>
            Dialogue is one line per beat:{" "}
            <code className="text-xs">CHARACTER: line of dialogue</code>.
          </li>
          <li>
            Stage directions are italic (Word) or wrapped in asterisks:{" "}
            <code className="text-xs">*LIGHTS UP on…*</code>.
          </li>
          <li>
            For Word/Google Docs: Heading 1 = Act, Heading 2 = Scene, Heading 3 = song
            title (ALL CAPS), italic Body = stage direction, centered ALL CAPS = lyrics.
          </li>
          <li>Separate each moment with a blank line — one beat per moment on the timeline.</li>
        </ul>
      </div>
    </div>
  );
}
