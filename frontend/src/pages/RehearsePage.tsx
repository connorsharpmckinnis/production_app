import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MomentDetailSheet from "@/components/MomentDetailSheet";
import SceneSummaryStrip from "@/components/SceneSummaryStrip";
import TimelineMomentList from "@/components/TimelineMomentList";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimelineScene } from "@/hooks/useTimelineScene";
import { isMyMoment } from "@/lib/momentHighlight";
import {
  applyRehearsePreset,
  applyRehearseToggles,
  PRESET_DEFAULT_TOGGLES,
  REHEARSE_PRESET_LABELS,
  togglesMatchPreset,
  type RehearseDisplayToggles,
  type RehearsePresetId,
} from "@/lib/rehearsePresets";
import { deriveSceneSummary } from "@/lib/sceneSummary";
import { formatActLabel } from "@/lib/utils";

const rehearseStorageKey = (productionId: number) => `rehearse-${productionId}`;

interface StoredRehearseState {
  preset: RehearsePresetId;
  toggles: RehearseDisplayToggles;
}

function loadStoredState(productionId: number): StoredRehearseState | null {
  if (typeof window === "undefined") return null;
  const key = rehearseStorageKey(productionId);
  let raw = localStorage.getItem(key);
  if (!raw) {
    const sessionRaw = sessionStorage.getItem(key);
    if (sessionRaw) {
      localStorage.setItem(key, sessionRaw);
      sessionStorage.removeItem(key);
      raw = sessionRaw;
    }
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredRehearseState;
  } catch {
    return null;
  }
}

function saveStoredState(productionId: number, state: StoredRehearseState) {
  localStorage.setItem(rehearseStorageKey(productionId), JSON.stringify(state));
}

