import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ImportProfileEditor } from "@/components/ImportProfileEditor";
import {
  ImportLayoutPeek,
  type LayoutPeekTarget,
} from "@/components/ImportLayoutPeek";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/context/ToastContext";
import { api, ApiError, formatApiError, isImportErrorsDetail } from "@/lib/api";
import type {
  ImportErrorsDetail,
  ImportLineErrorDetail,
  ImportPreviewResponse,
  ImportProfileDefinition,
  ImportProfileResponse,
  ImportSuccessResponse,
} from "@/lib/types";
import { cn, momentTypeLabel } from "@/lib/utils";
import { momentBadgeClass } from "@/lib/momentStyles";

const ACCEPTED_EXTENSIONS = [".md", ".docx", ".pdf"] as const;

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

function blankProfile(sourceFormat: "pdf" | "md" | "docx" = "pdf"): ImportProfileDefinition {
  return {
    name: "New import profile",
    description: null,
    version: 1,
    source_formats: [sourceFormat],
    pdf: { start_page: 1, end_page: null },
    speakers: { require_all_caps: false, allow_parentheses: true },
    rules: [],
  };
}

function editableDefinition(profile: ImportProfileResponse): ImportProfileDefinition {
  return {
    name: profile.name,
    description: profile.description,
    version: profile.version,
    source_formats: profile.source_formats,
    pdf: { ...profile.pdf },
    speakers: { ...profile.speakers },
    rules: profile.rules.map((rule) => ({
      ...rule,
      match: { ...rule.match },
      action: { ...rule.action },
    })),
  };
}

function sourceFormatForFile(file: File | null): "pdf" | "md" | "docx" {
  const extension = file?.name.toLowerCase().split(".").pop();
  if (extension === "md" || extension === "docx") return extension;
  return "pdf";
}

function peekKey(target: LayoutPeekTarget): string {
  return [
    target.line_number ?? "",
    target.page ?? "",
    target.x0 ?? "",
    target.y0 ?? "",
    target.label,
  ].join("|");
}

