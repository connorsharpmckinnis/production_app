import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { api, ApiError, isImportLineError } from "@/lib/api";
import type { ImportLineErrorDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ImportPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineError, setLineError] = useState<ImportLineErrorDetail | null>(null);

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setError(null);
    setLineError(null);
  }

  function acceptFile(selected: File | null) {
    if (!selected) return;
    if (!selected.name.endsWith(".md")) {
      setError("Only .md script files are accepted.");
      return;
    }
    handleFileChange(selected);
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
      setError("Please select a .md script file.");
      return;
    }

    if (!file.name.endsWith(".md")) {
      setError("Only .md script files are accepted.");
      return;
    }

    setImporting(true);
    setError(null);
    setLineError(null);

    try {
      await api.importScript(productionId, file);
      toast.success("Script imported");
      navigate(`/productions/${productionId}/timeline`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (isImportLineError(err.detail)) {
          setLineError(err.detail);
        } else {
          setError(String(err.detail));
        }
      } else {
        setError("Import failed");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
        <p className="text-sm text-muted-foreground">
          Upload a markdown script file to build the timeline. See{" "}
          <Link to="/about" className="text-primary hover:underline">
            About the App
          </Link>{" "}
          for workflow context; scripts should follow the Theater App markdown format.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="space-y-2">
          <label htmlFor="script-file" className="text-sm font-medium">
            Script file (.md)
          </label>
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50 hover:bg-muted/30",
            )}
          >
            <p className="text-sm font-medium">Drop your script here</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse (.md only)</p>
            {file && (
              <p className="mt-3 text-xs text-muted-foreground">Selected: {file.name}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            id="script-file"
            type="file"
            accept=".md"
            className="sr-only"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          type="button"
          disabled={importing || !file}
          onClick={() => void handleImport()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import Script"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Format tips</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Start with title page lines like <code className="text-xs">Title:</code> and <code className="text-xs">Author:</code>, then <code className="text-xs">Act 1</code>.</li>
          <li>Scene headings use <code className="text-xs">Scene 1 - Title</code> (number, hyphen, title).</li>
          <li>Dialogue is one line per beat: <code className="text-xs">CHARACTER: line of dialogue</code>.</li>
          <li>Stage directions are prose wrapped in asterisks: <code className="text-xs">*LIGHTS UP on…*</code>.</li>
          <li>Separate each moment with a blank line — one beat per moment on the timeline.</li>
        </ul>
      </div>

      {lineError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <h2 className="font-semibold text-destructive">
            Import failed at line {lineError.line_number}
          </h2>
          <p className="mt-2 text-sm">
            <span className="font-medium">Line content:</span>{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {lineError.line_content}
            </code>
          </p>
          <p className="mt-2 text-sm">
            <span className="font-medium">Reason:</span> {lineError.message}
          </p>
        </div>
      )}

      {error && !lineError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
