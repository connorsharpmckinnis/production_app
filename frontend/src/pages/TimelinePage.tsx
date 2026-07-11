import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MomentDetailSheet from "@/components/MomentDetailSheet";
import SceneSummaryStrip from "@/components/SceneSummaryStrip";
import TimelineMomentList from "@/components/TimelineMomentList";
import { useTimelineScene } from "@/hooks/useTimelineScene";
import { api, ApiError } from "@/lib/api";
import { isHighlightedMoment } from "@/lib/momentHighlight";
import { deriveSceneSummary } from "@/lib/sceneSummary";
import type {
  CharacterDetailResponse,
  MomentDetailResponse,
  MomentSummary,
  MomentTypeResponse,
} from "@/lib/types";
import { formatActLabel, momentTypeLabel } from "@/lib/utils";

type CharacterFilterValue = "all" | "mine" | string;
type GroupFilterValue = "all" | string;
type ResourceFilterValue = "all" | string;

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);

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
  const [microphoneFilter, setMicrophoneFilter] = useState<ResourceFilterValue>("all");
  const [setPieceFilter, setSetPieceFilter] = useState<ResourceFilterValue>("all");

  const [insertAfterSequence, setInsertAfterSequence] = useState<number | null>(null);
  const [insertAtEnd, setInsertAtEnd] = useState(false);
  const [insertTypeId, setInsertTypeId] = useState("");
  const [insertText, setInsertText] = useState("");
  const [insertCharacterId, setInsertCharacterId] = useState("");
  const [structuralSaving, setStructuralSaving] = useState(false);

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
      microphoneFilter,
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
      microphoneFilter,
      setPieceFilter,
    ],
  );

  const scene = useTimelineScene({ productionId, filterInput });

  const myCharacterIds = scene.myCharacterIds;
  const groups = scene.groups;
  const canManagePreparation = scene.canManagePreparation;

  const highlightCharacterIds = useMemo(() => {
    if (groupFilter !== "all") {
      const group = groups.find((item) => item.id === Number(groupFilter));
      return group?.character_ids;
    }
    if (characterFilter === "all") return undefined;
    if (characterFilter === "mine") return myCharacterIds;
    return [Number(characterFilter)];
  }, [characterFilter, groupFilter, groups, myCharacterIds]);

  const sceneSummary = useMemo(
    () => deriveSceneSummary(scene.moments, scene.characters, scene.songs),
    [scene.moments, scene.characters, scene.songs],
  );

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
    microphoneFilter !== "all",
    setPieceFilter !== "all",
  ].filter(Boolean).length;

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  function resetInsertForm() {
    setInsertAfterSequence(null);
    setInsertAtEnd(false);
    setInsertTypeId("");
    setInsertText("");
    setInsertCharacterId("");
  }

  const insertTypeName = scene.momentTypes.find((type) => String(type.id) === insertTypeId)
    ?.name;

  async function handleInsertMoment(event: React.FormEvent) {
    event.preventDefault();
    if (scene.selectedSceneId === null || !insertTypeId || !insertText.trim()) return;

    if (insertTypeName === "dialogue" && !insertCharacterId) {
      alert("Select a speaking character for dialogue moments.");
      return;
    }

    const sequenceNumber = insertAtEnd
      ? (scene.moments[scene.moments.length - 1]?.sequence_number ?? 0) + 1
      : (insertAfterSequence ?? 0) + 1;

    setStructuralSaving(true);
    try {
      const created = await api.createMoment(productionId, scene.selectedSceneId, {
        sequence_number: sequenceNumber,
        moment_type_id: Number(insertTypeId),
        original_text: insertText.trim(),
        character_id: insertCharacterId ? Number(insertCharacterId) : null,
      });
      resetInsertForm();
      scene.setSelectedMomentId(created.id);
      scene.setMomentDetail(created);
      scene.refreshMomentsList();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to insert moment");
    } finally {
      setStructuralSaving(false);
    }
  }

  async function handleDeleteMoment(momentId: number) {
    if (!confirm("Delete this moment and all attached data?")) return;

    setStructuralSaving(true);
    try {
      await api.deleteMoment(productionId, momentId);
      if (scene.selectedMomentId === momentId) {
        scene.setSelectedMomentId(null);
        scene.setMomentDetail(null);
      }
      scene.refreshMomentsList();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to delete moment");
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
      alert(err instanceof ApiError ? String(err.detail) : "Failed to reorder moment");
    } finally {
      setStructuralSaving(false);
    }
  }

  if (scene.loading) {
    return <p className="text-muted-foreground">Loading timeline…</p>;
  }

  if (scene.acts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-muted-foreground">No acts found. Import a script first.</p>
        <Link to="/productions" className="text-sm text-primary hover:underline">
          Back to productions
        </Link>
      </div>
    );
  }

  const sceneLabel = scene.selectedScene
    ? `Act ${scene.selectedAct?.number} › Scene ${scene.selectedScene.number}${
        scene.selectedScene.title ? ` — ${scene.selectedScene.title}` : ""
      }`
    : "Select a scene";

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <Link to="/productions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Productions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {scene.productionTitle ?? "Timeline"}
        </h1>
      </div>

      {scene.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {scene.error}
        </div>
      )}

      <div className="flex flex-col gap-3">
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
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
              }}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Clear
            </button>
          )}
        </form>

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
            value={characterFilter}
            onChange={(e) => {
              setCharacterFilter(e.target.value as CharacterFilterValue);
              setGroupFilter("all");
            }}
            disabled={groupFilter !== "all"}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="all">All characters</option>
            {myCharacterIds.length > 0 && <option value="mine">My characters</option>}
            {scene.characters.map((character) => (
              <option key={character.id} value={String(character.id)}>
                {character.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Advanced filters
            {advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
          </button>
        </div>

        {advancedOpen && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-center">
            {canManagePreparation && groups.length > 0 && (
              <select
                value={groupFilter}
                onChange={(e) => {
                  setGroupFilter(e.target.value as GroupFilterValue);
                  setCharacterFilter("all");
                }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={String(group.id)}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}

            {canManagePreparation && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={costumeOnly}
                  onChange={(e) => setCostumeOnly(e.target.checked)}
                />
                Costume moments only
              </label>
            )}

            {canManagePreparation && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={entranceOnly}
                  onChange={(e) => setEntranceOnly(e.target.checked)}
                />
                Entrance moments only
              </label>
            )}

            {canManagePreparation && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exitOnly}
                  onChange={(e) => setExitOnly(e.target.checked)}
                />
                Exit moments only
              </label>
            )}

            {canManagePreparation && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={blockingOnly}
                  onChange={(e) => setBlockingOnly(e.target.checked)}
                />
                Blocking moments only
              </label>
            )}

            {canManagePreparation && (
              <select
                value={blockingCharacterFilter}
                onChange={(e) => setBlockingCharacterFilter(e.target.value as ResourceFilterValue)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All blocking characters</option>
                {scene.characters.map((character) => (
                  <option key={character.id} value={String(character.id)}>
                    Blocking: {character.name}
                  </option>
                ))}
              </select>
            )}

            {scene.songs.length > 0 && (
              <select
                value={songFilter}
                onChange={(e) => setSongFilter(e.target.value as ResourceFilterValue)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All songs</option>
                {scene.songs.map((song) => (
                  <option key={song.id} value={String(song.id)}>
                    {song.title}
                  </option>
                ))}
              </select>
            )}

            {canManagePreparation && scene.propsCatalog.length > 0 && (
              <select
                value={propFilter}
                onChange={(e) => setPropFilter(e.target.value as ResourceFilterValue)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All props</option>
                {scene.propsCatalog.map((prop) => (
                  <option key={prop.id} value={String(prop.id)}>
                    {prop.name}
                  </option>
                ))}
              </select>
            )}

            {canManagePreparation && scene.cueCategories.length > 0 && (
              <select
                value={cueCategoryFilter}
                onChange={(e) => setCueCategoryFilter(e.target.value as ResourceFilterValue)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All cue categories</option>
                {scene.cueCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}

            {canManagePreparation && scene.microphonesCatalog.length > 0 && (
              <select
                value={microphoneFilter}
                onChange={(e) => setMicrophoneFilter(e.target.value as ResourceFilterValue)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All microphones</option>
                {scene.microphonesCatalog.map((mic) => (
                  <option key={mic.id} value={String(mic.id)}>
                    {mic.identifier}
                  </option>
                ))}
              </select>
            )}

            {canManagePreparation && scene.setPiecesCatalog.length > 0 && (
              <select
                value={setPieceFilter}
                onChange={(e) => setSetPieceFilter(e.target.value as ResourceFilterValue)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All set pieces</option>
                {scene.setPiecesCatalog.map((piece) => (
                  <option key={piece.id} value={String(piece.id)}>
                    {piece.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <SceneSummaryStrip summary={sceneSummary} />
      <p className="text-sm font-medium text-muted-foreground">{sceneLabel}</p>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {scene.momentsLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading moments…</p>
        ) : scene.moments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No moments match these filters.</p>
        ) : (
          <TimelineMomentList
            moments={scene.moments}
            characters={scene.characters}
            selectedMomentId={scene.selectedMomentId}
            onSelectMoment={scene.setSelectedMomentId}
            isHighlighted={(moment) =>
              isHighlightedMoment(moment, highlightCharacterIds, scene.characters)
            }
            showPrepBadges
            canManagePreparation={canManagePreparation}
            structuralSaving={structuralSaving}
            onMoveUp={(moment) => void handleMoveMoment(moment, "up")}
            onMoveDown={(moment) => void handleMoveMoment(moment, "down")}
            onInsertAfter={(sequenceNumber) => {
              resetInsertForm();
              setInsertAfterSequence(sequenceNumber);
            }}
            onDelete={(momentId) => void handleDeleteMoment(momentId)}
            insertAfterSequence={insertAfterSequence}
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
              canManagePreparation ? (
                <li className="border-t border-border px-4 py-3">
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
                    <button
                      type="button"
                      disabled={structuralSaving}
                      onClick={() => {
                        resetInsertForm();
                        setInsertAtEnd(true);
                      }}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      + Insert moment at end of scene
                    </button>
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
        canEdit={canManagePreparation}
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
  return (
    <form
      onSubmit={onSubmit}
      className="mx-4 mb-3 space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3"
    >
      <p className="text-xs font-medium text-muted-foreground">Insert new moment</p>
      <select
        value={insertTypeId}
        onChange={(e) => onTypeChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Moment type…</option>
        {momentTypes.map((type) => (
          <option key={type.id} value={String(type.id)}>
            {momentTypeLabel(type.name as MomentDetailResponse["moment_type"])}
          </option>
        ))}
      </select>
      <textarea
        value={insertText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Original text for new moment"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {insertTypeName === "dialogue" && (
        <select
          value={insertCharacterId}
          onChange={(e) => onCharacterChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Speaking character…</option>
          {characters.map((character) => (
            <option key={character.id} value={String(character.id)}>
              {character.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !insertTypeId || !insertText.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Insert
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
