import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CharacterDetailResponse, MomentSummary } from "@/lib/types";
import { cn, momentTypeLabel } from "@/lib/utils";
import { momentBadgeClass, momentHighlightRowClass, momentTextBlurClass } from "@/lib/momentStyles";

export interface TimelineMomentListProps {
  moments: MomentSummary[];
  characters: CharacterDetailResponse[];
  selectedMomentId: number | null;
  onSelectMoment: (momentId: number) => void;
  isHighlighted: (moment: MomentSummary) => boolean;
  showPrepBadges?: boolean;
  blurMyLines?: boolean;
  isMyLine?: (moment: MomentSummary) => boolean;
  canManagePreparation?: boolean;
  structuralSaving?: boolean;
  onMoveUp?: (moment: MomentSummary) => void;
  onMoveDown?: (moment: MomentSummary) => void;
  onInsertAfter?: (sequenceNumber: number) => void;
  onDelete?: (momentId: number) => void;
  insertAfterSequence?: number | null;
  insertFormSlot?: (sequenceNumber: number) => React.ReactNode;
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

export default function TimelineMomentList({
  moments,
  characters,
  selectedMomentId,
  onSelectMoment,
  isHighlighted,
  showPrepBadges = true,
  blurMyLines = false,
  isMyLine,
  canManagePreparation = false,
  structuralSaving = false,
  onMoveUp,
  onMoveDown,
  onInsertAfter,
  onDelete,
  insertAfterSequence,
  insertFormSlot,
  footerSlot,
}: TimelineMomentListProps) {
  const [revealedBlurLineId, setRevealedBlurLineId] = useState<number | null>(null);
  const [blurRevealMode, setBlurRevealMode] = useState<"hover" | "tap" | null>(null);

  function handleRowKeyDown(event: React.KeyboardEvent, momentId: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectMoment(momentId);
    }
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-border">
      {moments.map((moment, index) => {
        const speaker = speakingCharacterName(moment, characters);
        const highlighted = isHighlighted(moment);
        const selected = selectedMomentId === moment.id;
        const shouldBlur = blurMyLines && isMyLine?.(moment);
        const revealed = revealedBlurLineId === moment.id;

        return (
          <li key={moment.id}>
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
              onKeyDown={(event) => handleRowKeyDown(event, moment.id)}
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
              {canManagePreparation && (
                <div
                  className="flex shrink-0 flex-col gap-0.5 self-start pt-0.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={structuralSaving || index === 0}
                    onClick={() => onMoveUp?.(moment)}
                    aria-label="Move up"
                    title="Move up"
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={structuralSaving || index === moments.length - 1}
                    onClick={() => onMoveDown?.(moment)}
                    aria-label="Move down"
                    title="Move down"
                  >
                    <ChevronDown />
                  </Button>
                </div>
              )}

              <span className="w-8 shrink-0 self-start font-mono text-xs text-muted-foreground">
                {moment.sequence_number}
              </span>
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
                <Badge className={cn("capitalize", momentBadgeClass(moment.moment_type))}>
                  {momentTypeLabel(moment.moment_type)}
                </Badge>
              </div>

              {canManagePreparation && (
                <div
                  className="flex shrink-0 flex-col gap-1 self-start"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={structuralSaving}
                    onClick={() => onInsertAfter?.(moment.sequence_number)}
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

            {insertFormSlot && insertAfterSequence === moment.sequence_number && (
              <div onClick={(event) => event.stopPropagation()}>
                {insertFormSlot(moment.sequence_number)}
              </div>
            )}
          </li>
        );
      })}
      {footerSlot}
    </ul>
  );
}
