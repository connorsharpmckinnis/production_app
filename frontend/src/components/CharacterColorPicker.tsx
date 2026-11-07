import {
  CHARACTER_COLOR_PRESET_META,
  type CharacterColorPreset,
} from "@/lib/characterColorPrefs";
import { characterColorSwatchClass } from "@/lib/momentStyles";
import { cn } from "@/lib/utils";

interface CharacterColorPickerProps {
  value: CharacterColorPreset | null | undefined;
  onChange: (preset: CharacterColorPreset | null) => void;
  /** Compact for dense lists (e.g. character filter). */
  size?: "sm" | "md";
  className?: string;
  /** Extra label for screen readers (character name). */
  label?: string;
}

/**
 * Preset highlighter swatches for personal character colors.
 * Reusable anywhere a character id is shown (Timeline filter, character detail, etc.).
 */
export default function CharacterColorPicker({
  value,
  onChange,
  size = "md",
  className,
  label,
}: CharacterColorPickerProps) {
  const swatchSize = size === "sm" ? "size-4" : "size-5";
  const name = label?.trim() || "character";

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      role="group"
      aria-label={`Highlight color for ${name}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {CHARACTER_COLOR_PRESET_META.map((preset) => {
        const selected = value === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            aria-label={`${preset.label}${selected ? " (selected)" : ""}`}
            aria-pressed={selected}
            className={cn(
              // Crisp edge: solid 1px outline beats soft shadow (which reads as blur).
              "rounded-full border border-foreground/35 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              swatchSize,
              characterColorSwatchClass(preset.id),
              selected && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
            )}
            onClick={() => onChange(selected ? null : preset.id)}
          />
        );
      })}
      {value != null && (
        <button
          type="button"
          className="ml-0.5 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
