import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import SceneSummaryStrip from "@/components/SceneSummaryStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  domainIcon,
  momentAttachmentChipClass,
  type MomentAttachmentKind,
} from "@/lib/domainIcons";
import type { TimelineScrollAnchor } from "@/lib/timelinePrefsStorage";
import {
  findFirstFullyVisibleAnchor,
  getSelectedMomentOffscreen,
  scrollListToMomentCentered,
  type SelectedMomentOffscreen,
} from "@/lib/timelineScrollAnchor";
import type { SceneSummaryData } from "@/lib/sceneSummary";
import type {
  CharacterDetailResponse,
  MomentDetailResponse,
  MomentSummary,
  PropResponse,
  SetPieceResponse,
} from "@/lib/types";
import { cn, momentTypeLabel } from "@/lib/utils";
import { momentBadgeClass, momentHighlightRowClass, momentTextBlurClass } from "@/lib/momentStyles";

export interface TimelineSection {
  sceneId: number;
  label: string;
  moments: MomentSummary[];
  /** Per-scene summary for the strip at the start of this section. */
  summary?: SceneSummaryData;
}

function sectionHasSummary(summary?: SceneSummaryData): boolean {
  if (!summary) return false;
  return (
    summary.characters.length > 0 ||
    summary.songs.length > 0 ||
    summary.props.length > 0 ||
    summary.setPieces.length > 0
  );
}

export interface TimelineMomentListProps {
  /** Flat list — used when there is a single section or no section headers needed. */
  moments?: MomentSummary[];
  /** Multi-scene sections with headers. Takes precedence over `moments` when provided. */
  sections?: TimelineSection[];
  characters: CharacterDetailResponse[];
  /** Optional groups for resolving speaking_group_ids on dialogue/lyric rows. */
  groups?: { id: number; name: string }[];
  selectedMomentId: number | null;
  /** Loaded detail for the selected moment — upgrades gutter chips with names. */
  selectedMomentDetail?: MomentDetailResponse | null;
  propsCatalog?: PropResponse[];
  setPiecesCatalog?: SetPieceResponse[];
  onSelectMoment: (momentId: number) => void;
  isHighlighted: (moment: MomentSummary) => boolean;
  showPrepBadges?: boolean;
  showSequenceNumbers?: boolean;
  showTypeBadge?: boolean;
  blurMyLines?: boolean;
  isMyLine?: (moment: MomentSummary) => boolean;
  /** Show move / insert / delete controls (Admin/Director edit mode only). */
  showStructuralControls?: boolean;
  structuralSaving?: boolean;
  onMoveUp?: (moment: MomentSummary, sceneId: number) => void;
  onMoveDown?: (moment: MomentSummary, sceneId: number) => void;
  onInsertAfter?: (sequenceNumber: number, sceneId: number) => void;
  onDelete?: (momentId: number) => void;
  insertAfterSequence?: number | null;
  insertSceneId?: number | null;
  insertFormSlot?: (sequenceNumber: number, sceneId: number) => React.ReactNode;
  footerSlot?: React.ReactNode;
  /** Optional ref to the scrollable moment list element. */
  listRef?: RefObject<HTMLUListElement | null>;
  /** Fires (throttled) with the first fully visible moment as the user scrolls. */
  onScrollAnchorChange?: (anchor: TimelineScrollAnchor | null) => void;
}

type AttachmentChip = {
  key: string;
  kind: MomentAttachmentKind;
  label: string;
};

function subjectLabel(parts: {
  character_name?: string | null;
  user_display_name?: string | null;
  group_name?: string | null;
}): string | null {
  return parts.character_name || parts.user_display_name || parts.group_name || null;
}

