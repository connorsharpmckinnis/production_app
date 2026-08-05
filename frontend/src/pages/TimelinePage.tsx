import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import MomentDetailSheet from "@/components/MomentDetailSheet";
import SceneMultiSelect from "@/components/SceneMultiSelect";
import TimelineMomentList from "@/components/TimelineMomentList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useIsMediumScreen } from "@/hooks/useIsMediumScreen";
import { useTimelineScene } from "@/hooks/useTimelineScene";
import { api, formatApiError } from "@/lib/api";
import { isHighlightedMoment } from "@/lib/momentHighlight";
import {
  isPendingSceneReady,
  parseTimelineDeepLink,
  pendingFromDeepLink,
  resolvePendingMomentId,
  resolveSceneIdByNumbers,
  type PendingDeepLink,
} from "@/lib/timelineDeepLinks";
import type {
  CharacterDetailResponse,
  MomentDetailResponse,
  MomentSummary,
  MomentTypeResponse,
} from "@/lib/types";
import { momentTypeLabel, sortByName, cn } from "@/lib/utils";

type CharacterFilterValue = "all" | "mine" | string;
type GroupFilterValue = "all" | string;
type ResourceFilterValue = "all" | string;

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const isMediumScreen = useIsMediumScreen();
  const pendingDeepLinkRef = useRef<PendingDeepLink | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [costumeOnly, setCostumeOnly] = useState(false);
  const [entranceOnly, setEntranceOnly] = useState(false);
  const [exitOnly, setExitOnly] = useState(false);
  const [blockingOnly, setBlockingOnly] = useState(false);
  const [characterFilter, setCharacterFilter] = useState<CharacterFilterValue>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilterValue>("all");
  const [blockingCharacterFilter, setBlockingCharacterFilter] =
    useState<ResourceFilterValue>("all");
  const [songFilter, setSongFilter] = useState<ResourceFilterValue>("all");
  const [propFilter, setPropFilter] = useState<ResourceFilterValue>("all");
  const [cueCategoryFilter, setCueCategoryFilter] = useState<ResourceFilterValue>("all");
  const [setPieceFilter, setSetPieceFilter] = useState<ResourceFilterValue>("all");

  const [editTimeline, setEditTimeline] = useState(false);
  const [showSequenceNumbers, setShowSequenceNumbers] = useState(false);
  const [showPrepBadges, setShowPrepBadges] = useState(false);

  const [insertAfterSequence, setInsertAfterSequence] = useState<number | null>(null);
  const [insertSceneId, setInsertSceneId] = useState<number | null>(null);
  const [insertAtEnd, setInsertAtEnd] = useState(false);
  const [insertTypeId, setInsertTypeId] = useState("");
  const [insertText, setInsertText] = useState("");
  const [insertCharacterId, setInsertCharacterId] = useState("");
  const [structuralSaving, setStructuralSaving] = useState(false);
  const [defaultInsertTypeReady, setDefaultInsertTypeReady] = useState(false);

  const filterInput = useMemo(
    () => ({
      characterFilter,
      groupFilter,
      searchQuery,
      costumeOnly,
      entranceOnly,
      exitOnly,
      blockingOnly,
      blockingCharacterFilter,
      songFilter,
      propFilter,
      cueCategoryFilter,
      setPieceFilter,
    }),
    [
      characterFilter,
      groupFilter,
      searchQuery,
      costumeOnly,
      entranceOnly,
      exitOnly,
      blockingOnly,
      blockingCharacterFilter,
      songFilter,
      propFilter,
      cueCategoryFilter,
      setPieceFilter,
    ],
  );

  const scene = useTimelineScene({ productionId, filterInput });

  const myCharacterIds = scene.myCharacterIds;
  const groups = scene.groups;
  const canManagePreparation = scene.canManagePreparation;
  const showStructuralControls = canManagePreparation && editTimeline;

  useEffect(() => {
    if (!canManagePreparation && editTimeline) {
      setEditTimeline(false);
    }
  }, [canManagePreparation, editTimeline]);

  useEffect(() => {
    if (defaultInsertTypeReady || scene.momentTypes.length === 0) return;
    const dialogue = scene.momentTypes.find((type) => type.name === "dialogue");
    if (dialogue) {
      setInsertTypeId(String(dialogue.id));
    }
    setDefaultInsertTypeReady(true);
  }, [scene.momentTypes, defaultInsertTypeReady]);

  useEffect(() => {
    if (scene.loading || scene.acts.length === 0) return;
    const link = parseTimelineDeepLink(searchParams);
    if (!link) return;

    let targetSceneId: number | null = null;
    if (link.mode === "human") {
      targetSceneId = resolveSceneIdByNumbers(
        scene.acts,
        link.actNumber,
        link.sceneNumber,
      );
      if (targetSceneId == null) {
        setSearchParams({}, { replace: true });
        return;
      }
      if (!scene.selectSceneById(targetSceneId)) {
        setSearchParams({}, { replace: true });
        return;
      }
    } else if (link.sceneId != null) {
      targetSceneId = link.sceneId;
      if (!scene.selectSceneById(link.sceneId)) {
        setSearchParams({}, { replace: true });
        return;
      }
    }

    pendingDeepLinkRef.current = {
      sceneId: targetSceneId,
      moment: pendingFromDeepLink(link),
    };
    // Keep query params until the moment is resolved so a catalog re-fetch
    // (Strict Mode / auth) can re-apply the link if selection was reset.
    // Intentionally omits selectSceneById identity; acts + loading gate freshness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.loading, scene.acts, searchParams, setSearchParams]);

  useEffect(() => {
    const pending = pendingDeepLinkRef.current;
    if (pending === null || scene.momentsLoading) return;
    if (!isPendingSceneReady(pending.sceneId, scene.selectedSceneIds)) return;

    const momentId = resolvePendingMomentId(scene.moments, pending.moment);
    if (momentId != null) {
      scene.setSelectedMomentId(momentId);
      pendingDeepLinkRef.current = null;
      setSearchParams({}, { replace: true });
      return;
    }

    // Scene is ready but the target moment is missing — drop the pending link.
    pendingDeepLinkRef.current = null;
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.moments, scene.momentsLoading, scene.selectedSceneIds, setSearchParams]);

  const highlightCharacterIds = useMemo(() => {
    if (groupFilter !== "all") {
      const group = groups.find((item) => item.id === Number(groupFilter));
      return group?.character_ids;
    }
    if (characterFilter === "all") return undefined;
    if (characterFilter === "mine") return myCharacterIds;
    return [Number(characterFilter)];
  }, [characterFilter, groupFilter, groups, myCharacterIds]);

  const advancedFilterCount = [
    groupFilter !== "all",
    costumeOnly,
    entranceOnly,
    exitOnly,
    blockingOnly,
    blockingCharacterFilter !== "all",
    songFilter !== "all",
    propFilter !== "all",
    cueCategoryFilter !== "all",
    setPieceFilter !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters =
    searchQuery !== "" ||
    characterFilter !== "all" ||
    advancedFilterCount > 0;

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onDismiss: () => void }[] = [];

    if (searchQuery) {
      chips.push({
        key: "search",
        label: `Search: “${searchQuery}”`,
        onDismiss: () => {
          setSearchInput("");
          setSearchQuery("");
        },
      });
    }

    if (characterFilter === "mine") {
      chips.push({
        key: "character-mine",
        label: "My characters",
        onDismiss: () => setCharacterFilter("all"),
      });
    } else if (characterFilter !== "all") {
      const character = scene.characters.find((item) => String(item.id) === characterFilter);
      chips.push({
        key: `character-${characterFilter}`,
        label: character?.name ?? "Character",
        onDismiss: () => setCharacterFilter("all"),
      });
    }

    if (groupFilter !== "all") {
      const group = groups.find((item) => item.id === Number(groupFilter));
      chips.push({
        key: `group-${groupFilter}`,
        label: group?.name ?? "Group",
        onDismiss: () => setGroupFilter("all"),
      });
    }

    if (costumeOnly) {
      chips.push({
        key: "costume",
        label: "Costume moments",
        onDismiss: () => setCostumeOnly(false),
      });
    }
    if (entranceOnly) {
      chips.push({
        key: "entrance",
        label: "Entrance moments",
        onDismiss: () => setEntranceOnly(false),
      });
    }
    if (exitOnly) {
      chips.push({
        key: "exit",
        label: "Exit moments",
        onDismiss: () => setExitOnly(false),
      });
    }
    if (blockingOnly) {
      chips.push({
        key: "blocking",
        label: "Blocking moments",
        onDismiss: () => setBlockingOnly(false),
      });
    }

    if (blockingCharacterFilter !== "all") {
      const character = scene.characters.find(
        (item) => String(item.id) === blockingCharacterFilter,
      );
      chips.push({
        key: `blocking-character-${blockingCharacterFilter}`,
        label: `Blocking: ${character?.name ?? "Character"}`,
        onDismiss: () => setBlockingCharacterFilter("all"),
      });
    }

    if (songFilter !== "all") {
      const song = scene.songs.find((item) => String(item.id) === songFilter);
      chips.push({
        key: `song-${songFilter}`,
        label: song?.title ?? "Song",
        onDismiss: () => setSongFilter("all"),
      });
    }

    if (propFilter !== "all") {
      const prop = scene.propsCatalog.find((item) => String(item.id) === propFilter);
      chips.push({
        key: `prop-${propFilter}`,
        label: prop?.name ?? "Prop",
        onDismiss: () => setPropFilter("all"),
      });
    }

    if (cueCategoryFilter !== "all") {
      const category = scene.cueCategories.find(
        (item) => String(item.id) === cueCategoryFilter,
      );
      chips.push({
        key: `cue-${cueCategoryFilter}`,
        label: category?.name ?? "Cue category",
        onDismiss: () => setCueCategoryFilter("all"),
      });
    }

    if (setPieceFilter !== "all") {
      const piece = scene.setPiecesCatalog.find(
        (item) => String(item.id) === setPieceFilter,
      );
      chips.push({
        key: `set-piece-${setPieceFilter}`,
        label: piece?.name ?? "Set piece",
        onDismiss: () => setSetPieceFilter("all"),
      });
    }

    return chips;
  }, [
    searchQuery,
    characterFilter,
    groupFilter,
    costumeOnly,
    entranceOnly,
    exitOnly,
    blockingOnly,
    blockingCharacterFilter,
    songFilter,
    propFilter,
    cueCategoryFilter,
    setPieceFilter,
    scene.characters,
    scene.songs,
    scene.propsCatalog,
    scene.cueCategories,
    scene.setPiecesCatalog,
    groups,
  ]);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  function clearAllFilters() {
    setSearchInput("");
    setSearchQuery("");
    setCharacterFilter("all");
    setGroupFilter("all");
    setCostumeOnly(false);
    setEntranceOnly(false);
    setExitOnly(false);
    setBlockingOnly(false);
    setBlockingCharacterFilter("all");
    setSongFilter("all");
    setPropFilter("all");
    setCueCategoryFilter("all");
    setSetPieceFilter("all");
  }

  function resetInsertForm() {
    setInsertAfterSequence(null);
    setInsertSceneId(null);
    setInsertAtEnd(false);
    const dialogue = scene.momentTypes.find((type) => type.name === "dialogue");
    setInsertTypeId(dialogue ? String(dialogue.id) : "");
    setInsertText("");
    setInsertCharacterId("");
  }

  const insertTypeName = scene.momentTypes.find((type) => String(type.id) === insertTypeId)
    ?.name;

  async function handleInsertMoment(event: React.FormEvent) {
    event.preventDefault();
    const targetSceneId = insertAtEnd ? scene.selectedSceneId : insertSceneId;
    if (targetSceneId === null || !insertTypeId || !insertText.trim()) return;

    if (insertTypeName === "dialogue" && !insertCharacterId) {
      toast.error("Select a speaking character for dialogue moments.");
      return;
    }

    const sectionMoments =
      scene.momentSections.find((section) => section.sceneId === targetSceneId)?.moments ?? [];

    const sequenceNumber = insertAtEnd
      ? (sectionMoments[sectionMoments.length - 1]?.sequence_number ?? 0) + 1
      : (insertAfterSequence ?? 0) + 1;

    setStructuralSaving(true);
    try {
      const created = await api.createMoment(productionId, targetSceneId, {
        sequence_number: sequenceNumber,
        moment_type_id: Number(insertTypeId),
        original_text: insertText.trim(),
        character_id: insertCharacterId ? Number(insertCharacterId) : null,
      });
      resetInsertForm();
      scene.setSelectedMomentId(created.id);
      scene.setMomentDetail(created);
      scene.refreshMomentsList();
      toast.success("Moment inserted");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to insert moment"));
    } finally {
      setStructuralSaving(false);
    }
  }

  async function handleDeleteMoment(momentId: number) {
    const ok = await confirm({
      title: "Delete this moment?",
      description: "All attached props, cues, notes, and other data on this moment will be removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setStructuralSaving(true);
    try {
      await api.deleteMoment(productionId, momentId);
      if (scene.selectedMomentId === momentId) {
        scene.setSelectedMomentId(null);
        scene.setMomentDetail(null);
      }
      scene.refreshMomentsList();
      toast.success("Moment deleted");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete moment"));
    } finally {
      setStructuralSaving(false);
    }
  }

  async function handleMoveMoment(moment: MomentSummary, direction: "up" | "down") {
    const targetSequence =
      direction === "up" ? moment.sequence_number - 1 : moment.sequence_number + 1;
    if (targetSequence < 1) return;

    setStructuralSaving(true);
    try {
      const updated = await api.reorderMoment(productionId, moment.id, targetSequence);
      if (scene.selectedMomentId === moment.id) {
        scene.setMomentDetail(updated);
      }
      scene.refreshMomentsList();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to reorder moment"));
    } finally {
      setStructuralSaving(false);
    }
  }

  if (scene.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-[50vh] w-full" />
      </div>
    );
  }

  if (scene.acts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <EmptyState
          title="No script imported yet"
          description="Import a script to build the timeline."
          actionLabel={isAdmin ? "Import script" : undefined}
          actionTo={isAdmin ? `/productions/${productionId}/import` : undefined}
        />
        <Link to="/productions" className="text-sm text-primary hover:underline">
          Back to productions
        </Link>
      </div>
    );
  }

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
          {scene.productionTitle ?? "Timeline"}
        </h1>
      </div>

      {scene.error && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{scene.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex shrink-0 flex-col gap-1.5">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-1.5">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search timeline…"
            title="Filters combine with AND — all selected conditions must match."
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
          {hasActiveFilters && (
            <Button type="button" variant="outline" onClick={clearAllFilters}>
              Clear filters
            </Button>
          )}
        </form>

        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          <SceneMultiSelect
            acts={scene.acts}
            selectedSceneIds={scene.selectedSceneIds}
            onChange={scene.setSelectedSceneIds}
          />

          <Select
            value={characterFilter}
            onValueChange={(value) => {
              setCharacterFilter(value as CharacterFilterValue);
              setGroupFilter("all");
            }}
            disabled={groupFilter !== "all"}
          >
            <SelectTrigger className="w-fit" aria-label="Filter by character">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All characters</SelectItem>
              {myCharacterIds.length > 0 && (
                <SelectItem value="mine">My characters</SelectItem>
              )}
              {scene.characters.map((character) => (
                <SelectItem key={character.id} value={String(character.id)}>
                  {character.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" onClick={() => setAdvancedOpen((open) => !open)}>
            Advanced filters
            {advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {canManagePreparation && (
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox
                checked={editTimeline}
                onCheckedChange={(value) => setEditTimeline(value === true)}
              />
              Edit Timeline
            </Label>
          )}
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={showSequenceNumbers}
              onCheckedChange={(value) => setShowSequenceNumbers(value === true)}
            />
            Moment numbers
          </Label>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={showPrepBadges}
              onCheckedChange={(value) => setShowPrepBadges(value === true)}
            />
            Prep badges
          </Label>
        </div>

        {advancedOpen && isMediumScreen && (
          <AdvancedFiltersPanel
            canManagePreparation={canManagePreparation}
            groups={groups}
            groupFilter={groupFilter}
            setGroupFilter={setGroupFilter}
            setCharacterFilter={setCharacterFilter}
            costumeOnly={costumeOnly}
            setCostumeOnly={setCostumeOnly}
            entranceOnly={entranceOnly}
            setEntranceOnly={setEntranceOnly}
            exitOnly={exitOnly}
            setExitOnly={setExitOnly}
            blockingOnly={blockingOnly}
            setBlockingOnly={setBlockingOnly}
            blockingCharacterFilter={blockingCharacterFilter}
            setBlockingCharacterFilter={setBlockingCharacterFilter}
            songFilter={songFilter}
            setSongFilter={setSongFilter}
            propFilter={propFilter}
            setPropFilter={setPropFilter}
            cueCategoryFilter={cueCategoryFilter}
            setCueCategoryFilter={setCueCategoryFilter}
            setPieceFilter={setPieceFilter}
            setSetPieceFilter={setSetPieceFilter}
            characters={scene.characters}
            songs={scene.songs}
            propsCatalog={scene.propsCatalog}
            cueCategories={scene.cueCategories}
            setPiecesCatalog={scene.setPiecesCatalog}
          />
        )}

        <Sheet
          open={advancedOpen && !isMediumScreen}
          onOpenChange={setAdvancedOpen}
        >
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Advanced filters</SheetTitle>
            </SheetHeader>
            <AdvancedFiltersPanel
              canManagePreparation={canManagePreparation}
              groups={groups}
              groupFilter={groupFilter}
              setGroupFilter={setGroupFilter}
              setCharacterFilter={setCharacterFilter}
              costumeOnly={costumeOnly}
              setCostumeOnly={setCostumeOnly}
              entranceOnly={entranceOnly}
              setEntranceOnly={setEntranceOnly}
              exitOnly={exitOnly}
              setExitOnly={setExitOnly}
              blockingOnly={blockingOnly}
              setBlockingOnly={setBlockingOnly}
              blockingCharacterFilter={blockingCharacterFilter}
              setBlockingCharacterFilter={setBlockingCharacterFilter}
              songFilter={songFilter}
              setSongFilter={setSongFilter}
              propFilter={propFilter}
              setPropFilter={setPropFilter}
              cueCategoryFilter={cueCategoryFilter}
              setCueCategoryFilter={setCueCategoryFilter}
              setPieceFilter={setPieceFilter}
              setSetPieceFilter={setSetPieceFilter}
              characters={scene.characters}
              songs={scene.songs}
              propsCatalog={scene.propsCatalog}
              cueCategories={scene.cueCategories}
              setPiecesCatalog={scene.setPiecesCatalog}
              className="border-0 bg-transparent p-0"
            />
          </SheetContent>
        </Sheet>

        {hasActiveFilters && activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
                {chip.label}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-5 hover:bg-transparent"
                  onClick={chip.onDismiss}
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X className="size-3" />
                </Button>
              </Badge>
            ))}
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={clearAllFilters}
              className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      <p className="shrink-0 text-xs font-medium text-muted-foreground">{scene.selectionLabel}</p>

      <div className="flex min-h-[40dvh] flex-1 flex-col overflow-hidden rounded-lg border border-border sm:min-h-0">
        {scene.momentsLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : scene.moments.length === 0 ? (
          <div className="p-3">
            <EmptyState
              title={
                scene.selectedSceneIds.length === 0
                  ? "No scenes selected"
                  : hasActiveFilters
                    ? "No moments match these filters"
                    : "No moments in the selected scenes"
              }
              description={
                scene.selectedSceneIds.length === 0
                  ? "Choose one or more scenes to display."
                  : hasActiveFilters
                    ? "Try clearing filters or choosing different scenes."
                    : "Use Edit Timeline to insert moments, or import a script if this production is empty."
              }
              actionLabel={hasActiveFilters ? "Clear filters" : undefined}
              onAction={hasActiveFilters ? clearAllFilters : undefined}
            />
          </div>
        ) : (
          <TimelineMomentList
            sections={scene.momentSections}
            characters={scene.characters}
            selectedMomentId={scene.selectedMomentId}
            onSelectMoment={scene.setSelectedMomentId}
            isHighlighted={(moment) =>
              isHighlightedMoment(moment, highlightCharacterIds, scene.characters)
            }
            showPrepBadges={showPrepBadges}
            showSequenceNumbers={showSequenceNumbers}
            showTypeBadge={showStructuralControls}
            showStructuralControls={showStructuralControls}
            structuralSaving={structuralSaving}
            onMoveUp={(moment) => void handleMoveMoment(moment, "up")}
            onMoveDown={(moment) => void handleMoveMoment(moment, "down")}
            onInsertAfter={(sequenceNumber, targetSceneId) => {
              resetInsertForm();
              setInsertAfterSequence(sequenceNumber);
              setInsertSceneId(targetSceneId);
            }}
            onDelete={(momentId) => void handleDeleteMoment(momentId)}
            insertAfterSequence={insertAfterSequence}
            insertSceneId={insertSceneId}
            insertFormSlot={() => (
              <InsertMomentForm
                momentTypes={scene.momentTypes}
                characters={scene.characters}
                insertTypeId={insertTypeId}
                insertText={insertText}
                insertCharacterId={insertCharacterId}
                insertTypeName={insertTypeName}
                saving={structuralSaving}
                onTypeChange={setInsertTypeId}
                onTextChange={setInsertText}
                onCharacterChange={setInsertCharacterId}
                onSubmit={handleInsertMoment}
                onCancel={resetInsertForm}
              />
            )}
            footerSlot={
              showStructuralControls && scene.selectedSceneId !== null ? (
                <li className="border-t border-border px-3 py-2">
                  {insertAtEnd ? (
                    <InsertMomentForm
                      momentTypes={scene.momentTypes}
                      characters={scene.characters}
                      insertTypeId={insertTypeId}
                      insertText={insertText}
                      insertCharacterId={insertCharacterId}
                      insertTypeName={insertTypeName}
                      saving={structuralSaving}
                      onTypeChange={setInsertTypeId}
                      onTextChange={setInsertText}
                      onCharacterChange={setInsertCharacterId}
                      onSubmit={handleInsertMoment}
                      onCancel={resetInsertForm}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      disabled={structuralSaving}
                      onClick={() => {
                        resetInsertForm();
                        setInsertAtEnd(true);
                        setInsertSceneId(scene.selectedSceneId);
                      }}
                      className="h-auto px-0"
                    >
                      + Insert moment at end of scene
                    </Button>
                  )}
                </li>
              ) : undefined
            }
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
        canEdit={canManagePreparation}
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

function AdvancedFiltersPanel({
  canManagePreparation,
  groups,
  groupFilter,
  setGroupFilter,
  setCharacterFilter,
  costumeOnly,
  setCostumeOnly,
  entranceOnly,
  setEntranceOnly,
  exitOnly,
  setExitOnly,
  blockingOnly,
  setBlockingOnly,
  blockingCharacterFilter,
  setBlockingCharacterFilter,
  songFilter,
  setSongFilter,
  propFilter,
  setPropFilter,
  cueCategoryFilter,
  setCueCategoryFilter,
  setPieceFilter,
  setSetPieceFilter,
  characters,
  songs,
  propsCatalog,
  cueCategories,
  setPiecesCatalog,
  className,
}: {
  canManagePreparation: boolean;
  groups: { id: number; name: string }[];
  groupFilter: GroupFilterValue;
  setGroupFilter: (value: GroupFilterValue) => void;
  setCharacterFilter: (value: CharacterFilterValue) => void;
  costumeOnly: boolean;
  setCostumeOnly: (value: boolean) => void;
  entranceOnly: boolean;
  setEntranceOnly: (value: boolean) => void;
  exitOnly: boolean;
  setExitOnly: (value: boolean) => void;
  blockingOnly: boolean;
  setBlockingOnly: (value: boolean) => void;
  blockingCharacterFilter: ResourceFilterValue;
  setBlockingCharacterFilter: (value: ResourceFilterValue) => void;
  songFilter: ResourceFilterValue;
  setSongFilter: (value: ResourceFilterValue) => void;
  propFilter: ResourceFilterValue;
  setPropFilter: (value: ResourceFilterValue) => void;
  cueCategoryFilter: ResourceFilterValue;
  setCueCategoryFilter: (value: ResourceFilterValue) => void;
  setPieceFilter: ResourceFilterValue;
  setSetPieceFilter: (value: ResourceFilterValue) => void;
  characters: CharacterDetailResponse[];
  songs: { id: number; title: string }[];
  propsCatalog: { id: number; name: string }[];
  cueCategories: { id: number; name: string }[];
  setPiecesCatalog: { id: number; name: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-2 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {canManagePreparation && groups.length > 0 && (
        <Select
          value={groupFilter}
          onValueChange={(value) => {
            setGroupFilter(value as GroupFilterValue);
            setCharacterFilter("all");
          }}
        >
          <SelectTrigger className="w-fit" aria-label="Filter by group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={String(group.id)}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {canManagePreparation && (
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={costumeOnly}
            onCheckedChange={(value) => setCostumeOnly(value === true)}
          />
          Costume moments only
        </Label>
      )}

      {canManagePreparation && (
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={entranceOnly}
            onCheckedChange={(value) => setEntranceOnly(value === true)}
          />
          Entrance moments only
        </Label>
      )}

      {canManagePreparation && (
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox checked={exitOnly} onCheckedChange={(value) => setExitOnly(value === true)} />
          Exit moments only
        </Label>
      )}

      {canManagePreparation && (
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={blockingOnly}
            onCheckedChange={(value) => setBlockingOnly(value === true)}
          />
          Blocking moments only
        </Label>
      )}

      {canManagePreparation && (
        <Select
          value={blockingCharacterFilter}
          onValueChange={(value) => setBlockingCharacterFilter(value as ResourceFilterValue)}
        >
          <SelectTrigger className="w-fit" aria-label="Filter by blocking character">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All blocking characters</SelectItem>
            {characters.map((character) => (
              <SelectItem key={character.id} value={String(character.id)}>
                Blocking: {character.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {songs.length > 0 && (
        <Select
          value={songFilter}
          onValueChange={(value) => setSongFilter(value as ResourceFilterValue)}
        >
          <SelectTrigger className="w-fit" aria-label="Filter by song">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All songs</SelectItem>
            {songs.map((song) => (
              <SelectItem key={song.id} value={String(song.id)}>
                {song.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {canManagePreparation && propsCatalog.length > 0 && (
        <Select
          value={propFilter}
          onValueChange={(value) => setPropFilter(value as ResourceFilterValue)}
        >
          <SelectTrigger className="w-fit" aria-label="Filter by prop">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All props</SelectItem>
            {propsCatalog.map((prop) => (
              <SelectItem key={prop.id} value={String(prop.id)}>
                {prop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {canManagePreparation && cueCategories.length > 0 && (
        <Select
          value={cueCategoryFilter}
          onValueChange={(value) => setCueCategoryFilter(value as ResourceFilterValue)}
        >
          <SelectTrigger className="w-fit" aria-label="Filter by cue category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cue categories</SelectItem>
            {cueCategories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {canManagePreparation && setPiecesCatalog.length > 0 && (
        <Select
          value={setPieceFilter}
          onValueChange={(value) => setSetPieceFilter(value as ResourceFilterValue)}
        >
          <SelectTrigger className="w-fit" aria-label="Filter by set piece">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All set pieces</SelectItem>
            {setPiecesCatalog.map((piece) => (
              <SelectItem key={piece.id} value={String(piece.id)}>
                {piece.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function InsertMomentForm({
  momentTypes,
  characters,
  insertTypeId,
  insertText,
  insertCharacterId,
  insertTypeName,
  saving,
  onTypeChange,
  onTextChange,
  onCharacterChange,
  onSubmit,
  onCancel,
}: {
  momentTypes: MomentTypeResponse[];
  characters: CharacterDetailResponse[];
  insertTypeId: string;
  insertText: string;
  insertCharacterId: string;
  insertTypeName: string | undefined;
  saving: boolean;
  onTypeChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onCharacterChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const sortedCharacters = sortByName(characters);

  return (
    <form
      onSubmit={onSubmit}
      className="mx-4 mb-3 space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3"
    >
      <p className="text-xs font-medium text-muted-foreground">Insert new moment</p>
      <Select value={insertTypeId} onValueChange={onTypeChange}>
        <SelectTrigger className="w-full" aria-label="Moment type">
          <SelectValue placeholder="Moment type…" />
        </SelectTrigger>
        <SelectContent>
          {momentTypes.map((type) => (
            <SelectItem key={type.id} value={String(type.id)}>
              {momentTypeLabel(type.name as MomentDetailResponse["moment_type"])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        value={insertText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Original text for new moment"
        rows={2}
      />
      {insertTypeName === "dialogue" && (
        <Select value={insertCharacterId} onValueChange={onCharacterChange}>
          <SelectTrigger className="w-full" aria-label="Speaking character">
            <SelectValue placeholder="Speaking character…" />
          </SelectTrigger>
          <SelectContent>
            {sortedCharacters.map((character) => (
              <SelectItem key={character.id} value={String(character.id)}>
                {character.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={saving || !insertTypeId || !insertText.trim()}
        >
          Insert
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
