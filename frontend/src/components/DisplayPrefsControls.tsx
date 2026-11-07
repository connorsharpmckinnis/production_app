import { Button } from "@/components/ui/button";
import { useDisplayPrefs } from "@/context/DisplayPrefsContext";
import {
  SCRIPT_SIZE_OPTIONS,
  TIMELINE_ROW_PADDING_OPTIONS,
  UI_TEXT_SCALE_OPTIONS,
} from "@/lib/displayPrefs";

export default function DisplayPrefsControls({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { prefs, setScriptSizePx, setTimelineRowPadding, setUiTextScale } =
    useDisplayPrefs();
  const buttonSize = compact ? "xs" : "sm";

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {!compact && <h2 className="text-sm font-medium">Reading density</h2>}

      <div className="space-y-1.5">
        <span
          className={
            compact
              ? "text-xs font-medium text-muted-foreground"
              : "block text-sm font-medium"
          }
        >
          Timeline script
        </span>
        <div className="flex flex-wrap gap-1">
          {SCRIPT_SIZE_OPTIONS.map((size) => (
            <Button
              key={size}
              type="button"
              size={buttonSize}
              variant={prefs.scriptSizePx === size ? "default" : "outline"}
              aria-pressed={prefs.scriptSizePx === size}
              onClick={() => setScriptSizePx(size)}
            >
              {size}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span
          className={
            compact
              ? "text-xs font-medium text-muted-foreground"
              : "block text-sm font-medium"
          }
        >
          Timeline spacing
        </span>
        <div className="flex flex-wrap gap-1">
          {TIMELINE_ROW_PADDING_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size={buttonSize}
              variant={prefs.timelineRowPadding === option.value ? "default" : "outline"}
              aria-pressed={prefs.timelineRowPadding === option.value}
              onClick={() => setTimelineRowPadding(option.value)}
              title={option.description}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span
          className={
            compact
              ? "text-xs font-medium text-muted-foreground"
              : "block text-sm font-medium"
          }
        >
          Interface text
        </span>
        <div className="flex flex-wrap gap-1">
          {UI_TEXT_SCALE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size={buttonSize}
              variant={prefs.uiTextScale === option.value ? "default" : "outline"}
              aria-pressed={prefs.uiTextScale === option.value}
              onClick={() => setUiTextScale(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
