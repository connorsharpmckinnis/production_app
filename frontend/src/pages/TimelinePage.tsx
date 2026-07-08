import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { ActSummary, MomentDetailResponse, MomentSummary, SceneSummary } from "@/lib/types";
import { cn, momentTypeLabel, truncate } from "@/lib/utils";

function momentBadgeClass(type: string): string {
  switch (type) {
    case "dialogue":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "stage_direction":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "song_header":
    case "song_attribution":
    case "lyric":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);

  const [acts, setActs] = useState<ActSummary[]>([]);
  const [selectedActId, setSelectedActId] = useState<number | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [moments, setMoments] = useState<MomentSummary[]>([]);
  const [selectedMomentId, setSelectedMomentId] = useState<number | null>(null);
  const [momentDetail, setMomentDetail] = useState<MomentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAct = useMemo(
    () => acts.find((act) => act.id === selectedActId) ?? null,
    [acts, selectedActId],
  );

  const selectedScene: SceneSummary | null = useMemo(() => {
    if (!selectedAct || selectedSceneId === null) return null;
    return selectedAct.scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  }, [selectedAct, selectedSceneId]);

  useEffect(() => {
    void api
      .listActs(productionId)
      .then((data) => {
        setActs(data);
        if (data.length > 0) {
          const firstAct = data[0];
          setSelectedActId(firstAct.id);
          if (firstAct.scenes.length > 0) {
            setSelectedSceneId(firstAct.scenes[0].id);
          }
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load timeline");
      })
      .finally(() => setLoading(false));
  }, [productionId]);

  useEffect(() => {
    if (selectedSceneId === null) {
      setMoments([]);
      return;
    }

    setMomentsLoading(true);
    setSelectedMomentId(null);
    setMomentDetail(null);

    void api
      .listMoments(productionId, selectedSceneId)
      .then(setMoments)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load moments");
      })
      .finally(() => setMomentsLoading(false));
  }, [productionId, selectedSceneId]);

  useEffect(() => {
    if (selectedMomentId === null) {
      setMomentDetail(null);
      return;
    }

    void api
      .getMoment(productionId, selectedMomentId)
      .then(setMomentDetail)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load moment detail");
      });
  }, [productionId, selectedMomentId]);

  function handleActChange(actId: number) {
    setSelectedActId(actId);
    const act = acts.find((a) => a.id === actId);
    setSelectedSceneId(act?.scenes[0]?.id ?? null);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading timeline…</p>;
  }

  if (acts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-muted-foreground">No acts found. Import a script first.</p>
        <Link
          to="/productions"
          className="text-sm text-primary hover:underline"
        >
          Back to productions
        </Link>
      </div>
    );
  }

  const sceneLabel = selectedScene
    ? `Act ${selectedAct?.number} › Scene ${selectedScene.number}${
        selectedScene.title ? ` — ${selectedScene.title}` : ""
      }`
    : "Select a scene";

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/productions"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Productions
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Timeline Review</h1>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={selectedActId ?? ""}
          onChange={(e) => handleActChange(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {acts.map((act) => (
            <option key={act.id} value={act.id}>
              Act {act.number}{act.title ? `: ${act.title}` : ""}
            </option>
          ))}
        </select>

        <select
          value={selectedSceneId ?? ""}
          onChange={(e) => setSelectedSceneId(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={!selectedAct?.scenes.length}
        >
          {selectedAct?.scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              Scene {scene.number}{scene.title ? `: ${scene.title}` : ""}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm font-medium text-muted-foreground">{sceneLabel}</p>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
          {momentsLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading moments…</p>
          ) : moments.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No moments in this scene.</p>
          ) : (
            <ul className="h-full overflow-y-auto divide-y divide-border">
              {moments.map((moment) => (
                <li key={moment.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedMomentId(moment.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50",
                      selectedMomentId === moment.id && "bg-muted",
                    )}
                  >
                    <span className="w-8 shrink-0 font-mono text-muted-foreground">
                      {moment.sequence_number}
                    </span>
                    <span className="min-w-0 flex-1">{truncate(moment.original_text)}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        momentBadgeClass(moment.moment_type),
                      )}
                    >
                      {momentTypeLabel(moment.moment_type)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {momentDetail && (
          <aside className="hidden w-96 shrink-0 overflow-y-auto rounded-lg border border-border bg-card p-4 lg:block">
            <MomentDetailPanel detail={momentDetail} onClose={() => setSelectedMomentId(null)} />
          </aside>
        )}
      </div>

      {momentDetail && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSelectedMomentId(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-lg border border-border bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <MomentDetailPanel detail={momentDetail} onClose={() => setSelectedMomentId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function MomentDetailPanel({
  detail,
  onClose,
}: {
  detail: MomentDetailResponse;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Moment #{detail.sequence_number}</p>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              momentBadgeClass(detail.moment_type),
            )}
          >
            {momentTypeLabel(detail.moment_type)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      <div>
        <h3 className="text-sm font-medium">Original text</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm">{detail.original_text}</p>
      </div>

      {detail.parsed_text && (
        <div>
          <h3 className="text-sm font-medium">Parsed text</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {detail.parsed_text}
          </p>
        </div>
      )}

      {detail.stage_direction && (
        <div>
          <h3 className="text-sm font-medium">Stage direction</h3>
          <p className="mt-1 text-sm">{detail.stage_direction}</p>
        </div>
      )}

      {detail.dialogue.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Dialogue</h3>
          <ul className="mt-2 space-y-2">
            {detail.dialogue.map((line, index) => (
              <li key={index} className="text-sm">
                <span className="font-medium">{line.character_name}:</span>{" "}
                {line.dialogue_text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.song_title && (
        <div>
          <h3 className="text-sm font-medium">Song</h3>
          <p className="mt-1 text-sm">{detail.song_title}</p>
        </div>
      )}
    </div>
  );
}
