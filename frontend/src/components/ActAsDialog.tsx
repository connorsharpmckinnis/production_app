import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { UserResponse } from "@/lib/types";

interface ActAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function roleLabel(roles: string[]): string {
  return roles.length > 0 ? roles.join(", ") : "No roles";
}

export default function ActAsDialog({ open, onOpenChange }: ActAsDialogProps) {
  const { user, actAs } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedId("");
    setLoading(true);
    void api
      .listUsers()
      .then((list) => {
        setUsers(list.filter((u) => u.is_active && u.id !== user?.id));
      })
      .catch(() => {
        setUsers([]);
        toast.error("Could not load users.");
      })
      .finally(() => setLoading(false));
  }, [open, user?.id, toast]);

  const options = useMemo(
    () =>
      users.map((u) => ({
        value: String(u.id),
        label: `${u.first_name} ${u.last_name}`,
        hint: roleLabel(u.roles),
        keywords: `${u.username} ${u.roles.join(" ")}`,
      })),
    [users],
  );

  async function handleConfirm() {
    const userId = Number(selectedId);
    if (!Number.isFinite(userId) || userId <= 0) return;
    setSaving(true);
    try {
      await actAs(userId);
      onOpenChange(false);
      toast.success("Now acting as selected user.");
    } catch (err) {
      toast.error(formatApiError(err, "Could not act as that user."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Act as user</DialogTitle>
          <DialogDescription>
            Switch your session to another account to verify their view. A banner
            stays visible until you return to your admin account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other active users.</p>
          ) : (
            <SearchableSelect
              options={options}
              value={selectedId}
              onChange={setSelectedId}
              placeholder="Search by name, username, or role…"
              emptyMessage="No matching users"
            />
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !selectedId}
            onClick={() => void handleConfirm()}
          >
            {saving ? "Switching…" : "Act as"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