export default function ImportPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ImportErrorsDetail | null>(null);
  const [productionTitle, setProductionTitle] = useState<string | null>(null);
  const [hasImportedScript, setHasImportedScript] = useState<boolean | null>(null);
  const [importSuccess, setImportSuccess] = useState<ImportSuccessResponse | null>(null);
  const [profiles, setProfiles] = useState<ImportProfileResponse[]>([]);
  const [profile, setProfile] = useState<ImportProfileDefinition>(() => blankProfile());
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [useProfile, setUseProfile] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [layoutPeek, setLayoutPeek] = useState<LayoutPeekTarget | null>(null);
  const [layoutPeekPinned, setLayoutPeekPinned] = useState(false);

  useEffect(() => {
    void api
      .getProduction(productionId)
      .then((production) => {
        setProductionTitle(production.title);
        setHasImportedScript(production.has_imported_script);
      })
      .catch(() => {
        setProductionTitle(null);
        setHasImportedScript(false);
      });
  }, [productionId]);

  useEffect(() => {
    void api
      .listImportProfiles()
      .then((items) => setProfiles(items))
      .catch((err) => setError(formatApiError(err, "Could not load import profiles")));
  }, []);

  useEffect(() => {
    if (!importErrors && !error) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [importErrors, error]);

  function clearResults() {
    setError(null);
    setImportErrors(null);
  }

  function clearLayoutPeek() {
    setLayoutPeek(null);
    setLayoutPeekPinned(false);
  }

  function hoverLayoutPeek(target: LayoutPeekTarget) {
    if (layoutPeekPinned) return;
    setLayoutPeek(target);
  }

  function pinLayoutPeek(target: LayoutPeekTarget) {
    if (layoutPeekPinned && layoutPeek && peekKey(layoutPeek) === peekKey(target)) {
      setLayoutPeekPinned(false);
      return;
    }
    setLayoutPeek(target);
    setLayoutPeekPinned(true);
  }

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setPreview(null);
    clearLayoutPeek();
    if (selected) {
      const format = sourceFormatForFile(selected);
      setUseProfile(format === "pdf");
      if (!profile.source_formats.includes(format)) {
        setProfile(blankProfile(format));
        setSelectedProfileId(null);
      }
    }
    clearResults();
  }

  function acceptFile(selected: File | null) {
    if (!selected) return;
    if (!hasAcceptedExtension(selected.name)) {
      setImportErrors(null);
      setError("Only .md, .docx, and .pdf script files are accepted.");
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

  function updateProfileDraft(next: ImportProfileDefinition) {
    setProfile(next);
    setPreview(null);
    clearLayoutPeek();
  }

  function loadProfile(profileId: string) {
    if (profileId === "new") {
      setSelectedProfileId(null);
      updateProfileDraft(blankProfile(sourceFormatForFile(file)));
      return;
    }
    const stored = profiles.find((item) => item.id === Number(profileId));
    if (!stored) return;
    setSelectedProfileId(stored.id);
    updateProfileDraft(editableDefinition(stored));
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    clearResults();
    try {
      const selected = profiles.find((item) => item.id === selectedProfileId);
      const saved =
        selected && !selected.is_builtin
          ? await api.updateImportProfile(selected.id, profile)
          : await api.createImportProfile(profile);
      setProfiles((items) => [
        ...items.filter((item) => item.id !== saved.id),
        saved,
      ]);
      setSelectedProfileId(saved.id);
      toast.success(selected?.is_builtin ? "Profile saved as a new copy" : "Profile saved");
    } catch (err) {
      setError(formatApiError(err, "Could not save profile"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePreview() {
    if (!file) {
      setError("Please select a script file.");
      return;
    }
    if (profile.rules.length === 0) {
      setError("Add at least one rule or load a starter profile.");
      return;
    }
    setPreviewing(true);
    clearResults();
    clearLayoutPeek();
    try {
      const isPdf = sourceFormatForFile(file) === "pdf";
      const result = await api.previewScript(productionId, file, profile, {
        pageFrom: isPdf ? profile.pdf.start_page : undefined,
        // Fixed 4-page window from start_page (not end_page).
        pageTo: isPdf ? profile.pdf.start_page + 3 : undefined,
        maxLines: 200,
      });
      setPreview(result);
    } catch (err) {
      setPreview(null);
      clearLayoutPeek();
      setError(formatApiError(err, "Preview failed"));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file) {
      setImportErrors(null);
      setError("Please select a .md, .docx, or .pdf script file.");
      return;
    }

    if (!hasAcceptedExtension(file.name)) {
      setImportErrors(null);
      setError("Only .md, .docx, and .pdf script files are accepted.");
      return;
    }
    if (useProfile && !preview) {
      setError("Refresh the preview for this profile draft before importing.");
      return;
    }

    setImporting(true);
    clearResults();

    try {
      const result = await api.importScript(
        productionId,
        file,
        useProfile ? profile : undefined,
      );
      setImportSuccess(result);
      setHasImportedScript(true);
      toast.success("Script imported");
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

  const fileFormat = sourceFormatForFile(file);
  const showPdfTips = !file || fileFormat === "pdf";
  const showMdDocxTips = Boolean(file && fileFormat !== "pdf" && !useProfile);
  const showProfileTip = Boolean(file && fileFormat !== "pdf" && useProfile);

  const pageHeader = (
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
    </div>
  );

  if (hasImportedScript === null) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {pageHeader}
        <p className="text-sm text-muted-foreground">Loading production…</p>
      </div>
    );
  }

  if (hasImportedScript && !importSuccess) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {pageHeader}
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">Script already imported</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            This production already has an imported script. Re-import is not
            allowed. Open the timeline or overview to continue work.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to={`/productions/${productionId}/timeline`}>Timeline</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/productions/${productionId}`}>Overview</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/productions/${productionId}/characters`}>Characters</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (importSuccess) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {pageHeader}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Import complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The script was imported successfully. Review the timeline next.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-5">
            {(
              [
                ["Acts", importSuccess.acts_created],
                ["Scenes", importSuccess.scenes_created],
                ["Moments", importSuccess.moments_created],
                ["Characters", importSuccess.characters_created],
                ["Songs", importSuccess.songs_created],
              ] as const
            ).map(([label, count]) => (
              <div key={label} className="rounded-md bg-muted p-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{count}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={`/productions/${productionId}/timeline`}>Timeline</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/productions/${productionId}/characters`}>Characters</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/productions/${productionId}`}>Overview</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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
          Upload a Markdown (`.md`), Word (`.docx`), or selectable-text PDF (`.pdf`)
          script to build the timeline.
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
          <p className="text-sm font-medium">Script file (.md, .docx, or .pdf)</p>
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
            <Button
              type="button"
              variant="outline"
              onClick={openFilePicker}
              className="mt-4"
            >
              Choose file
            </Button>
            {file && (
              <p className="mt-3 text-xs text-muted-foreground">Selected: {file.name}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            id="script-file"
            type="file"
            accept=".md,.docx,.pdf"
            className="sr-only"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {file && sourceFormatForFile(file) !== "pdf" && (
            <Button
              type="button"
              variant={useProfile ? "secondary" : "outline"}
              onClick={() => {
                setUseProfile((current) => !current);
                setPreview(null);
                clearLayoutPeek();
              }}
            >
              {useProfile ? "Use standard importer" : "Use custom mapping"}
            </Button>
          )}
          {useProfile && (
            <Button
              type="button"
              variant="outline"
              disabled={previewing || !file}
              onClick={() => void handlePreview()}
            >
              {previewing ? "Building preview…" : "Refresh preview"}
            </Button>
          )}
          <Button
            type="submit"
            disabled={importing || !file || (useProfile && !preview)}
          >
            {importing ? "Importing…" : "Import Script"}
          </Button>
          {file && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openFilePicker}
              className="text-muted-foreground hover:text-foreground"
            >
              Change file
            </Button>
          )}
        </div>
        {useProfile && (
          <p className="text-xs text-muted-foreground">
            Import will use this profile from page {profile.pdf.start_page} through{" "}
            {profile.pdf.end_page != null
              ? `page ${profile.pdf.end_page}`
              : "the end of the file"}
            , not just the preview window.
          </p>
        )}
      </form>

      {useProfile && (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border-2 border-primary/40 bg-card p-4 ring-2 ring-primary/15">
            <div className="min-w-64 flex-1 space-y-1.5">
              <p className="text-sm font-semibold">Choose an import profile</p>
              <p className="text-xs text-muted-foreground">
                Load a starter or keep blank and add rules.
              </p>
              <Select
                value={selectedProfileId == null ? "new" : String(selectedProfileId)}
                onValueChange={loadProfile}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New blank profile</SelectItem>
                  {profiles
                    .filter((item) =>
                      item.source_formats.includes(sourceFormatForFile(file)),
                    )
                    .map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}{item.is_builtin ? " (starter)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={savingProfile || !profile.name.trim()}
              onClick={() => void handleSaveProfile()}
            >
              {savingProfile
                ? "Saving…"
                : profiles.find((item) => item.id === selectedProfileId)?.is_builtin
                  ? "Save as new profile"
                  : selectedProfileId
                    ? "Save profile"
                    : "Save new profile"}
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              You can preview and import an unsaved draft. Save only when you want
              to reuse it later.
            </p>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <ImportProfileEditor profile={profile} onChange={updateProfileDraft} />

            <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              {preview ? (
                <section className="space-y-4 rounded-lg border bg-card p-4">
                  <div>
                    <h2 className="text-lg font-semibold">Import preview</h2>
                    <p className="text-sm text-muted-foreground">
                      Pages {preview.preview_window.page_from ?? "—"}–
                      {preview.preview_window.page_to ?? "—"} ·{" "}
                      {preview.preview_window.line_count} extracted lines
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Preview is a 4-page window from the start page, capped at 200
                      lines. Import uses the full script from start page through the
                      optional end page.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-5">
                    {Object.entries(preview.counts).map(([label, count]) => (
                      <div key={label} className="rounded-md bg-muted p-2">
                        <p className="text-xs capitalize text-muted-foreground">{label}</p>
                        <p className="text-lg font-semibold">{count}</p>
                      </div>
                    ))}
                  </div>
                  {preview.warnings.length > 0 && (
                    <Alert>
                      <AlertDescription>
                        <p className="mb-2 font-medium">
                          Warnings will block import until resolved.
                        </p>
                        {preview.warnings.map((warning) => (
                          <p key={`${warning.line_number}-${warning.message}`}>
                            Line {warning.line_number}: {warning.message}
                          </p>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}
                  {preview.unclassified.length > 0 && (
                    <div className="rounded-md border border-destructive bg-destructive/10 p-3">
                      <h3 className="font-semibold text-destructive">
                        Unclassified lines ({preview.counts.unclassified})
                      </h3>
                      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                        {preview.unclassified.map((line) => (
                          <button
                            type="button"
                            key={`${line.line_number}-${line.text}`}
                            className="block w-full rounded px-1 py-0.5 text-left hover:bg-destructive/10"
                            onMouseEnter={() =>
                              hoverLayoutPeek({
                                label: line.text,
                                page: line.page,
                                line_number: line.line_number,
                                x0: line.x0,
                                y0: line.y0,
                                x1: line.x1,
                              })
                            }
                            onClick={() =>
                              pinLayoutPeek({
                                label: line.text,
                                page: line.page,
                                line_number: line.line_number,
                                x0: line.x0,
                                y0: line.y0,
                                x1: line.x1,
                              })
                            }
                          >
                            Page {line.page ?? "—"}, line {line.line_number}
                            {line.x0 != null ? ` · x0 ${line.x0.toFixed(0)}` : ""}:{" "}
                            {line.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <ImportLayoutPeek
                    target={layoutPeek}
                    pinned={layoutPeekPinned}
                    onUnpin={() => setLayoutPeekPinned(false)}
                  />
                  <div className="max-h-[min(36rem,calc(100vh-18rem))] space-y-4 overflow-y-auto">
                    {preview.acts.map((act) => (
                      <div key={act.number} className="rounded-md border p-3">
                        <h3 className="font-semibold">Act {act.number}</h3>
                        <div className="mt-2 space-y-3">
                          {act.scenes.map((scene) => (
                            <div key={scene.number} className="border-l-2 pl-3">
                              <h4 className="text-sm font-medium">
                                Scene {scene.number}
                                {scene.title ? ` — ${scene.title}` : ""}
                              </h4>
                              <div className="mt-1 space-y-1">
                                {scene.moments.map((moment, index) => {
                                  const isStage = moment.type === "stage_direction";
                                  const isSongish =
                                    moment.type === "lyric" ||
                                    moment.type === "song_header" ||
                                    moment.type === "song_attribution";
                                  const displayText = moment.title ?? moment.text;
                                  const peekTarget: LayoutPeekTarget = {
                                    label: [
                                      momentTypeLabel(moment.type),
                                      moment.speakers.length
                                        ? moment.speakers.join(", ")
                                        : null,
                                      displayText,
                                    ]
                                      .filter(Boolean)
                                      .join(" · "),
                                    page: moment.page,
                                    line_number: moment.line_number,
                                    x0: moment.x0,
                                    y0: moment.y0,
                                    x1: moment.x1,
                                  };
                                  return (
                                    <div
                                      key={`${moment.line_number}-${index}`}
                                      role="button"
                                      tabIndex={0}
                                      className={cn(
                                        "cursor-default rounded px-2 py-1 text-sm transition-colors hover:bg-muted",
                                        isStage ? "bg-muted/40 italic" : "bg-muted/50",
                                      )}
                                      onMouseEnter={() => hoverLayoutPeek(peekTarget)}
                                      onClick={() => pinLayoutPeek(peekTarget)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          pinLayoutPeek(peekTarget);
                                        }
                                      }}
                                    >
                                      <span
                                        className={cn(
                                          "mr-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                          momentBadgeClass(moment.type),
                                        )}
                                      >
                                        {momentTypeLabel(moment.type)}
                                      </span>
                                      {moment.speakers.length > 0 && (
                                        <span
                                          className={cn(
                                            "mr-1 font-semibold",
                                            isSongish
                                              ? "text-moment-song-foreground"
                                              : "text-primary",
                                          )}
                                        >
                                          {moment.speakers.join(", ")}
                                        </span>
                                      )}
                                      {moment.speakers.length > 0 && (
                                        <span className="text-muted-foreground">: </span>
                                      )}
                                      <span
                                        className={cn(isStage && "text-muted-foreground")}
                                      >
                                        {displayText}
                                      </span>
                                      <span className="ml-2 text-[10px] text-muted-foreground">
                                        {moment.page != null ? `p.${moment.page}` : ""}
                                        {moment.page != null && moment.line_number != null
                                          ? " · "
                                          : ""}
                                        {moment.line_number != null
                                          ? `line ${moment.line_number}`
                                          : ""}
                                        {moment.x0 != null
                                          ? ` · x0 ${moment.x0.toFixed(0)}`
                                          : ""}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Preview sits here</p>
                  <p className="mt-1">
                    Tweak rules on the left, then click{" "}
                    <span className="font-medium text-foreground">Refresh preview</span>{" "}
                    to see the Timeline interpretation beside them.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

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
        <Alert ref={errorRef} variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Format tips</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {showPdfTips && (
            <>
              <li>
                PDFs must contain selectable text. Scanned image PDFs need OCR
                before this importer can read them (OCR is not supported here).
              </li>
              <li>
                Set a start page (and optional end page) on the import profile so
                title pages and back matter can be skipped.
              </li>
              <li>
                Use profile mapping rules to classify columns and line styles into
                acts, scenes, dialogue, and stage directions.
              </li>
            </>
          )}
          {showMdDocxTips && (
            <>
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
            </>
          )}
          {showProfileTip && (
            <li>
              Custom mapping applies your profile rules to this Markdown/DOCX file.
              Refresh preview before importing.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
