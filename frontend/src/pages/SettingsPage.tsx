import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { api, ApiError } from "@/lib/api";
import type { AppSettingsResponse } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    setError(null);
    try {
      const data = await api.getAppSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function handleToggle(field: keyof AppSettingsResponse, value: boolean) {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await api.updateAppSettings({ [field]: value });
      setSettings(updated);
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link to="/productions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Productions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">App Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global display options for moment detail across all productions.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {settings && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.show_original_text}
              disabled={saving}
              onChange={(e) => void handleToggle("show_original_text", e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Show original text</span>
              <span className="block text-sm text-muted-foreground">
                Display imported script text in moment detail panels.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.show_parsed_text}
              disabled={saving}
              onChange={(e) => void handleToggle("show_parsed_text", e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Show imported text</span>
              <span className="block text-sm text-muted-foreground">
                Display imported script text overrides in moment detail panels.
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <ThemeToggle />
      </div>
    </div>
  );
}
