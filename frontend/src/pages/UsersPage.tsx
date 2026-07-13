import { useEffect, useState, type FormEvent } from "react";
import { Circle, KeyRound, UserX } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
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
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import type { AppRole, UserResponse } from "@/lib/types";

const ROLES: AppRole[] = ["Admin", "Director", "Actor"];

const EMPTY_CREATE_FORM = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  role_name: "Actor" as AppRole,
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);

  const resetUser = users.find((user) => user.id === resetUserId);

  function loadUsers() {
    setLoading(true);
    void api
      .listUsers()
      .then(setUsers)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? String(err.detail) : "Failed to load users");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
  }

  function closeResetDialog() {
    setResetUserId(null);
    setNewPassword("");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await api.createUser({
        username: createForm.username.trim(),
        password: createForm.password,
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email.trim() || null,
        role_name: createForm.role_name,
      });
      closeCreateDialog();
      toast.success("User created");
      loadUsers();
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to create user");
    }
  }

  async function handleResetPassword() {
    if (!resetUserId) return;
    if (!newPassword) {
      toast.error("Enter a new password.");
      return;
    }

    setError(null);
    try {
      await api.resetPassword(resetUserId, { password: newPassword });
      closeResetDialog();
      toast.success("Password reset");
      loadUsers();
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to reset password");
    }
  }

  async function handleDeactivate(userId: number) {
    const ok = await confirm({
      title: "Deactivate this user?",
      description: "They will no longer be able to sign in.",
      confirmLabel: "Deactivate",
      destructive: true,
    });
    if (!ok) return;

    setError(null);
    try {
      await api.deactivateUser(userId);
      toast.success("User deactivated");
      loadUsers();
    } catch (err) {
      toast.error(err instanceof ApiError ? String(err.detail) : "Failed to deactivate user");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage user accounts</p>
        </div>
        <Button type="button" onClick={() => setCreateDialogOpen(true)}>
          Create User
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Add a new user account to the system.</DialogDescription>
          </DialogHeader>
          <form id="create-user-form" onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <input
                required
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                required
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">First name</label>
              <input
                required
                value={createForm.first_name}
                onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last name</label>
              <input
                required
                value={createForm.last_name}
                onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <select
                value={createForm.role_name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, role_name: e.target.value as AppRole })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCreateDialog}>
              Cancel
            </Button>
            <Button type="submit" form="create-user-form">
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetUserId !== null} onOpenChange={(open) => !open && closeResetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resetUser
                ? `Set a new password for ${resetUser.first_name} ${resetUser.last_name} (${resetUser.username}).`
                : "Set a new password for this user."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeResetDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleResetPassword()}>
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-muted-foreground">Loading users…</p>
      ) : users.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Create a user account to get started."
          actionLabel="Create User"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Username</th>
                <th className="px-4 py-3 text-left font-medium">Roles</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.username}</td>
                  <td className="px-4 py-3">{user.roles.join(", ")}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="gap-1.5">
                      <Circle
                        className={
                          user.is_active
                            ? "fill-green-600 text-green-600"
                            : "fill-muted-foreground text-muted-foreground"
                        }
                        aria-hidden
                      />
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setResetUserId(user.id)}
                        aria-label={`Reset password for ${user.username}`}
                        title="Reset password"
                      >
                        <KeyRound />
                      </Button>
                      {user.is_active && user.id !== currentUser?.id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void handleDeactivate(user.id)}
                          aria-label={`Deactivate ${user.username}`}
                          title="Deactivate"
                          className="text-destructive hover:text-destructive"
                        >
                          <UserX />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
