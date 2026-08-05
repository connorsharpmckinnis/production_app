import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
          <h2 className="text-sm font-medium">Overview messages (spotlight)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Soft rotating scripture, quotes, and greetings for this show&apos;s Overview page.
            For durable reminders with a bell inbox, banners, or CTAs, use{" "}
            <span className="font-medium text-foreground">Announcements</span> below — not this
            spotlight editor.
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
                <RadioGroup
                  value={rotationMode}
                  onValueChange={(value) =>
                    setRotationMode(value as "inherit" | "off" | "custom")
                  }
                  className="flex flex-wrap items-center gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="inherit" id="rotation-inherit" />
                    <Label htmlFor="rotation-inherit" className="font-normal">
                      Inherit global
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="off" id="rotation-off" />
                    <Label htmlFor="rotation-off" className="font-normal">
                      Off (0)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="rotation-custom" />
                    <Label htmlFor="rotation-custom" className="font-normal">
                      Custom
                    </Label>
                  </div>
                  {rotationMode === "custom" && (
                    <Input
                      type="number"
                      min={ROTATION_MIN_SECONDS}
                      max={ROTATION_MAX_SECONDS}
                      value={customSeconds}
                      onChange={(e) => setCustomSeconds(e.target.value)}
                      className="h-8 w-24"
                      aria-label="Custom rotation seconds"
                    />
                  )}
                </RadioGroup>
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
                          <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                            <Checkbox
                              checked={item.active}
                              onCheckedChange={(value) =>
                                updateDraft(item.key, { active: value === true })
                              }
                            />
                            Active
                          </Label>
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
                        <div className="space-y-1 text-sm">
                          <Label className="text-muted-foreground">Kind</Label>
                          <Select
                            value={item.kind}
                            onValueChange={(value) =>
                              updateDraft(item.key, {
                                kind: value as OverviewMessageKind,
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="announcement">Announcement</SelectItem>
                              <SelectItem value="scripture">Scripture</SelectItem>
                              <SelectItem value="encouragement">Quote</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1 text-sm">
                          <Label className="text-muted-foreground">
                            {item.kind === "scripture" ? "Citation" : "Title (optional)"}
                          </Label>
                          <Input
                            value={item.title}
                            onChange={(e) => updateDraft(item.key, { title: e.target.value })}
                            placeholder={
                              item.kind === "scripture"
                                ? "e.g. Philippians 4:13"
                                : "Optional title"
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-sm">
                        <Label className="text-muted-foreground">Body</Label>
                        <Textarea
                          value={item.body}
                          onChange={(e) => updateDraft(item.key, { body: e.target.value })}
                          rows={2}
                        />
                      </div>
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
                  Add spotlight message
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
