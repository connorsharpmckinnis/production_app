import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import {
  CATALOG_CSV_CONFIGS,
  formatByteSize,
  MAX_CATALOG_CSV_BYTES,
  shouldRefreshAfterCatalogImport,
  validateCatalogCsvFile,
  type CatalogCsvKind,
} from "@/lib/catalogCsv";
import type { CatalogImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CatalogCsvImportProps {
  productionId: number;
  kind: CatalogCsvKind;
  onImported: () => void | Promise<void>;
}

export default function CatalogCsvImport({
  productionId,
  kind,
  onImported,
}: CatalogCsvImportProps) {
  const config = CATALOG_CSV_CONFIGS[kind];
  const toast = useToast();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CatalogImportResult | null>(null);

  function resetDialogState() {
    setFile(null);
    setDragActive(false);
    setImporting(false);
    setError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetDialogState();
    }
  }

  function acceptFile(selected: File | null) {
    setResult(null);
    const validationError = validateCatalogCsvFile(selected);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }
    setFile(selected);
    setError(null);
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
    acceptFile(event.dataTransfer.files[0] ?? null);
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      await api.downloadCatalogCsvTemplate(productionId, kind);
    } catch (err) {
      toast.error(formatApiError(err, "Failed to download template"));
    } finally {
      setDownloading(false);
    }
  }

  async function handleImport() {
    const validationError = validateCatalogCsvFile(file);
    if (validationError || !file) {
      setError(validationError ?? "Please select a .csv file.");
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const importResult = await api.importCatalogCsv(productionId, kind, file);
      setResult(importResult);
      if (shouldRefreshAfterCatalogImport(importResult)) {
        await onImported();
      }
      if (importResult.created > 0 && importResult.errors.length === 0) {
        toast.success(
          `Imported ${importResult.created} ${config.label}${
            importResult.skipped > 0 ? ` (${importResult.skipped} skipped)` : ""
          }`,
        );
      } else if (importResult.created > 0) {
        toast.success(
          `Imported ${importResult.created} with ${importResult.errors.length} row error(s)`,
        );
      } else if (importResult.errors.length > 0) {
        toast.error("Import finished with row errors");
      } else {
        toast.success(
          importResult.skipped > 0
            ? `No new rows created (${importResult.skipped} skipped)`
            : "Import finished",
        );
      }
    } catch (err) {
      setError(formatApiError(err, "Import failed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        Import CSV
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={downloading}
        onClick={() => void handleDownloadTemplate()}
      >
        {downloading ? "Downloading…" : "Download template"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import {config.label} CSV</DialogTitle>
            <DialogDescription>
              Catalog rows only — this does not attach items to timeline moments.
              Maximum file size is {formatByteSize(MAX_CATALOG_CSV_BYTES)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {config.helpText && (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {config.helpText}
              </p>
            )}

            <div className="space-y-2">
              <label htmlFor={fileInputId} className="text-sm font-medium">
                CSV file
              </label>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Drop or select a CSV file for ${config.label}`}
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
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted/30",
                )}
              >
                <p className="text-sm font-medium">Drop a .csv file here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  or click to browse (max {formatByteSize(MAX_CATALOG_CSV_BYTES)})
                </p>
                {file && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Selected: {file.name} ({formatByteSize(file.size)})
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={downloading}
                onClick={() => void handleDownloadTemplate()}
              >
                {downloading ? "Downloading…" : "Download template"}
              </Button>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {result && (
              <div
                className="space-y-2 rounded-md border border-border bg-muted/20 px-3 py-3 text-sm"
                aria-live="polite"
              >
                <p className="font-medium">Import results</p>
                <p>
                  Created {result.created}, skipped {result.skipped}
                  {result.errors.length > 0
                    ? `, ${result.errors.length} row error(s)`
                    : ""}
                  .
                </p>
                {result.warnings.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground">Warnings</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div>
                    <p className="font-medium text-destructive">Row errors</p>
                    <ul className="mt-1 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-destructive">
                      {result.errors.map((rowError) => (
                        <li key={`${rowError.row}-${rowError.message}`}>
                          Row {rowError.row}: {rowError.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={importing || !file}
              onClick={() => void handleImport()}
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
