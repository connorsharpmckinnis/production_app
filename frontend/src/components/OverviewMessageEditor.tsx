import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import {
  isValidRotationSeconds,
  ROTATION_MAX_SECONDS,
  ROTATION_MIN_SECONDS,
} from "@/lib/overviewSpotlight";
import type {
  OverviewMessageKind,
  ProductionOverviewMessageResponse,
  ProductionOverviewSettingsResponse,
} from "@/lib/types";

type MessageDraft = {
  key: string;
  kind: OverviewMessageKind;
  title: string;
  body: string;
  active: boolean;
};

type RotationMode = "inherit" | "off" | "custom";

interface OverviewMessageEditorProps {
  productionId: number;
  onSaved: () => void;
}

function toDrafts(messages: ProductionOverviewMessageResponse[]): MessageDraft[] {
  return messages.map((message, index) => ({
    key: `existing-${message.id}-${index}`,
    kind: message.kind as OverviewMessageKind,
    title: message.title ?? "",
    body: message.body,
    active: message.active,
  }));
}

function emptyDraft(kind: OverviewMessageKind = "announcement"): MessageDraft {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    title: "",
    body: "",
    active: true,
  };
}

function rotationModeFromSettings(
  settings: ProductionOverviewSettingsResponse | null,
): RotationMode {
  if (!settings || settings.message_rotation_seconds === null) return "inherit";
  if (settings.message_rotation_seconds === 0) return "off";
  return "custom";
}

export default function OverviewMessageEditor({
  productionId,
  onSaved,
}: OverviewMessageEditorProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<MessageDraft[]>([]);
  const [settings, setSettings] = useState<ProductionOverviewSettingsResponse | null>(null);
  const [rotationMode, setRotationMode] = useState<RotationMode>("inherit");
  const [customSeconds, setCustomSeconds] = useState("20");

  async function loadEditor(closeOnError = true) {
    setLoading(true);
    try {
      const [messages, overviewSettings] = await Promise.all([
        api.getProductionOverviewMessages(productionId),
        api.getProductionOverviewSettings(productionId),
      ]);
      setDrafts(toDrafts(messages));
      setSettings(overviewSettings);
      setRotationMode(rotationModeFromSettings(overviewSettings));
      setCustomSeconds(
        String(
          overviewSettings.message_rotation_seconds &&
            overviewSettings.message_rotation_seconds > 0
            ? overviewSettings.message_rotation_seconds
            : overviewSettings.effective_rotation_seconds || 20,
        ),
      );
    } catch (err) {
      toast.error(formatApiError(err, "Failed to load overview messages"));
      if (closeOnError) {
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadEditor();
    }
  }, [open, productionId]);

  function updateDraft(key: string, patch: Partial<MessageDraft>) {
    setDrafts((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeDraft(key: string) {
    setDrafts((current) => current.filter((item) => item.key !== key));
  }

  async function handleSave() {
    const invalid = drafts.find((item) => !item.body.trim());
    if (invalid) {
      toast.error("Each message needs a body.");
      return;
    }

    let rotationValue: number | null = null;
    if (rotationMode === "off") {
      rotationValue = 0;
    } else if (rotationMode === "custom") {
      const parsed = Number(customSeconds);
      if (!Number.isInteger(parsed) || !isValidRotationSeconds(parsed) || parsed === 0) {
        toast.error(
          `Custom rotation must be ${ROTATION_MIN_SECONDS}–${ROTATION_MAX_SECONDS} seconds.`,
        );
        return;
      }
      rotationValue = parsed;
    }

    setSaving(true);
    try {
      let savedMessages: ProductionOverviewMessageResponse[];
      try {
        savedMessages = await api.replaceProductionOverviewMessages(
          productionId,
          drafts.map((item, index) => ({
            kind: item.kind,
            band: null,
            title: item.title.trim() || null,
            body: item.body.trim(),
            sort_order: index,
            active: item.active,
          })),
        );
      } catch (err) {
        toast.error(formatApiError(err, "Failed to save overview messages"));
        return;
      }

      setDrafts(toDrafts(savedMessages));
      try {
        const updatedSettings = await api.updateProductionOverviewSettings(productionId, {
          message_rotation_seconds: rotationValue,
        });
        setSettings(updatedSettings);
      } catch (err) {
        const detail = formatApiError(err, "");
        toast.error(
          detail
            ? `Messages were saved, but rotation failed to save. ${detail}`
            : "Messages were saved, but rotation failed to save.",
        );
        onSaved();
        await loadEditor(false);
        return;
      }

      toast.success("Overview messages saved");
      onSaved();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Overview messages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plain-text announcements, scripture, and quotes for this show. These rotate with
            the global Overview messages on the production Overview page.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
          {open ? "Close editor" : "Edit messages"}
        </Button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading messages…</p>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Rotation</p>
                <p className="text-xs text-muted-foreground">
                  Inherit uses the global default
                  {settings ? ` (currently ${settings.effective_rotation_seconds}s when inheriting)` : ""}.
                  0 turns rotation off.
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rotation-mode"
                      checked={rotationMode === "inherit"}
                      onChange={() => setRotationMode("inherit")}
                    />
                    Inherit global
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rotation-mode"
                      checked={rotationMode === "off"}
                      onChange={() => setRotationMode("off")}
                    />
                    Off (0)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rotation-mode"
                      checked={rotationMode === "custom"}
                      onChange={() => setRotationMode("custom")}
                    />
                    Custom
                  </label>
                  {rotationMode === "custom" && (
                    <input
                      type="number"
                      min={ROTATION_MIN_SECONDS}
                      max={ROTATION_MAX_SECONDS}
                      value={customSeconds}
                      onChange={(e) => setCustomSeconds(e.target.value)}
                      className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      aria-label="Custom rotation seconds"
                    />
                  )}
                </div>
              </div>

              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No production messages yet. Global rotating messages still appear when needed.
                </p>
              ) : (
                <ul className="space-y-3">
                  {drafts.map((item, index) => (
                    <li
                      key={item.key}
                      className="space-y-2 rounded-md border border-border/70 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Message {index + 1}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={item.active}
                              onChange={(e) =>
                                updateDraft(item.key, { active: e.target.checked })
                              }
                            />
                            Active
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeDraft(item.key)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block text-sm">
                          <span className="mb-1 block text-muted-foreground">Kind</span>
                          <select
                            value={item.kind}
                            onChange={(e) =>
                              updateDraft(item.key, {
                                kind: e.target.value as OverviewMessageKind,
                              })
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="announcement">Announcement</option>
                            <option value="scripture">Scripture</option>
                            <option value="encouragement">Quote</option>
                          </select>
                        </label>

                        <label className="block text-sm">
                          <span className="mb-1 block text-muted-foreground">
                            {item.kind === "scripture" ? "Citation" : "Title (optional)"}
                          </span>
                          <input
                            value={item.title}
                            onChange={(e) => updateDraft(item.key, { title: e.target.value })}
                            placeholder={
                              item.kind === "scripture"
                                ? "e.g. Philippians 4:13"
                                : "Optional title"
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">Body</span>
                        <textarea
                          value={item.body}
                          onChange={(e) => updateDraft(item.key, { body: e.target.value })}
                          rows={2}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDrafts((current) => [...current, emptyDraft("announcement")])}
                >
                  Add announcement
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDrafts((current) => [...current, emptyDraft("scripture")])}
                >
                  Add scripture
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDrafts((current) => [...current, emptyDraft("encouragement")])}
                >
                  Add quote
                </Button>
                <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                  Save messages
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
