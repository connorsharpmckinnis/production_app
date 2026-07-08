import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, isImportLineError } from "@/lib/api";
import type { ImportLineErrorDetail } from "@/lib/types";

export default function ImportPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineError, setLineError] = useState<ImportLineErrorDetail | null>(null);

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setError(null);
    setLineError(null);
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
        <Link
          to="/productions"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to productions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Import Script</h1>
        <p className="text-sm text-muted-foreground">
          Upload a markdown script file to build the timeline.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="space-y-2">
          <label htmlFor="script-file" className="text-sm font-medium">
            Script file (.md)
          </label>
          <input
            id="script-file"
            type="file"
            accept=".md"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          {file && (
            <p className="text-xs text-muted-foreground">Selected: {file.name}</p>
          )}
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