/** Named attachments from moment detail (preferred when selected). */
function buildSelectedAttachmentChips(detail: MomentDetailResponse): AttachmentChip[] {
  const chips: AttachmentChip[] = [];

  for (const event of detail.props) {
    const note = event.notes?.trim();
    chips.push({
      key: `prop-${event.id}`,
      kind: "prop",
      label: note || event.prop_name,
    });
  }

  for (const event of detail.set_pieces) {
    chips.push({
      key: `set-${event.id}`,
      kind: "set_piece",
      label: event.set_piece_name,
    });
  }

  for (const cue of detail.cues) {
    const note = cue.notes?.trim();
    chips.push({
      key: `cue-${cue.id}`,
      kind: "cue",
      label: note ? `${cue.title} (${note})` : cue.title,
    });
  }

  for (const item of detail.blocking) {
    const who = subjectLabel(item);
    const note = item.notes.trim();
    chips.push({
      key: `blocking-${item.id}`,
      kind: "blocking",
      label: who && note ? `${who}: ${note}` : note || who || "Blocking",
    });
  }

  for (const item of detail.entrances) {
    chips.push({
      key: `entrance-${item.id}`,
      kind: "entrance",
      label: subjectLabel(item) || item.notes?.trim() || "Entrance",
    });
  }

  for (const item of detail.exits) {
    chips.push({
      key: `exit-${item.id}`,
      kind: "exit",
      label: subjectLabel(item) || item.notes?.trim() || "Exit",
    });
  }

  for (const item of detail.costume_events) {
    chips.push({
      key: `costume-${item.id}`,
      kind: "costume",
      label: item.costume_name || item.character_name || "Costume",
    });
  }

  return chips;
}

/** Compact chips from list summary flags / ids (all rows when prep badges on). */
function buildSummaryAttachmentChips(
  moment: MomentSummary,
  propsCatalog: PropResponse[],
  setPiecesCatalog: SetPieceResponse[],
): AttachmentChip[] {
  const chips: AttachmentChip[] = [];

  for (const propId of moment.prop_ids ?? []) {
    const prop = propsCatalog.find((item) => item.id === propId);
    chips.push({
      key: `prop-${propId}`,
      kind: "prop",
      label: prop?.name ?? "Prop",
    });
  }
  if ((moment.prop_ids ?? []).length === 0 && moment.has_props) {
    chips.push({ key: "prop-flag", kind: "prop", label: "Prop" });
  }

  for (const setPieceId of moment.set_piece_ids ?? []) {
    const setPiece = setPiecesCatalog.find((item) => item.id === setPieceId);
    chips.push({
      key: `set-${setPieceId}`,
      kind: "set_piece",
      label: setPiece?.name ?? "Set",
    });
  }
  if ((moment.set_piece_ids ?? []).length === 0 && moment.has_set_piece) {
    chips.push({ key: "set-flag", kind: "set_piece", label: "Set" });
  }

  if (moment.has_cues) {
    chips.push({ key: "cue-flag", kind: "cue", label: "Cue" });
  }
  if (moment.has_blocking) {
    chips.push({ key: "blocking-flag", kind: "blocking", label: "Blocking" });
  }
  if (moment.has_entrance) {
    chips.push({ key: "entrance-flag", kind: "entrance", label: "Entrance" });
  }
  if (moment.has_exit) {
    chips.push({ key: "exit-flag", kind: "exit", label: "Exit" });
  }
  if (moment.has_costume) {
    chips.push({ key: "costume-flag", kind: "costume", label: "Costume" });
  }

  return chips;
}

function AttachmentChipIcon({ kind }: { kind: MomentAttachmentKind }) {
  const Icon = domainIcon(kind);
  return <Icon className="size-3.5 shrink-0" aria-hidden />;
}

function speakingCharacterName(
  moment: MomentSummary,
  characters: CharacterDetailResponse[],
  groups: { id: number; name: string }[] = [],
): string | null {
  // Dialogue and lyrics share the same “who performs this line” column.
  // Attribution rows keep the singer name in the body (the attribution Moment itself).
  if (moment.moment_type !== "dialogue" && moment.moment_type !== "lyric") {
    return null;
  }
  const characterIds = moment.speaking_character_ids ?? [];
  const groupIds = moment.speaking_group_ids ?? [];
  if (characterIds.length === 0 && groupIds.length === 0) {
    return null;
  }
  const names = [
    ...characterIds.map((id) => characters.find((item) => item.id === id)?.name),
    ...groupIds.map((id) => groups.find((item) => item.id === id)?.name),
  ].filter((name): name is string => Boolean(name));
  if (names.length === 0) {
    return null;
  }
  if (names.length === 1) {
    return names[0];
  }
  return names.join(" & ");
}

