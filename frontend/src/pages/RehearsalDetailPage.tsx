import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import SceneMultiSelect from "@/components/SceneMultiSelect";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type {
  ActSummary,
  CastableUserResponse,
  LocationResponse,
  RehearsalDetailResponse,
  RehearsalNoteResponse,
  SceneRecommendationResponse,
  SuggestedCallResponse,
} from "@/lib/types";
import {
  combineRehearsalDateAndTime,
  formatDateTime,
  formatTime,
  timeInputToMinutes,
  toTimeInputValue,
} from "@/lib/utils";

const NO_LOCATION = "__none__";

const PUBLISHED_STATUSES = new Set(["published", "in_progress", "completed"]);

function isPublishedStatus(status: string): boolean {
  return PUBLISHED_STATUSES.has(status);
}

type BlockDraft = {
  key: string;
  start_time: string;
  end_time: string;
  location_id: string;
  label: string;
  sort_order: number;
  scene_ids: number[];
  user_ids: number[];
  double_book_user_ids: number[];
};

function statusBadgeVariant(
  status: string,
): "outline" | "secondary" | "info" | "warning" | "success" | "destructive" {
  switch (status) {
    case "planned":
      return "secondary";
    case "published":
      return "info";
    case "in_progress":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function kindLabel(kind: string): string {
  return kind === "all_call" ? "All call" : "Called";
}

function sceneRefLabel(scene: {
  act_number?: number | null;
  number: number;
  title: string | null;
}): string {
  const base =
    scene.act_number != null ? `${scene.act_number}.${scene.number}` : `Sc ${scene.number}`;
  return scene.title ? `${base} ${scene.title}` : base;
}

function blocksFromDetail(detail: RehearsalDetailResponse): BlockDraft[] {
  return detail.blocks.map((block, index) => ({
    key: `block-${block.id}`,
    start_time: toTimeInputValue(block.starts_at),
    end_time: toTimeInputValue(block.ends_at),
    location_id: block.location_id != null ? String(block.location_id) : NO_LOCATION,
    label: block.label ?? "",
    sort_order: block.sort_order ?? index,
    scene_ids: block.scenes.map((scene) => scene.id),
    user_ids: block.calls.map((call) => call.user_id),
    double_book_user_ids: block.double_book_user_ids,
  }));
}

function emptyBlock(rehearsal: RehearsalDetailResponse, sortOrder: number): BlockDraft {
  return {
    key: `new-${Date.now()}-${sortOrder}`,
    start_time: toTimeInputValue(rehearsal.starts_at),
    end_time: toTimeInputValue(rehearsal.ends_at),
    location_id:
      rehearsal.location_id != null ? String(rehearsal.location_id) : NO_LOCATION,
    label: "",
    sort_order: sortOrder,
    scene_ids: [],
    user_ids: [],
    double_book_user_ids: [],
  };
}

function canPublish(status: string): boolean {
  return status === "scheduled" || status === "planned" || status === "published";
}

function canOpen(status: string): boolean {
  return status === "published" || status === "planned" || status === "in_progress";
}

function canComplete(status: string): boolean {
  return status === "in_progress" || status === "published" || status === "planned";
}

function notesAllowed(status: string): boolean {
  return status === "in_progress" || status === "published" || status === "completed";
}

export default function RehearsalDetailPage() {
  const { id, rehearsalId: rehearsalIdParam } = useParams<{
    id: string;
    rehearsalId: string;
  }>();
  const productionId = Number(id);
  const rehearsalId = Number(rehearsalIdParam);
  const { user, canManagePreparation } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [rehearsal, setRehearsal] = useState<RehearsalDetailResponse | null>(null);
  const [blocks, setBlocks] = useState<BlockDraft[]>([]);
  const [acts, setActs] = useState<ActSummary[]>([]);
  const [locations, setLocations] = useState<LocationResponse[]>([]);
  const [castableUsers, setCastableUsers] = useState<CastableUserResponse[]>([]);
  const [recommendations, setRecommendations] = useState<SceneRecommendationResponse[]>(
    [],
  );
  const [suggestionsByBlock, setSuggestionsByBlock] = useState<
    Record<string, SuggestedCallResponse[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const editable =
    canManagePreparation &&
    rehearsal != null &&
    rehearsal.status !== "completed" &&
    rehearsal.status !== "cancelled";

  const loadSuggestions = useCallback(
    async (blockKey: string, sceneIds: number[]) => {
      if (!canManagePreparation || sceneIds.length === 0) {
        setSuggestionsByBlock((prev) => {
          const next = { ...prev };
          delete next[blockKey];
          return next;
        });
        return;
      }
      try {
        const suggestions = await api.suggestCalls(productionId, sceneIds);
        setSuggestionsByBlock((prev) => ({ ...prev, [blockKey]: suggestions }));
      } catch {
        // Soft failure — cast checkboxes still work from the full cast list.
      }
    },
    [canManagePreparation, productionId],
  );

  async function loadData() {
    setError(null);
    try {
      const detailPromise = api.getRehearsal(productionId, rehearsalId);
      const actsPromise = api.listActs(productionId);
      const locationsPromise = api.listLocations(productionId);

      const directorExtras = canManagePreparation
        ? Promise.all([
            api.listCastableUsers(productionId),
            api.listSceneRecommendations(productionId),
          ])
        : Promise.resolve([[], []] as [
            CastableUserResponse[],
            SceneRecommendationResponse[],
          ]);

      const [detail, actData, locationData, [castUsers, sceneRecs]] = await Promise.all([
        detailPromise,
        actsPromise,
        locationsPromise,
        directorExtras,
      ]);

      setRehearsal(detail);
      setBlocks(blocksFromDetail(detail));
      setActs(actData);
      setLocations(locationData);
      setCastableUsers(castUsers);
      setRecommendations(sceneRecs);

      if (canManagePreparation) {
        for (const block of detail.blocks) {
          const sceneIds = block.scenes.map((scene) => scene.id);
          if (sceneIds.length > 0) {
            void loadSuggestions(`block-${block.id}`, sceneIds);
          }
        }
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to load rehearsal"));
      setRehearsal(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId, rehearsalId, canManagePreparation]);

  const castOptions = useMemo(() => {
    const byId = new Map<number, { id: number; display_name: string }>();
    for (const person of castableUsers) {
      byId.set(person.id, { id: person.id, display_name: person.display_name });
    }
    for (const suggestions of Object.values(suggestionsByBlock)) {
      for (const suggestion of suggestions) {
        if (!byId.has(suggestion.user_id)) {
          byId.set(suggestion.user_id, {
            id: suggestion.user_id,
            display_name: suggestion.display_name,
          });
        }
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
    );
  }, [castableUsers, suggestionsByBlock]);

  const myBlocks = useMemo(() => {
    if (!rehearsal || !user) return [];
    return rehearsal.blocks.filter((block) =>
      block.calls.some((call) => call.user_id === user.id),
    );
  }, [rehearsal, user]);

  function updateBlock(key: string, patch: Partial<BlockDraft>) {
    setBlocks((prev) =>
      prev.map((block) => (block.key === key ? { ...block, ...patch } : block)),
    );
  }

  async function handleScenesChange(key: string, sceneIds: number[]) {
    updateBlock(key, { scene_ids: sceneIds, user_ids: [] });
    await loadSuggestions(key, sceneIds);
  }

  function addBlock() {
    if (!rehearsal) return;
    setBlocks((prev) => [...prev, emptyBlock(rehearsal, prev.length)]);
  }

  function removeBlock(key: string) {
    setBlocks((prev) =>
      prev
        .filter((block) => block.key !== key)
        .map((block, index) => ({ ...block, sort_order: index })),
    );
    setSuggestionsByBlock((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSavePlan() {
    if (!rehearsal) return;
    for (const block of blocks) {
      if (!block.start_time || !block.end_time) {
        toast.error("Each block needs start and end times");
        return;
      }
      if (timeInputToMinutes(block.end_time) <= timeInputToMinutes(block.start_time)) {
        toast.error("Each block end time must be after its start");
        return;
      }
    }

    setSaving(true);
    try {
      const detail = await api.replaceRehearsalPlan(productionId, rehearsalId, {
        blocks: blocks.map((block, index) => ({
          starts_at: combineRehearsalDateAndTime(rehearsal.starts_at, block.start_time),
          ends_at: combineRehearsalDateAndTime(rehearsal.starts_at, block.end_time),
          location_id: block.location_id === NO_LOCATION ? null : Number(block.location_id),
          label: block.label.trim() || null,
          sort_order: index,
          scene_ids: block.scene_ids,
          user_ids: block.user_ids,
        })),
        mark_planned: true,
      });
      setRehearsal(detail);
      setBlocks(blocksFromDetail(detail));
      const doubleBooked = detail.blocks.some(
        (block) => block.double_book_user_ids.length > 0,
      );
      toast.success(
        doubleBooked
          ? "Plan saved — some people are double-booked across overlapping blocks"
          : "Plan saved",
      );
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save plan"));
    } finally {
      setSaving(false);
    }
  }

  async function runStatusAction(
    label: string,
    action: () => Promise<RehearsalDetailResponse>,
  ) {
    setActionBusy(true);
    try {
      const detail = await action();
      setRehearsal(detail);
      setBlocks(blocksFromDetail(detail));
      toast.success(label);
    } catch (err) {
      toast.error(formatApiError(err, `Failed to ${label.toLowerCase()}`));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleComplete() {
    const ok = await confirm({
      title: "Complete this rehearsal?",
      description:
        "Scene rehearsal counts will increase for scenes on this plan. This cannot be undone from the planner.",
      confirmLabel: "Complete",
    });
    if (!ok) return;
    await runStatusAction("Rehearsal completed", () =>
      api.completeRehearsal(productionId, rehearsalId),
    );
  }

  async function handleAddNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteContent.trim()) return;
    setNoteSaving(true);
    try {
      const note = await api.createRehearsalNote(productionId, rehearsalId, {
        content: noteContent.trim(),
      });
      setRehearsal((prev) =>
        prev ? { ...prev, notes: [...prev.notes, note] } : prev,
      );
      setNoteContent("");
      toast.success("Note added");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to add note"));
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleDeleteNote(note: RehearsalNoteResponse) {
    const ok = await confirm({
      title: "Delete this note?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteRehearsalNote(productionId, rehearsalId, note.id);
      setRehearsal((prev) =>
        prev
          ? { ...prev, notes: prev.notes.filter((item) => item.id !== note.id) }
          : prev,
      );
      toast.success("Note deleted");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete note"));
    }
  }

  function toggleUser(blockKey: string, userId: number, checked: boolean) {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.key !== blockKey) return block;
        const user_ids = checked
          ? [...new Set([...block.user_ids, userId])]
          : block.user_ids.filter((id) => id !== userId);
        return { ...block, user_ids };
      }),
    );
  }

  function applySuggestedCalls(blockKey: string) {
    const suggestions = suggestionsByBlock[blockKey] ?? [];
    if (suggestions.length === 0) return;
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.key !== blockKey) return block;
        return {
          ...block,
          user_ids: suggestions.map((item) => item.user_id),
        };
      }),
    );
  }

  if (loading) {
    return <CatalogPageSkeleton />;
  }

  if (error || !rehearsal) {
    return (
      <div className="space-y-4">
        <Link
          to={`/productions/${productionId}/rehearsals`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Rehearsals
        </Link>
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Rehearsal not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Actor / non-manager view: My call style
  if (!canManagePreparation) {
    const published = isPublishedStatus(rehearsal.status);
    const blocksToShow =
      published && rehearsal.kind === "all_call"
        ? rehearsal.blocks
        : published && myBlocks.length > 0
          ? myBlocks
          : [];

    return (
      <div className="space-y-6">
        <div>
          <Link
            to={`/productions/${productionId}/rehearsals`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Rehearsals
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {rehearsal.title?.trim() || "Rehearsal"}
            </h1>
            <Badge variant={statusBadgeVariant(rehearsal.status)}>
              {statusLabel(rehearsal.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(rehearsal.starts_at)} – {formatTime(rehearsal.ends_at)}
            {rehearsal.location_name ? ` · ${rehearsal.location_name}` : ""}
            {" · "}
            {kindLabel(rehearsal.kind)}
          </p>
        </div>

        {!published && (
          <Alert>
            <AlertDescription>
              This rehearsal is not published yet. The date and time are on the calendar,
              but your call details are not official until the director publishes the plan.
            </AlertDescription>
          </Alert>
        )}

        {published && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild>
              <Link
                to={`/productions/${productionId}/rehearsals/${rehearsalId}/call-sheet`}
              >
                Call sheet
              </Link>
            </Button>
          </div>
        )}

        {published ? (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">My call</h2>
            {blocksToShow.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You are not specifically called on any blocks for this rehearsal.
              </p>
            ) : (
              <ul className="space-y-3">
                {blocksToShow.map((block) => (
                  <li
                    key={block.id}
                    className="rounded-lg border border-border px-4 py-3"
                  >
                    <p className="font-medium">
                      {formatTime(block.starts_at)} – {formatTime(block.ends_at)}
                      {block.location_name ? ` · ${block.location_name}` : ""}
                    </p>
                    {block.label && (
                      <p className="text-sm text-muted-foreground">{block.label}</p>
                    )}
                    {block.scenes.length > 0 && (
                      <p className="mt-1 text-sm">
                        Scenes:{" "}
                        {block.scenes.map((scene) => sceneRefLabel(scene)).join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/productions/${productionId}/rehearsals`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Rehearsals
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {rehearsal.title?.trim() || "Rehearsal plan"}
          </h1>
          <Badge variant={statusBadgeVariant(rehearsal.status)}>
            {statusLabel(rehearsal.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(rehearsal.starts_at)} – {formatTime(rehearsal.ends_at)}
          {rehearsal.location_name ? ` · ${rehearsal.location_name}` : ""}
          {" · "}
          {kindLabel(rehearsal.kind)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button type="button" onClick={() => void handleSavePlan()} disabled={saving}>
            {saving ? "Saving…" : "Save plan"}
          </Button>
        )}
        {canPublish(rehearsal.status) && editable && (
          <Button
            type="button"
            variant="outline"
            disabled={actionBusy}
            onClick={() =>
              void runStatusAction("Published", () =>
                api.publishRehearsal(productionId, rehearsalId),
              )
            }
          >
            Publish
          </Button>
        )}
        {canOpen(rehearsal.status) && editable && (
          <Button
            type="button"
            variant="outline"
            disabled={actionBusy}
            onClick={() =>
              void runStatusAction("Opened", () =>
                api.openRehearsal(productionId, rehearsalId),
              )
            }
          >
            Open
          </Button>
        )}
        {canComplete(rehearsal.status) && canManagePreparation && (
          <Button
            type="button"
            variant="outline"
            disabled={actionBusy || rehearsal.status === "completed"}
            onClick={() => void handleComplete()}
          >
            Complete
          </Button>
        )}
        <Button type="button" variant="outline" asChild>
          <Link to={`/productions/${productionId}/rehearsals/${rehearsalId}/call-sheet`}>
            Call sheet
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-medium">Blocks</h2>
              <p className="text-sm text-muted-foreground">
                Time blocks with scenes and who is called. Prefer 30-minute increments.
              </p>
            </div>
            {editable && (
              <Button type="button" variant="outline" size="sm" onClick={addBlock}>
                <Plus className="mr-1 size-4" />
                Add block
              </Button>
            )}
          </div>

          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No blocks yet. Add a block to plan this rehearsal.
            </p>
          ) : (
            <ul className="space-y-4">
              {blocks.map((block, index) => {
                const suggestions = suggestionsByBlock[block.key] ?? [];
                const suggestedIds = new Set(suggestions.map((item) => item.user_id));
                const doubleBookNames = castOptions
                  .filter((person) => block.double_book_user_ids.includes(person.id))
                  .map((person) => person.display_name);

                return (
                  <li
                    key={block.key}
                    className="space-y-3 rounded-lg border border-border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-medium">Block {index + 1}</h3>
                      {editable && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeBlock(block.key)}
                          aria-label={`Remove block ${index + 1}`}
                          title="Remove block"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`block-start-${block.key}`}>Starts</Label>
                        <Input
                          id={`block-start-${block.key}`}
                          type="time"
                          value={block.start_time}
                          disabled={!editable}
                          step={1800}
                          onChange={(e) =>
                            updateBlock(block.key, { start_time: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`block-end-${block.key}`}>Ends</Label>
                        <Input
                          id={`block-end-${block.key}`}
                          type="time"
                          value={block.end_time}
                          disabled={!editable}
                          step={1800}
                          onChange={(e) =>
                            updateBlock(block.key, { end_time: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Select
                          value={block.location_id}
                          disabled={!editable}
                          onValueChange={(value) =>
                            updateBlock(block.key, { location_id: value })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_LOCATION}>No location</SelectItem>
                            {locations.map((location) => (
                              <SelectItem key={location.id} value={String(location.id)}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`block-label-${block.key}`}>Label</Label>
                        <Input
                          id={`block-label-${block.key}`}
                          value={block.label}
                          disabled={!editable}
                          placeholder="Optional (e.g. Music)"
                          onChange={(e) =>
                            updateBlock(block.key, { label: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Scenes</Label>
                      {editable ? (
                        <SceneMultiSelect
                          acts={acts}
                          selectedSceneIds={block.scene_ids}
                          onChange={(sceneIds) =>
                            void handleScenesChange(block.key, sceneIds)
                          }
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {block.scene_ids.length === 0
                            ? "None"
                            : `${block.scene_ids.length} selected`}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label>Called</Label>
                        {editable && suggestions.length > 0 && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto px-0"
                            onClick={() => applySuggestedCalls(block.key)}
                          >
                            Use suggested ({suggestions.length})
                          </Button>
                        )}
                      </div>
                      {castOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No castable users yet. Assign actors to characters first.
                        </p>
                      ) : (
                        <ul className="grid gap-1 sm:grid-cols-2">
                          {castOptions.map((person) => {
                            const checked = block.user_ids.includes(person.id);
                            const suggested = suggestedIds.has(person.id);
                            const id = `call-${block.key}-${person.id}`;
                            return (
                              <li key={person.id}>
                                <Label
                                  htmlFor={id}
                                  className="flex cursor-pointer items-center gap-2 font-normal"
                                >
                                  <Checkbox
                                    id={id}
                                    checked={checked}
                                    disabled={!editable}
                                    onCheckedChange={(value) =>
                                      toggleUser(block.key, person.id, value === true)
                                    }
                                  />
                                  <span className="text-sm">
                                    {person.display_name}
                                    {suggested ? (
                                      <span className="text-muted-foreground">
                                        {" "}
                                        (suggested)
                                      </span>
                                    ) : null}
                                  </span>
                                </Label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {block.double_book_user_ids.length > 0 && (
                      <Alert variant="warning">
                        <AlertDescription>
                          Double-booked on overlapping blocks
                          {doubleBookNames.length > 0
                            ? `: ${doubleBookNames.join(", ")}`
                            : ""}
                          .
                        </AlertDescription>
                      </Alert>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <h2 className="text-lg font-medium">Scene recommendations</h2>
          <p className="text-sm text-muted-foreground">
            Under-rehearsed scenes first.
          </p>
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scenes yet.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
              {recommendations.map((scene) => (
                <li key={scene.id} className="rounded-md border border-border px-2 py-1.5">
                  <div className="font-medium">
                    {scene.act_number}.{scene.number}
                    {scene.title ? ` — ${scene.title}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rehearsed {scene.times_rehearsed}×
                    {scene.last_rehearsed_at
                      ? ` · last ${formatDateTime(scene.last_rehearsed_at)}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {notesAllowed(rehearsal.status) && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Notes</h2>
          {rehearsal.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {rehearsal.notes.map((note) => {
                const isMine = user?.id === note.author_user_id;
                return (
                  <li
                    key={note.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {note.author_display_name} · {formatDateTime(note.created_at)}
                      </p>
                    </div>
                    {isMine && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDeleteNote(note)}
                        aria-label="Delete note"
                        title="Delete"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <form onSubmit={(e) => void handleAddNote(e)} className="space-y-2">
            <Label htmlFor="rehearsal-note">Add note</Label>
            <Textarea
              id="rehearsal-note"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              placeholder="Director notes for this rehearsal…"
            />
            <Button type="submit" disabled={noteSaving || !noteContent.trim()}>
              {noteSaving ? "Saving…" : "Add note"}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
