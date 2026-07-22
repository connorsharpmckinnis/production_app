import { Button } from "@/components/ui/button";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
  { value: "color", label: "Warm" },
  { value: "footlights", label: "Stage" },
];

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();

  if (compact) {
    return (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Color mode</span>
        <div className="flex flex-wrap gap-1">
          {OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="xs"
              variant={preference === option.value ? "default" : "outline"}
              aria-pressed={preference === option.value}
              onClick={() => setPreference(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">Color mode</span>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={preference === option.value ? "default" : "outline"}
            aria-pressed={preference === option.value}
            onClick={() => setPreference(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Warm and Stage follow your system light/dark. Saved in this browser.
      </p>
    </div>
  );
}
