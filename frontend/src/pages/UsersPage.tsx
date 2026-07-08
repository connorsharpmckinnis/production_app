import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { AppRole, UserResponse } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

const ROLES: AppRole[] = ["Admin", "Director", "Actor"];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    email: "",
    role_name: "Actor" as AppRole,
  });

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
      setShowCreateForm(false);
      setCreateForm({
        username: "",
        password: "",
        first_name: "",
        last_name: "",
        email: "",
        role_name: "Actor",
      });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to create user");
    }
  }

  async function handleResetPassword(userId: number) {
    if (!newPassword) {
      setError("Enter a new password.");
      return;
    }

    setError(null);
    try {
      await api.resetPassword(userId, { password: newPassword });
      setResetUserId(null);
      setNewPassword("");
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to reset password");
    }
  }

  async function handleDeactivate(userId: number) {
    if (!confirm("Deactivate this user?")) return;

    setError(null);
    try {
      await api.deactivateUser(userId);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Failed to deactivate user");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage user accounts</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((show) => !show)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showCreateForm ? "Cancel" : "Create User"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-lg border border-border bg-card p-6 sm:grid-cols-2"
        >
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
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create User
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading users…</p>
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
                    <span
                      className={
                        user.is_active
                          ? "text-green-700 dark:text-green-400"
                          : "text-muted-foreground"
                      }
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {resetUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="rounded-md border border-input px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => void handleResetPassword(user.id)}
                            className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetUserId(null);
                              setNewPassword("");
                            }}
                            className="rounded-md border border-border px-2 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setResetUserId(user.id)}
                            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                          >
                            Reset password
                          </button>
                          {user.is_active && user.id !== currentUser?.id && (
                            <button
                              type="button"
                              onClick={() => void handleDeactivate(user.id)}
                              className="rounded-md border border-destructive/30 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                            >
                              Deactivate
                            </button>
                          )}
                        </>
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
