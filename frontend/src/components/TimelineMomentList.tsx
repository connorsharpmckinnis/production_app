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

function speakingCharacterName(
  moment: MomentSummary,
  characters: CharacterDetailResponse[],
): string | null {
  if (moment.moment_type !== "dialogue" || moment.speaking_character_ids.length === 0) {
    return null;
  }
  const character = characters.find((item) => item.id === moment.speaking_character_ids[0]);
  return character?.name ?? null;
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
        className="flex shrink-0 flex-wrap justify-end gap-1 self-start"
        onClick={(event) => event.stopPropagation()}
      >
        {showPrepBadges && moment.has_props && (
          <Badge variant="outline" className="text-xs">
            Prop
          </Badge>
        )}
        {showPrepBadges && moment.has_cues && (
          <Badge variant="outline" className="text-xs">
            Cue
          </Badge>
        )}
        {showPrepBadges && moment.has_microphone && (
          <Badge variant="outline" className="text-xs">
            Mic
          </Badge>
        )}
        {showPrepBadges && moment.has_set_piece && (
          <Badge variant="outline" className="text-xs">
            Set
          </Badge>
        )}
        {showPrepBadges && moment.has_costume && (
          <Badge variant="outline" className="text-xs">
            Costume
          </Badge>
        )}
        {showPrepBadges && moment.has_entrance && (
          <Badge variant="outline" className="text-xs">
            Entrance
          </Badge>
        )}
        {showPrepBadges && moment.has_exit && (
          <Badge variant="outline" className="text-xs">
            Exit
          </Badge>
        )}
        {showPrepBadges && moment.has_blocking && (
          <Badge variant="outline" className="text-xs">
            Blocking
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
            <li className="sticky top-0 z-10 list-none border-b border-border bg-muted/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
              {section.label}
            </li>
          ) : null}
          {sectionHasSummary(section.summary) ? (
            <li className="list-none border-b border-border bg-background px-3 py-2">
              <SceneSummaryStrip summary={section.summary!} />
            </li>
          ) : null}
          {section.moments.map((moment, index) => (
            <li key={moment.id}>
              <MomentRow
                moment={moment}
                index={index}
                sectionLength={section.moments.length}
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
