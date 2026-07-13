import { useTheme, type ThemePreference } from "@/context/ThemeContext";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
  { value: "color", label: "Color" },
];

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();

  if (compact) {
    return (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Color mode</span>
        <div className="flex gap-1">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={preference === option.value}
              onClick={() => setPreference(option.value)}
              className={
                preference === option.value
                  ? "rounded px-2 py-1 text-xs bg-primary text-primary-foreground"
                  : "rounded px-2 py-1 text-xs border border-border hover:bg-muted"
              }
            >
              {option.label}
            </button>
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
          <button
            key={option.value}
            type="button"
            aria-pressed={preference === option.value}
            onClick={() => setPreference(option.value)}
            className={
              preference === option.value
                ? "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                : "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Saved in this browser. Applies across all pages for your account.
      </p>
    </div>
  );
}
