import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MomentDetailSheet from "@/components/MomentDetailSheet";
import SceneSummaryStrip from "@/components/SceneSummaryStrip";
import TimelineMomentList from "@/components/TimelineMomentList";
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
  const raw = sessionStorage.getItem(rehearseStorageKey(productionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredRehearseState;
  } catch {
    return null;
  }
}

function saveStoredState(productionId: number, state: StoredRehearseState) {
  sessionStorage.setItem(rehearseStorageKey(productionId), JSON.stringify(state));
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
    return <p className="text-muted-foreground">Loading rehearse view…</p>;
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
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <Link
          to="/productions"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Productions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {scene.productionTitle ?? "Rehearse"}
        </h1>
      </div>

      {scene.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {scene.error}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={scene.selectedActId ?? ""}
            onChange={(e) => scene.handleActChange(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            {effectivePreset === "custom" && <option value="custom">Custom</option>}
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search this scene…"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
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

      <SceneSummaryStrip summary={sceneSummary} />
      <p className="text-sm font-medium text-muted-foreground">{sceneLabel}</p>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {scene.momentsLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading moments…</p>
        ) : displayMoments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{emptyMessage}</p>
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