export default function RehearsePage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [preset, setPreset] = useState<RehearsePresetId>("scene_run_through");
  const [toggles, setToggles] = useState<RehearseDisplayToggles>(
    PRESET_DEFAULT_TOGGLES.scene_run_through,
  );

  const momentFilters = useMemo(
    () => ({ search: searchQuery || undefined }),
    [searchQuery],
  );

  const scene = useTimelineScene({ productionId, momentFilters });

  useEffect(() => {
    const stored = loadStoredState(productionId);
    if (!stored) return;
    setPreset(stored.preset);
    setToggles(stored.toggles);
  }, [productionId]);

  useEffect(() => {
    saveStoredState(productionId, { preset, toggles });
  }, [productionId, preset, toggles]);

  const effectivePreset: RehearsePresetId = useMemo(() => {
    if (preset === "custom") return "custom";
    return togglesMatchPreset(preset, toggles) ? preset : "custom";
  }, [preset, toggles]);

  const displayMoments = useMemo(() => {
    const basePreset =
      effectivePreset === "custom" ? "scene_run_through" : effectivePreset;
    const presetFiltered = applyRehearsePreset(
      basePreset,
      scene.moments,
      scene.myCharacterIds,
      scene.characters,
    );
    return applyRehearseToggles(presetFiltered, toggles);
  }, [scene.moments, scene.myCharacterIds, scene.characters, effectivePreset, toggles]);

  const sceneSummary = useMemo(
    () => deriveSceneSummary(scene.moments, scene.characters, scene.songs),
    [scene.moments, scene.characters, scene.songs],
  );

  function handlePresetChange(nextPreset: Exclude<RehearsePresetId, "custom">) {
    setPreset(nextPreset);
    setToggles(PRESET_DEFAULT_TOGGLES[nextPreset]);
  }

  function handleToggleChange(field: keyof RehearseDisplayToggles, value: boolean) {
    setToggles((current) => ({ ...current, [field]: value }));
    if (preset !== "custom") {
      const nextToggles = { ...toggles, [field]: value };
      if (!togglesMatchPreset(preset, nextToggles)) {
        setPreset("custom");
      }
    }
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  if (scene.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[50vh] w-full" />
      </div>
    );
  }

  if (scene.acts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Rehearse</h1>
        <p className="text-muted-foreground">No acts found. Import a script first.</p>
      </div>
    );
  }

  const sceneLabel = scene.selectedScene
    ? `Act ${scene.selectedAct?.number} › Scene ${scene.selectedScene.number}${
        scene.selectedScene.title ? ` — ${scene.selectedScene.title}` : ""
      }`
    : "Select a scene";

  const emptyMessage = (() => {
    if (scene.myCharacterIds.length === 0) {
      return "No cast characters — showing full scene.";
    }
    if (
      (effectivePreset === "my_lines" || effectivePreset === "line_cues") &&
      displayMoments.length === 0
    ) {
      return "You have no lines in this scene.";
    }
    return "No moments match these filters.";
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <Link
          to={`/productions/${productionId}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Overview
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {scene.productionTitle ?? "Rehearse"}
        </h1>
      </div>

      {scene.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {scene.error}
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={scene.selectedActId ?? ""}
            onChange={(e) => scene.handleActChange(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {scene.acts.map((act) => (
              <option key={act.id} value={act.id}>
                {formatActLabel(act)}
              </option>
            ))}
          </select>

          <select
            value={scene.selectedSceneId ?? ""}
            onChange={(e) => scene.setSelectedSceneId(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            disabled={!scene.selectedAct?.scenes.length}
          >
            {scene.selectedAct?.scenes.map((item) => (
              <option key={item.id} value={item.id}>
                Scene {item.number}
                {item.title ? `: ${item.title}` : ""}
              </option>
            ))}
          </select>

          <select
            value={effectivePreset === "custom" ? "custom" : effectivePreset}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "custom") return;
              handlePresetChange(value as Exclude<RehearsePresetId, "custom">);
            }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {(
              Object.entries(REHEARSE_PRESET_LABELS) as [
                Exclude<RehearsePresetId, "custom">,
                string,
              ][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            {effectivePreset === "custom" && (
              <option
                value="custom"
                disabled
                title="Adjust toggles to create a custom view"
              >
                Custom
              </option>
            )}
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search this scene…"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Search
          </button>
        </form>
      </div>

      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={toggles.highlightMyLines}
            onChange={(e) => handleToggleChange("highlightMyLines", e.target.checked)}
          />
          Highlight my lines
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={toggles.showStageDirections}
            onChange={(e) => handleToggleChange("showStageDirections", e.target.checked)}
          />
          Show stage directions
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={toggles.showLyricsAndSongs}
            onChange={(e) => handleToggleChange("showLyricsAndSongs", e.target.checked)}
          />
          Show lyrics &amp; songs
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={toggles.showPrepBadges}
            onChange={(e) => handleToggleChange("showPrepBadges", e.target.checked)}
          />
          Show prep badges
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={toggles.blurMyLines}
            onChange={(e) => handleToggleChange("blurMyLines", e.target.checked)}
          />
          Blur my lines
        </label>
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        <SceneSummaryStrip summary={sceneSummary} />
        <p className="text-xs font-medium text-muted-foreground">{sceneLabel}</p>
      </div>

      <div className="flex min-h-[40dvh] flex-1 flex-col overflow-hidden rounded-lg border border-border sm:min-h-0">
        {scene.momentsLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : displayMoments.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <TimelineMomentList
            moments={displayMoments}
            characters={scene.characters}
            selectedMomentId={scene.selectedMomentId}
            onSelectMoment={scene.setSelectedMomentId}
            isHighlighted={(moment) =>
              toggles.highlightMyLines &&
              isMyMoment(moment, scene.myCharacterIds, scene.characters)
            }
            showPrepBadges={toggles.showPrepBadges}
            blurMyLines={toggles.blurMyLines}
            isMyLine={(moment) => isMyMoment(moment, scene.myCharacterIds, scene.characters)}
          />
        )}
      </div>

      <MomentDetailSheet
        productionId={productionId}
        open={scene.selectedMomentId !== null}
        onOpenChange={(open) => {
          if (!open) scene.setSelectedMomentId(null);
        }}
        momentDetail={scene.momentDetail}
        canEdit={scene.canManagePreparation}
        characters={scene.characters}
        songs={scene.songs}
        propsCatalog={scene.propsCatalog}
        microphonesCatalog={scene.microphonesCatalog}
        setPiecesCatalog={scene.setPiecesCatalog}
        cueCategories={scene.cueCategories}
        momentTypes={scene.momentTypes}
        appSettings={scene.appSettings}
        onDetailUpdate={scene.setMomentDetail}
        onChanged={async () => {
          await scene.refreshMomentDetail();
          scene.refreshMomentsList();
        }}
      />
    </div>
  );
}
