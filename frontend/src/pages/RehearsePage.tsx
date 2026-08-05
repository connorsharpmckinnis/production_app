import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MomentDetailSheet from "@/components/MomentDetailSheet";
import SceneMultiSelect from "@/components/SceneMultiSelect";
import TimelineMomentList, { type TimelineSection } from "@/components/TimelineMomentList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimelineScene } from "@/hooks/useTimelineScene";
import { isMyMoment, isMySpokenLine } from "@/lib/momentHighlight";
import {
  applyRehearsePreset,
  applyRehearseToggles,
  PRESET_DEFAULT_TOGGLES,
  REHEARSE_PRESET_LABELS,
  togglesMatchPreset,
  type RehearseDisplayToggles,
  type RehearsePresetId,
} from "@/lib/rehearsePresets";

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

  const displaySections: TimelineSection[] = useMemo(() => {
    const basePreset =
      effectivePreset === "custom" ? "scene_run_through" : effectivePreset;

    return scene.momentSections
      .map((section) => {
        const presetFiltered = applyRehearsePreset(
          basePreset,
          section.moments,
          scene.myCharacterIds,
          scene.characters,
        );
        return {
          ...section,
          summary: section.summary,
          moments: applyRehearseToggles(presetFiltered, toggles),
        };
      })
      .filter((section) => section.moments.length > 0);
  }, [
    scene.momentSections,
    scene.myCharacterIds,
    scene.characters,
    effectivePreset,
    toggles,
  ]);

  const displayMomentCount = useMemo(
    () => displaySections.reduce((sum, section) => sum + section.moments.length, 0),
    [displaySections],
  );

  function handlePresetChange(nextPreset: Exclude<RehearsePresetId, "custom">) {
    setPreset(nextPreset);
    setToggles({
      ...PRESET_DEFAULT_TOGGLES[nextPreset],
      // Keep blur preference when switching presets — it is orthogonal to filtering.
      blurMyLines: toggles.blurMyLines,
    });
  }

  function handleToggleChange(field: keyof RehearseDisplayToggles, value: boolean) {
    const nextToggles = { ...toggles, [field]: value };
    setToggles(nextToggles);
    if (preset !== "custom" && field !== "blurMyLines") {
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

  const emptyMessage = (() => {
    if (scene.selectedSceneIds.length === 0) {
      return "Choose one or more scenes to rehearse.";
    }
    if (scene.myCharacterIds.length === 0) {
      return "No cast characters — showing full selection.";
    }
    if (
      (effectivePreset === "my_lines" || effectivePreset === "line_cues") &&
      displayMomentCount === 0
    ) {
      return "You have no lines in the selected scenes.";
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
        <Alert variant="destructive">
          <AlertDescription>{scene.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex shrink-0 flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          <SceneMultiSelect
            acts={scene.acts}
            selectedSceneIds={scene.selectedSceneIds}
            onChange={scene.setSelectedSceneIds}
          />

          <Select
            value={effectivePreset === "custom" ? "custom" : effectivePreset}
            onValueChange={(value) => {
              if (value === "custom") return;
              handlePresetChange(value as Exclude<RehearsePresetId, "custom">);
            }}
          >
            <SelectTrigger className="w-fit" aria-label="Rehearsal preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(REHEARSE_PRESET_LABELS) as [
                  Exclude<RehearsePresetId, "custom">,
                  string,
                ][]
              ).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
              {effectivePreset === "custom" && (
                <SelectItem
                  value="custom"
                  disabled
                  title="Adjust toggles to create a custom view"
                >
                  Custom
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search timeline…"
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm">
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox
            checked={toggles.highlightMyLines}
            onCheckedChange={(value) => handleToggleChange("highlightMyLines", value === true)}
          />
          Highlight my lines
        </Label>
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox
            checked={toggles.showStageDirections}
            onCheckedChange={(value) =>
              handleToggleChange("showStageDirections", value === true)
            }
          />
          Show stage directions
        </Label>
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox
            checked={toggles.showLyricsAndSongs}
            onCheckedChange={(value) =>
              handleToggleChange("showLyricsAndSongs", value === true)
            }
          />
          Show lyrics &amp; songs
        </Label>
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox
            checked={toggles.showPrepBadges}
            onCheckedChange={(value) => handleToggleChange("showPrepBadges", value === true)}
          />
          Show prep badges
        </Label>
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox
            checked={toggles.blurMyLines}
            onCheckedChange={(value) => handleToggleChange("blurMyLines", value === true)}
          />
          Blur my lines
        </Label>
      </div>

      <p className="shrink-0 text-xs font-medium text-muted-foreground">{scene.selectionLabel}</p>

      <div className="flex min-h-[40dvh] flex-1 flex-col overflow-hidden rounded-lg border border-border sm:min-h-0">
        {scene.momentsLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : displayMomentCount === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <TimelineMomentList
            sections={displaySections}
            characters={scene.characters}
            selectedMomentId={scene.selectedMomentId}
            onSelectMoment={scene.setSelectedMomentId}
            isHighlighted={(moment) =>
              toggles.highlightMyLines &&
              isMyMoment(moment, scene.myCharacterIds, scene.characters)
            }
            showPrepBadges={toggles.showPrepBadges}
            showSequenceNumbers={false}
            showTypeBadge={false}
            blurMyLines={toggles.blurMyLines}
            isMyLine={(moment) => isMySpokenLine(moment, scene.myCharacterIds)}
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
        sceneId={
          scene.selectedMomentId !== null
            ? scene.sceneIdForMoment(scene.selectedMomentId)
            : null
        }
        canEdit={scene.canManagePreparation}
        characters={scene.characters}
        castableUsers={scene.castableUsers}
        songs={scene.songs}
        propsCatalog={scene.propsCatalog}
        setPiecesCatalog={scene.setPiecesCatalog}
        costumesCatalog={scene.costumesCatalog}
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
