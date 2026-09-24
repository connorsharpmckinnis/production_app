import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REHEARSE_PRESET_LABELS,
  type RehearseDisplayToggles,
  type RehearsePresetId,
} from "@/lib/rehearsePresets";
import { cn } from "@/lib/utils";

interface RehearseModeControlsProps {
  effectivePreset: RehearsePresetId;
  toggles: RehearseDisplayToggles;
  onPresetChange: (preset: Exclude<RehearsePresetId, "custom">) => void;
  onToggleChange: (field: keyof RehearseDisplayToggles, value: boolean) => void;
  className?: string;
}

export default function RehearseModeControls({
  effectivePreset,
  toggles,
  onPresetChange,
  onToggleChange,
  className,
}: RehearseModeControlsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Select
        value={effectivePreset === "custom" ? "custom" : effectivePreset}
        onValueChange={(value) => {
          if (value === "custom") return;
          onPresetChange(value as Exclude<RehearsePresetId, "custom">);
        }}
      >
        <SelectTrigger className="h-8 w-fit" aria-label="Practice preset">
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
            <SelectItem value="custom" disabled title="Adjust toggles to create a custom view">
              Custom
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs sm:text-sm">
        <Label className="flex items-center gap-1.5 font-normal">
          <Checkbox
            checked={toggles.highlightMyLines}
            onCheckedChange={(value) => onToggleChange("highlightMyLines", value === true)}
          />
          Highlight my lines
        </Label>
        <Label className="flex items-center gap-1.5 font-normal">
          <Checkbox
            checked={toggles.showStageDirections}
            onCheckedChange={(value) => onToggleChange("showStageDirections", value === true)}
          />
          Stage directions
        </Label>
        <Label className="flex items-center gap-1.5 font-normal">
          <Checkbox
            checked={toggles.showLyricsAndSongs}
            onCheckedChange={(value) => onToggleChange("showLyricsAndSongs", value === true)}
          />
          Lyrics &amp; songs
        </Label>
        <Label className="flex items-center gap-1.5 font-normal">
          <Checkbox
            checked={toggles.showPrepBadges}
            onCheckedChange={(value) => onToggleChange("showPrepBadges", value === true)}
          />
          Prep badges
        </Label>
        <Label className="flex items-center gap-1.5 font-normal">
          <Checkbox
            checked={toggles.blurMyLines}
            onCheckedChange={(value) => onToggleChange("blurMyLines", value === true)}
          />
          Blur my lines
        </Label>
      </div>
    </div>
  );
}
