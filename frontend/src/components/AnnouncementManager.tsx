import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import { ROUTE_FILTER_OPTIONS } from "@/lib/notifications";
import type {
  AnnouncementCreate,
  AnnouncementCtaCreate,
  AnnouncementResponse,
  AppRole,
  NotificationSeverity,
} from "@/lib/types";

const ALL_ROLES: AppRole[] = ["Admin", "Director", "Actor"];
const SEVERITIES: NotificationSeverity[] = ["info", "success", "warning", "urgent"];
const ALL_PAGES_VALUE = "__all_pages__";

type Props = {
  /** Null = org-wide (Admin Settings). */
  productionId: number | null;
};

const emptyForm = (): AnnouncementCreate => ({
  title: "",
  body: "",
  severity: "info",
  show_as_banner: false,
  show_as_modal: false,
  audience_roles: [...ALL_ROLES],
  route_filter: null,
  ctas: [],
});

export default function AnnouncementManager({ productionId }: Props) {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const allowModal = isAdmin;

  const [items, setItems] = useState<AnnouncementResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AnnouncementCreate>(() => emptyForm());
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaKind, setCtaKind] = useState<"internal" | "external">("internal");
  const [ctaTarget, setCtaTarget] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data =
        productionId == null
          ? await api.listOrgAnnouncements(true)
          : await api.listProductionAnnouncements(productionId, true);
      setItems(data);
    } catch (err) {
      toast.error(formatApiError(err, "Failed to load announcements"));
    } finally {
      setLoading(false);
    }
  }, [productionId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleRole(role: AppRole) {
    setForm((prev) => {
      const has = prev.audience_roles.includes(role);
      const next = has
        ? prev.audience_roles.filter((r) => r !== role)
        : [...prev.audience_roles, role];
      return { ...prev, audience_roles: next.length > 0 ? next : prev.audience_roles };
    });
  }

  function addCta() {
    if (!ctaLabel.trim() || !ctaTarget.trim()) {
      toast.error("CTA needs a label and target");
      return;
    }
    const next: AnnouncementCtaCreate = {
      label: ctaLabel.trim(),
      kind: ctaKind,
      target: ctaTarget.trim(),
      style: "primary",
      sort_order: form.ctas?.length ?? 0,
    };
    setForm((prev) => ({ ...prev, ctas: [...(prev.ctas ?? []), next] }));
    setCtaLabel("");
    setCtaTarget("");
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    if (form.audience_roles.length === 0) {
      toast.error("Pick at least one audience role");
      return;
    }
    if (form.show_as_modal && !allowModal) {
      toast.error("Only Admins can create blocking modals");
      return;
    }

    setSaving(true);
    try {
      const payload: AnnouncementCreate = {
        ...form,
        title: form.title.trim(),
        body: form.body.trim(),
        route_filter: form.route_filter || null,
        show_as_modal: allowModal ? Boolean(form.show_as_modal) : false,
      };
      if (productionId == null) {
        await api.createOrgAnnouncement(payload);
      } else {
        await api.createProductionAnnouncement(productionId, payload);
      }
      toast.success("Announcement published");
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to publish announcement"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: number) {
    try {
      await api.deleteAnnouncement(id);
      toast.success("Announcement deactivated");
      await load();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to deactivate"));
    }
  }

  async function handleHardDelete(id: number) {
    const ok = await confirm({
      title: "Delete this announcement permanently?",
      description:
        "It will be removed from Settings. Inbox copies keep their text but lose the live link.",
      confirmLabel: "Delete permanently",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteAnnouncement(id);
      toast.success("Announcement deleted");
      await load();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete announcement"));
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Announcements</h2>
        <Button
          type="button"
          size="sm"
          variant={showForm ? "outline" : "default"}
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? "Cancel" : "New announcement"}
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <Label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Title</span>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              maxLength={255}
            />
          </Label>
          <Label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Body</span>
            <Textarea
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
              rows={4}
            />
          </Label>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-1 text-sm">
              <Label className="text-muted-foreground">Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    severity: value as NotificationSeverity,
                  }))
                }
              >
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 text-sm">
              <Label className="text-muted-foreground">Banner pages</Label>
              <Select
                value={form.route_filter || ALL_PAGES_VALUE}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    route_filter: value === ALL_PAGES_VALUE ? null : value,
                  }))
                }
              >
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUTE_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || "all"} value={opt.value || ALL_PAGES_VALUE}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <Label className="font-normal">
              <Checkbox
                checked={Boolean(form.show_as_banner)}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, show_as_banner: checked === true }))
                }
              />
              Show as banner
            </Label>
            {allowModal && (
              <Label className="font-normal">
                <Checkbox
                  checked={Boolean(form.show_as_modal)}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, show_as_modal: checked === true }))
                  }
                />
                Blocking modal
              </Label>
            )}
          </div>

          <fieldset>
            <legend className="mb-1 text-sm text-muted-foreground">Audience roles</legend>
            <div className="flex flex-wrap gap-3">
              {ALL_ROLES.map((role) => (
                <Label key={role} className="font-normal">
                  <Checkbox
                    checked={form.audience_roles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  {role}
                </Label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <p className="text-sm font-medium">Call-to-action (optional)</p>
            <div className="flex flex-wrap gap-2">
              <Select
                value={ctaKind}
                onValueChange={(value) => setCtaKind(value as "internal" | "external")}
              >
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal path</SelectItem>
                  <SelectItem value="external">External URL</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Button label"
                className="min-w-[8rem] flex-1"
              />
              <Input
                value={ctaTarget}
                onChange={(e) => setCtaTarget(e.target.value)}
                placeholder={
                  ctaKind === "external"
                    ? "https://…"
                    : "/productions/1/timeline?act=1&scene=2&moment=10"
                }
                className="min-w-[12rem] flex-[2]"
              />
              <Button type="button" size="sm" variant="outline" onClick={addCta}>
                Add CTA
              </Button>
            </div>
            {(form.ctas?.length ?? 0) > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {form.ctas?.map((cta, index) => (
                  <li key={`${cta.label}-${index}`} className="flex justify-between gap-2">
                    <span>
                      {cta.label} → {cta.target} ({cta.kind})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-auto px-1 text-xs"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          ctas: (prev.ctas ?? []).filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button type="button" disabled={saving} onClick={() => void handleCreate()}>
            Publish
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading announcements…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.title}
                  {!item.active && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (inactive)
                    </span>
                  )}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.severity}
                  {item.show_as_banner ? " · banner" : ""}
                  {item.show_as_modal ? " · modal" : ""}
                  {" · "}
                  {item.audience_roles.join(", ")}
                </p>
              </div>
              {item.active ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDeactivate(item.id)}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleHardDelete(item.id)}
                >
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
