import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AnnouncementManager from "@/components/AnnouncementManager";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import ThemeToggle from "@/components/ThemeToggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import {
  isValidRotationSeconds,
  ROTATION_MAX_SECONDS,
  ROTATION_MIN_SECONDS,
} from "@/lib/overviewSpotlight";
import type {
  AppSettingsResponse,
  OverviewMessageDefaultResponse,
  ProductionRolePermissionResponse,
} from "@/lib/types";

function linesFromDefaults(defaults: OverviewMessageDefaultResponse[]): string {
  return defaults
    .filter((item) => item.active)
    .map((item) => item.body)
    .join("\n");
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<AppSettingsResponse | null>(null);
  const [quotesText, setQuotesText] = useState("");
  const [rotationInput, setRotationInput] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingQuotes, setSavingQuotes] = useState(false);
  const [permissions, setPermissions] = useState<ProductionRolePermissionResponse[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    setError(null);
    try {
      const [settingsData, defaultsData, permissionData] = await Promise.all([
        api.getAppSettings(),
        api.getOverviewMessageDefaults(),
        api.getProductionRolePermissions(),
      ]);
      setSettings(settingsData);
      setRotationInput(String(settingsData.default_message_rotation_seconds));
      setQuotesText(linesFromDefaults(defaultsData));
      setPermissions(permissionData);
    } catch (err) {
      setError(formatApiError(err, "Failed to load settings"));
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
      toast.error(formatApiError(err, "Failed to update settings"));
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
      toast.error(formatApiError(err, "Failed to save rotation"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveQuotes() {
    const lines = quotesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      toast.error("Add at least one line of text to rotate.");
      return;
    }

    setSavingQuotes(true);
    try {
      const saved = await api.replaceOverviewMessageDefaults(
        lines.map((body, index) => ({
          band: "0",
          title: null,
          body,
          sort_order: index,
          active: true,
        })),
      );
      setQuotesText(linesFromDefaults(saved));
      toast.success("Rotating messages saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save rotating messages"));
    } finally {
      setSavingQuotes(false);
    }
  }

  function togglePermission(
    roleCode: string,
    resource: string,
    action: string,
    enabled: boolean,
  ) {
    setPermissions((current) =>
      current.map((permission) =>
        permission.role_code === roleCode &&
        permission.resource === resource &&
        permission.action === action
          ? { ...permission, enabled }
          : permission,
      ),
    );
  }

  async function handleSavePermissions() {
    setSavingPermissions(true);
    try {
      const saved = await api.updateProductionRolePermissions(
        permissions.map(({ role_code, resource, action, enabled }) => ({
          role_code,
          resource,
          action,
          enabled,
        })),
      );
      setPermissions(saved);
      toast.success("Production permissions saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save production permissions"));
    } finally {
      setSavingPermissions(false);
    }
  }

  if (loading) {
    return <CatalogPageSkeleton variant="block" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/productions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Productions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">App Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global display options, Overview rotating messages, and org-wide announcements.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {settings && (
        <section className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Display</h2>
          <div className="flex items-start gap-3">
            <Switch
              id="show-original-text"
              className="mt-0.5"
              checked={settings.show_original_text}
              disabled={saving}
              onCheckedChange={(value) => void handleToggle("show_original_text", value)}
            />
            <Label htmlFor="show-original-text" className="block items-start font-normal">
              <span className="block text-sm font-medium">Show original text</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                Display imported script text in moment detail panels.
              </span>
            </Label>
          </div>

          <div className="flex items-start gap-3">
            <Switch
              id="show-parsed-text"
              className="mt-0.5"
              checked={settings.show_parsed_text}
              disabled={saving}
              onCheckedChange={(value) => void handleToggle("show_parsed_text", value)}
            />
            <Label htmlFor="show-parsed-text" className="block items-start font-normal">
              <span className="block text-sm font-medium">Show imported text</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                Display imported script text overrides in moment detail panels.
              </span>
            </Label>
          </div>
        </section>
      )}

      {settings && (
        <section className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <h2 className="text-sm font-medium">Overview rotating messages</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One message per line. Every N seconds the Overview spotlight shows the next line.
              Productions can add their own scripture/announcements and override the interval.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="rotation-seconds" className="text-muted-foreground">
                Seconds between lines
              </Label>
              <Input
                id="rotation-seconds"
                type="number"
                min={0}
                max={ROTATION_MAX_SECONDS}
                value={rotationInput}
                onChange={(e) => setRotationInput(e.target.value)}
                className="w-28"
              />
            </div>
            <Button type="button" disabled={saving} onClick={() => void handleSaveRotation()}>
              Save interval
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Allowed: 0 (off — show first line only) or {ROTATION_MIN_SECONDS}–
            {ROTATION_MAX_SECONDS}.
          </p>
          <div className="space-y-2">
            <Label htmlFor="rotating-messages" className="text-muted-foreground">
              Messages (one per line)
            </Label>
            <Textarea
              id="rotating-messages"
              value={quotesText}
              onChange={(e) => setQuotesText(e.target.value)}
              rows={10}
              placeholder={"Blank stage — import a script and let's get rolling.\nGood start — the bones are there."}
              className="leading-relaxed"
            />
          </div>
          <Button
            type="button"
            disabled={savingQuotes}
            onClick={() => void handleSaveQuotes()}
          >
            Save messages
          </Button>
        </section>
      )}

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-sm font-medium">Production role permissions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Changes are global and take effect on the next authorization check for every
            active production membership with the selected role.
          </p>
        </div>
        {permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No permission rows available.</p>
        ) : (
          <>
            <div className="rounded-md border border-border">
              <Table storageKey="production-role-permissions">
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead className="text-center">Read</TableHead>
                    <TableHead className="text-center">Create</TableHead>
                    <TableHead className="text-center">Update</TableHead>
                    <TableHead className="text-center">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(
                    new Map(
                      permissions.map((permission) => [
                        `${permission.role_code}:${permission.resource}`,
                        permission,
                      ]),
                    ).values(),
                  ).map((row) => (
                    <TableRow key={`${row.role_code}:${row.resource}`}>
                      <TableCell className="font-medium">{row.role_name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.resource}</TableCell>
                      {["read", "create", "update", "delete"].map((action) => {
                        const permission = permissions.find(
                          (item) =>
                            item.role_code === row.role_code &&
                            item.resource === row.resource &&
                            item.action === action,
                        );
                        return (
                          <TableCell key={action} className="text-center">
                            {permission ? (
                              <Checkbox
                                checked={permission.enabled}
                                disabled={savingPermissions}
                                aria-label={`${row.role_name} ${row.resource} ${action}`}
                                onCheckedChange={(checked) =>
                                  togglePermission(
                                    row.role_code,
                                    row.resource,
                                    action,
                                    checked === true,
                                  )
                                }
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button
              type="button"
              disabled={savingPermissions}
              onClick={() => void handleSavePermissions()}
            >
              {savingPermissions ? "Saving…" : "Save permissions"}
            </Button>
          </>
        )}
      </section>

      <AnnouncementManager productionId={null} />

      <div className="rounded-lg border border-border p-4">
        <ThemeToggle />
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Developer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review shared UI primitives across theme modes.
        </p>
        <Button type="button" variant="outline" className="mt-3" asChild>
          <Link to="/dev/ui">Open component gallery</Link>
        </Button>
      </div>
    </div>
  );
}
