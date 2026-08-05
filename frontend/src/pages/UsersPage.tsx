import { useEffect, useState, type FormEvent } from "react";
import { Circle, KeyRound, UserX } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
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
        setError(formatApiError(err, "Failed to load users"));
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
      toast.error(formatApiError(err, "Failed to create user"));
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
      toast.error(formatApiError(err, "Failed to reset password"));
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
      toast.error(formatApiError(err, "Failed to deactivate user"));
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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Dialog open={createDialogOpen} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Add a new user account to the system.</DialogDescription>
          </DialogHeader>
          <form id="create-user-form" onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                required
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                required
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                required
                value={createForm.first_name}
                onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input
                required
                value={createForm.last_name}
                onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={createForm.role_name}
                onValueChange={(value) =>
                  setCreateForm({ ...createForm, role_name: value as AppRole })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
        <CatalogPageSkeleton showBreadcrumb={false} />
      ) : users.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Create a user account to get started."
          actionLabel="Create User"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table storageKey="users">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.username}</TableCell>
                  <TableCell>{user.roles.join(", ")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.is_active ? "success" : "outline"}
                      className="gap-1.5"
                    >
                      <Circle
                        className={
                          user.is_active
                            ? "fill-current"
                            : "fill-muted-foreground text-muted-foreground"
                        }
                        aria-hidden
                      />
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
