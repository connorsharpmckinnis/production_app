import { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { FeedbackKind } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const location = useLocation();
  const toast = useToast();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setKind("bug");
    setTitle("");
    setDescription("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      return;
    }

    setSaving(true);
    try {
      const result = await api.submitFeedback({
        kind,
        title: trimmedTitle,
        description: trimmedDescription,
        page_path: location.pathname,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      toast.success(
        kind === "bug" ? "Bug report submitted" : "Idea submitted",
        `Issue #${result.issue_number} created.`,
      );
      handleOpenChange(false);
    } catch (err) {
      toast.error(formatApiError(err, "Could not submit feedback"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Quick notes go straight to the project Issues list. You do not need a GitHub
              account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex gap-2" role="group" aria-label="Feedback type">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm",
                  kind === "bug"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted",
                )}
                onClick={() => setKind("bug")}
              >
                Bug
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm",
                  kind === "idea"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted",
                )}
                onClick={() => setKind("idea")}
              >
                Idea
              </button>
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "bug" ? "Short bug title" : "Short idea title"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={200}
              autoFocus
              required
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                kind === "bug"
                  ? "What went wrong? What were you trying to do?"
                  : "What would you like to see? Why would it help?"
              }
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={8000}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim() || !description.trim()}
            >
              {saving ? "Sending…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
