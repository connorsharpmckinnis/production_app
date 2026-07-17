import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import {
  bandLabel,
  ENCOURAGEMENT_BANDS,
  isValidRotationSeconds,
  ROTATION_MAX_SECONDS,
  ROTATION_MIN_SECONDS,
} from "@/lib/overviewSpotlight";
import type { AppSettingsResponse, OverviewMessageDefaultResponse } from "@/lib/types";

type DefaultDraft = {
  band: string;
  title: string;
  body: string;
  active: boolean;
};

function draftsFromDefaults(defaults: OverviewMessageDefaultResponse[]): DefaultDraft[] {
  return ENCOURAGEMENT_BANDS.map((band) => {
    const match = defaults.find((item) => item.band === band);
    return {
      band,
      title: match?.title ?? "",
      body: match?.body ?? "",
      active: match?.active ?? true,
    };
  });
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<AppSettingsResponse | null>(null);
  const [defaults, setDefaults] = useState<DefaultDraft[]>([]);
  const [rotationInput, setRotationInput] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    setError(null);
    try {
      const [settingsData, defaultsData] = await Promise.all([
        api.getAppSettings(),
        api.getOverviewMessageDefaults(),
      ]);
      setSettings(settingsData);
      setRotationInput(String(settingsData.default_message_rotation_seconds));
      setDefaults(draftsFromDefaults(defaultsData));
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function handleToggle(
    field: "show_original_text" | "show_parsed_text",
    value: boolean,
  ) {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await api.updateAppSettings({ [field]: value });
      setSettings(updated);
      toast.success("Settings updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRotation() {
    if (!settings) return;
    const value = Number(rotationInput);
    if (!Number.isInteger(value) || !isValidRotationSeconds(value)) {
      toast.error(
        `Rotation must be 0 (off) or ${ROTATION_MIN_SECONDS}–${ROTATION_MAX_SECONDS} seconds.`,
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateAppSettings({
        default_message_rotation_seconds: value,
      });
      setSettings(updated);
      setRotationInput(String(updated.default_message_rotation_seconds));
      toast.success("Default rotation saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to save rotation");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(band: string, patch: Partial<DefaultDraft>) {
    setDefaults((current) =>
      current.map((item) => (item.band === band ? { ...item, ...patch } : item)),
    );
  }

  async function handleSaveDefaults() {
    const missing = defaults.find((item) => !item.body.trim());
    if (missing) {
      toast.error(`Encouragement for ${bandLabel(missing.band)} needs a message body.`);
      return;
    }

    setSavingDefaults(true);
    try {
      const saved = await api.replaceOverviewMessageDefaults(
        defaults.map((item, index) => ({
          band: item.band,
          title: item.title.trim() || null,
          body: item.body.trim(),
          sort_order: index,
          active: item.active,
        })),
      );
      setDefaults(draftsFromDefaults(saved));
      toast.success("Encouragement defaults saved");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? String(err.detail) : "Failed to save encouragement defaults",
      );
    } finally {
      setSavingDefaults(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-10">
      <div>
        <Link to="/productions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Productions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">App Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global display options and Overview encouragement defaults for all productions.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {settings && (
        <section className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Display</h2>
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
        </section>
      )}

      {settings && (
        <section className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <h2 className="text-sm font-medium">Overview message rotation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Default seconds between spotlight messages. Use 0 to keep the first message only.
              Productions can override this.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Seconds</span>
              <input
                type="number"
                min={0}
                max={ROTATION_MAX_SECONDS}
                value={rotationInput}
                onChange={(e) => setRotationInput(e.target.value)}
                className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <Button type="button" disabled={saving} onClick={() => void handleSaveRotation()}>
              Save rotation
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Allowed: 0 (off) or {ROTATION_MIN_SECONDS}–{ROTATION_MAX_SECONDS}.
          </p>
        </section>
      )}

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-sm font-medium">Encouragement defaults</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One plain-text message per readiness band. Used when a production has no
            matching encouragement of its own. Keep tone friendly — no shame for low scores.
          </p>
        </div>

        <div className="space-y-4">
          {defaults.map((item) => (
            <div key={item.band} className="space-y-2 rounded-md border border-border/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Band {bandLabel(item.band)}</p>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => updateDraft(item.band, { active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <input
                value={item.title}
                onChange={(e) => updateDraft(item.band, { title: e.target.value })}
                placeholder="Optional short title"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={item.body}
                onChange={(e) => updateDraft(item.band, { body: e.target.value })}
                placeholder="Encouragement body"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>

        <Button
          type="button"
          disabled={savingDefaults}
          onClick={() => void handleSaveDefaults()}
        >
          Save encouragement defaults
        </Button>
      </section>

      <div className="rounded-lg border border-border p-4">
        <ThemeToggle />
      </div>
    </div>
  );
}
