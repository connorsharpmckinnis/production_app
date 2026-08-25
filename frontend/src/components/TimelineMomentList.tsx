import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import SceneSummaryStrip from "@/components/SceneSummaryStrip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SceneSummaryData } from "@/lib/sceneSummary";
import type { CharacterDetailResponse, MomentSummary } from "@/lib/types";
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
    summary.characterNames.length > 0 ||
    summary.songTitles.length > 0 ||
    summary.propMomentCount > 0
  );
}

export interface TimelineMomentListProps {
  /** Flat list — used when there is a single section or no section headers needed. */
  moments?: MomentSummary[];
  /** Multi-scene sections with headers. Takes precedence over `moments` when provided. */
  sections?: TimelineSection[];
  characters: CharacterDetailResponse[];
  selectedMomentId: number | null;
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
}

const MOBILE_VISIBLE_PREP_BADGES = 2;

type PrepBadgeDescriptor = {
  label: string;
};

function buildPrepBadgeDescriptors(moment: MomentSummary): PrepBadgeDescriptor[] {
  const badges: PrepBadgeDescriptor[] = [];
  if (moment.has_props) badges.push({ label: "Prop" });
  if (moment.has_cues) badges.push({ label: "Cue" });
  if (moment.has_set_piece) badges.push({ label: "Set" });
  if (moment.has_costume) badges.push({ label: "Costume" });
  if (moment.has_entrance) badges.push({ label: "Entrance" });
  if (moment.has_exit) badges.push({ label: "Exit" });
  if (moment.has_blocking) badges.push({ label: "Blocking" });
  return badges;
}

function speakingCharacterName(
  moment: MomentSummary,
  characters: CharacterDetailResponse[],
): string | null {
  // Dialogue and lyrics share the same “who performs this line” column.
  // Attribution rows keep the singer name in the body (the attribution Moment itself).
  if (
    (moment.moment_type !== "dialogue" && moment.moment_type !== "lyric") ||
    moment.speaking_character_ids.length === 0
  ) {
    return null;
  }
  const names = moment.speaking_character_ids
    .map((id) => characters.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
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
  selectedMomentId,
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
  selectedMomentId: number | null;
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
  const speaker = speakingCharacterName(moment, characters);
  const prepBadges = showPrepBadges ? buildPrepBadgeDescriptors(moment) : [];
  const hiddenPrepBadges = prepBadges.slice(MOBILE_VISIBLE_PREP_BADGES);
  const highlighted = isHighlighted(moment);
  const selected = selectedMomentId === moment.id;
  const shouldBlur = blurMyLines && isMyLine?.(moment);
  const revealed = revealedBlurLineId === moment.id;

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
      className={momentHighlightRowClass(highlighted, selected)}
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

      {showSequenceNumbers && (
        <span className="w-8 shrink-0 self-start font-mono text-xs text-muted-foreground">
          {moment.sequence_number}
        </span>
      )}
      {speaker && (
        <span
          className="w-24 shrink-0 self-start truncate font-medium text-muted-foreground"
          title={speaker}
        >
          {speaker}
        </span>
      )}
      <span
        className={cn(
          "min-w-0 flex-1 self-stretch whitespace-pre-wrap break-words leading-relaxed",
          moment.moment_type === "stage_direction" && "italic text-muted-foreground",
          momentTextBlurClass(!!shouldBlur, revealed),
        )}
      >
        {moment.moment_type === "dialogue" && speaker
          ? moment.display_text.replace(/^[^:]+:\s*/, "")
          : moment.display_text}
      </span>

      <div
        className="flex shrink-0 flex-wrap justify-end gap-1 self-start max-sm:flex-nowrap"
        onClick={(event) => event.stopPropagation()}
      >
        {prepBadges.map((badge, index) => (
          <Badge
            key={badge.label}
            variant="outline"
            className={cn("text-xs", index >= MOBILE_VISIBLE_PREP_BADGES && "max-sm:hidden")}
          >
            {badge.label}
          </Badge>
        ))}
        {hiddenPrepBadges.length > 0 && (
          <Badge
            variant="outline"
            className="text-xs sm:hidden"
            title={hiddenPrepBadges.map((badge) => badge.label).join(", ")}
          >
            +{hiddenPrepBadges.length}
          </Badge>
        )}
        {showTypeBadge && (
          <Badge className={cn("capitalize", momentBadgeClass(moment.moment_type))}>
            {momentTypeLabel(moment.moment_type)}
          </Badge>
        )}
      </div>

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
  selectedMomentId,
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
}: TimelineMomentListProps) {
  const [revealedBlurLineId, setRevealedBlurLineId] = useState<number | null>(null);
  const [blurRevealMode, setBlurRevealMode] = useState<"hover" | "tap" | null>(null);

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

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-border">
      {resolvedSections.map((section) => (
        <Fragment key={section.sceneId || "flat"}>
          {showHeaders && section.label ? (
            <li className="sticky top-0 z-10 list-none border-b border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </li>
          ) : null}
          {sectionHasSummary(section.summary) ? (
            <li className="list-none border-b border-border bg-background px-3 py-2">
              <SceneSummaryStrip summary={section.summary!} />
            </li>
          ) : null}
          {section.moments
            // Lyrics already show the singer in the speaker column; attribution
            // rows are kept in the script data but hidden so they don't look
            // like an empty "singer with no lyrics" line.
            .filter((moment) => moment.moment_type !== "song_attribution")
            .map((moment, index, visibleMoments) => (
            <li key={moment.id}>
              <MomentRow
                moment={moment}
                index={index}
                sectionLength={visibleMoments.length}
                sceneId={section.sceneId}
                characters={characters}
                selectedMomentId={selectedMomentId}
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
  );
}