function MomentRow({
  moment,
  index,
  sectionLength,
  sceneId,
  characters,
  groups,
  selectedMomentId,
  selectedMomentDetail,
  propsCatalog,
  setPiecesCatalog,
  onSelectMoment,
  isHighlighted,
  showPrepBadges,
  showSequenceNumbers,
  showTypeBadge,
  blurMyLines,
  isMyLine,
  showStructuralControls,
  structuralSaving,
  onMoveUp,
  onMoveDown,
  onInsertAfter,
  onDelete,
  revealedBlurLineId,
  setRevealedBlurLineId,
  blurRevealMode,
  setBlurRevealMode,
}: {
  moment: MomentSummary;
  index: number;
  sectionLength: number;
  sceneId: number;
  characters: CharacterDetailResponse[];
  groups: { id: number; name: string }[];
  selectedMomentId: number | null;
  selectedMomentDetail?: MomentDetailResponse | null;
  propsCatalog: PropResponse[];
  setPiecesCatalog: SetPieceResponse[];
  onSelectMoment: (momentId: number) => void;
  isHighlighted: (moment: MomentSummary) => boolean;
  showPrepBadges: boolean;
  showSequenceNumbers: boolean;
  showTypeBadge: boolean;
  blurMyLines: boolean;
  isMyLine?: (moment: MomentSummary) => boolean;
  showStructuralControls: boolean;
  structuralSaving: boolean;
  onMoveUp?: (moment: MomentSummary, sceneId: number) => void;
  onMoveDown?: (moment: MomentSummary, sceneId: number) => void;
  onInsertAfter?: (sequenceNumber: number, sceneId: number) => void;
  onDelete?: (momentId: number) => void;
  revealedBlurLineId: number | null;
  setRevealedBlurLineId: (id: number | null) => void;
  blurRevealMode: "hover" | "tap" | null;
  setBlurRevealMode: (mode: "hover" | "tap" | null) => void;
}) {
  const speaker = speakingCharacterName(moment, characters, groups);
  const highlighted = isHighlighted(moment);
  const selected = selectedMomentId === moment.id;
  const shouldBlur = blurMyLines && isMyLine?.(moment);
  const revealed = revealedBlurLineId === moment.id;

  const bodyText =
    (moment.moment_type === "dialogue" || moment.moment_type === "lyric") && speaker
      ? moment.display_text.replace(/^[^:]+:\s*/, "")
      : moment.display_text;

  const selectedDetail =
    selected && selectedMomentDetail?.id === moment.id ? selectedMomentDetail : null;
  const attachmentChips = showPrepBadges
    ? selectedDetail
      ? buildSelectedAttachmentChips(selectedDetail)
      : buildSummaryAttachmentChips(moment, propsCatalog, setPiecesCatalog)
    : [];

  function handleRowKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectMoment(moment.id);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (shouldBlur && !revealed) {
          setRevealedBlurLineId(moment.id);
          setBlurRevealMode("tap");
          return;
        }
        onSelectMoment(moment.id);
      }}
      onKeyDown={handleRowKeyDown}
      onMouseEnter={
        shouldBlur
          ? () => {
              setRevealedBlurLineId(moment.id);
              setBlurRevealMode("hover");
            }
          : undefined
      }
      onMouseLeave={
        shouldBlur
          ? () => {
              if (blurRevealMode === "hover") {
                setRevealedBlurLineId(null);
                setBlurRevealMode(null);
              }
            }
          : undefined
      }
      className={momentHighlightRowClass(highlighted, selected, moment.moment_type)}
    >
      {showStructuralControls && (
        <div
          className="flex shrink-0 flex-col gap-0.5 self-start pt-0.5"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={structuralSaving || index === 0}
            onClick={() => onMoveUp?.(moment, sceneId)}
            aria-label="Move up"
            title="Move up"
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={structuralSaving || index === sectionLength - 1}
            onClick={() => onMoveDown?.(moment, sceneId)}
            aria-label="Move down"
            title="Move down"
          >
            <ChevronDown />
          </Button>
        </div>
      )}

      {/* Script gutter: speaker + line number + prep chips (always when enabled) */}
      <div
        className={cn(
          "flex shrink-0 flex-col gap-0.5 self-start",
          showPrepBadges ? "w-[6.5rem] sm:w-32" : "w-[5.5rem] sm:w-28",
        )}
      >
        {speaker && (
          <span
            className="truncate text-xs font-semibold tracking-wide text-foreground uppercase"
            title={speaker}
          >
            {speaker}
          </span>
        )}
        {showSequenceNumbers && (
          <span className="font-mono text-[11px] text-muted-foreground">
            L.{moment.sequence_number}
          </span>
        )}
        {attachmentChips.length > 0 && (
          <div
            className="mt-0.5 flex flex-col gap-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            {attachmentChips.map((chip) => (
              <span
                key={chip.key}
                className={cn(
                  "inline-flex min-w-0 items-center gap-1 text-[10px] leading-tight font-medium",
                    momentAttachmentChipClass(chip.kind),
                )}
                title={chip.label}
              >
                <AttachmentChipIcon kind={chip.kind} />
                <span className="truncate">{chip.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Script body */}
      <div className="min-w-0 flex-1 self-stretch">
        <p
          className={cn(
            "font-script whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground",
            moment.moment_type === "stage_direction" && "italic text-muted-foreground",
            momentTextBlurClass(!!shouldBlur, revealed),
          )}
        >
          {bodyText}
        </p>
      </div>

      {showTypeBadge && (
        <div
          className="flex shrink-0 self-start"
          onClick={(event) => event.stopPropagation()}
        >
          <Badge className={cn("capitalize", momentBadgeClass(moment.moment_type))}>
            {momentTypeLabel(moment.moment_type)}
          </Badge>
        </div>
      )}

      {showStructuralControls && (
        <div
          className="flex shrink-0 flex-col gap-1 self-start"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={structuralSaving}
            onClick={() => onInsertAfter?.(moment.sequence_number, sceneId)}
            aria-label="Insert moment after"
            title="Insert moment after"
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={structuralSaving}
            onClick={() => onDelete?.(moment.id)}
            aria-label="Delete moment"
            title="Delete moment"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TimelineMomentList({
  moments,
  sections,
  characters,
  groups = [],
  selectedMomentId,
  selectedMomentDetail = null,
  propsCatalog = [],
  setPiecesCatalog = [],
  onSelectMoment,
  isHighlighted,
  showPrepBadges = true,
  showSequenceNumbers = true,
  showTypeBadge = true,
  blurMyLines = false,
  isMyLine,
  showStructuralControls = false,
  structuralSaving = false,
  onMoveUp,
  onMoveDown,
  onInsertAfter,
  onDelete,
  insertAfterSequence,
  insertSceneId,
  insertFormSlot,
  footerSlot,
  listRef,
  onScrollAnchorChange,
}: TimelineMomentListProps) {
  const [revealedBlurLineId, setRevealedBlurLineId] = useState<number | null>(null);
  const [blurRevealMode, setBlurRevealMode] = useState<"hover" | "tap" | null>(null);
  const [selectedOffscreen, setSelectedOffscreen] =
    useState<SelectedMomentOffscreen>(null);
  const internalListRef = useRef<HTMLUListElement | null>(null);
  const anchorRafRef = useRef<number | null>(null);
  const offscreenRafRef = useRef<number | null>(null);

  const resolvedSections: TimelineSection[] =
    sections && sections.length > 0
      ? sections
      : [
          {
            sceneId: 0,
            label: "",
            moments: moments ?? [],
          },
        ];

  const showHeaders = resolvedSections.length > 1 || Boolean(resolvedSections[0]?.label);

  function assignListRef(node: HTMLUListElement | null) {
    internalListRef.current = node;
    if (listRef) {
      listRef.current = node;
    }
  }

  useEffect(() => {
    const listEl = internalListRef.current;
    if (!listEl || !onScrollAnchorChange) return;

    const publish = () => {
      anchorRafRef.current = null;
      onScrollAnchorChange(findFirstFullyVisibleAnchor(listEl));
    };

    const onScroll = () => {
      if (anchorRafRef.current != null) return;
      anchorRafRef.current = window.requestAnimationFrame(publish);
    };

    listEl.addEventListener("scroll", onScroll, { passive: true });
    publish();

    return () => {
      listEl.removeEventListener("scroll", onScroll);
      if (anchorRafRef.current != null) {
        window.cancelAnimationFrame(anchorRafRef.current);
        anchorRafRef.current = null;
      }
    };
  }, [onScrollAnchorChange, resolvedSections]);

  useEffect(() => {
    const listEl = internalListRef.current;
    if (!listEl || selectedMomentId == null) {
      setSelectedOffscreen(null);
      return;
    }

    const publish = () => {
      offscreenRafRef.current = null;
      setSelectedOffscreen(getSelectedMomentOffscreen(listEl, selectedMomentId));
    };

    const onScroll = () => {
      if (offscreenRafRef.current != null) return;
      offscreenRafRef.current = window.requestAnimationFrame(publish);
    };

    listEl.addEventListener("scroll", onScroll, { passive: true });
    // Selection change or list rebuild may move the row without a scroll event.
    publish();
    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(listEl);

    return () => {
      listEl.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      if (offscreenRafRef.current != null) {
        window.cancelAnimationFrame(offscreenRafRef.current);
        offscreenRafRef.current = null;
      }
    };
  }, [selectedMomentId, resolvedSections]);

  function scrollSelectedToCenter() {
    const listEl = internalListRef.current;
    if (!listEl || selectedMomentId == null) return;
    scrollListToMomentCentered(listEl, selectedMomentId, "smooth");
  }

  return (
    <div className="relative min-h-0 flex-1">
      {selectedOffscreen === "above" && (
        <button
          type="button"
          onClick={scrollSelectedToCenter}
          className="absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center rounded-full border-2 border-foreground/80 bg-background p-1.5 text-foreground/80 shadow-sm hover:bg-muted"
          aria-label="Scroll to selected moment"
          title="Scroll to selected moment"
        >
          <ChevronUp className="size-4" />
        </button>
      )}
      {selectedOffscreen === "below" && (
        <button
          type="button"
          onClick={scrollSelectedToCenter}
          className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center rounded-full border-2 border-foreground/80 bg-background p-1.5 text-foreground/80 shadow-sm hover:bg-muted"
          aria-label="Scroll to selected moment"
          title="Scroll to selected moment"
        >
          <ChevronDown className="size-4" />
        </button>
      )}
      <ul ref={assignListRef} className="h-full min-h-0 overflow-y-auto">
      {resolvedSections.map((section) => (
        <Fragment key={section.sceneId || "flat"}>
          {showHeaders && section.label ? (
            <li className="sticky top-0 z-10 list-none border-b border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </li>
          ) : null}
          {sectionHasSummary(section.summary) ? (
            <li className="list-none border-b border-border bg-background px-3 py-2">
              <SceneSummaryStrip
                summary={section.summary!}
                sceneId={section.sceneId}
                sceneLabel={section.label}
                sceneEndMomentId={
                  section.moments.length > 0
                    ? section.moments[section.moments.length - 1]?.id
                    : undefined
                }
              />
            </li>
          ) : null}
          {section.moments
            // Lyrics already show the singer in the speaker column; attribution
            // rows are kept in the script data but hidden so they don't look
            // like an empty "singer with no lyrics" line.
            .filter((moment) => moment.moment_type !== "song_attribution")
            .map((moment, index, visibleMoments) => (
              <li
                key={moment.id}
                data-moment-id={moment.id}
                data-scene-id={section.sceneId}
                data-sequence-number={moment.sequence_number}
                className="px-1"
              >
                <MomentRow
                  moment={moment}
                  index={index}
                  sectionLength={visibleMoments.length}
                  sceneId={section.sceneId}
                  characters={characters}
                  groups={groups}
                  selectedMomentId={selectedMomentId}
                  selectedMomentDetail={selectedMomentDetail}
                  propsCatalog={propsCatalog}
                  setPiecesCatalog={setPiecesCatalog}
                  onSelectMoment={onSelectMoment}
                  isHighlighted={isHighlighted}
                  showPrepBadges={showPrepBadges}
                  showSequenceNumbers={showSequenceNumbers}
                  showTypeBadge={showTypeBadge}
                  blurMyLines={blurMyLines}
                  isMyLine={isMyLine}
                  showStructuralControls={showStructuralControls}
                  structuralSaving={structuralSaving}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onInsertAfter={onInsertAfter}
                  onDelete={onDelete}
                  revealedBlurLineId={revealedBlurLineId}
                  setRevealedBlurLineId={setRevealedBlurLineId}
                  blurRevealMode={blurRevealMode}
                  setBlurRevealMode={setBlurRevealMode}
                />
                {insertFormSlot &&
                  insertAfterSequence === moment.sequence_number &&
                  insertSceneId === section.sceneId && (
                    <div onClick={(event) => event.stopPropagation()}>
                      {insertFormSlot(moment.sequence_number, section.sceneId)}
                    </div>
                  )}
              </li>
            ))}
        </Fragment>
      ))}
      {footerSlot}
    </ul>
    </div>
  );
}
