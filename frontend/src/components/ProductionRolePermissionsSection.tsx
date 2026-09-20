import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
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
import type {
  ProductionRoleDetail,
  ProductionRolePermissionResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIONS = ["read", "create", "update", "delete"] as const;

const EXTRA_ACTIONS: Record<string, { action: string; label: string }[]> = {
  timeline: [
    { action: "suggest", label: "Suggest" },
    { action: "approve", label: "Approve" },
  ],
  notes: [{ action: "publish", label: "Publish" }],
};

const RESOURCE_GROUPS: { id: string; label: string; resources: string[] }[] = [
  {
    id: "access",
    label: "Access & people",
    resources: ["production", "overview", "people"],
  },
  {
    id: "script",
    label: "Script & preparation",
    resources: ["timeline", "characters", "casting", "groups", "songs"],
  },
  {
    id: "catalogs",
    label: "Catalogs",
    resources: ["props", "costumes", "set_pieces"],
  },
  {
    id: "tech",
    label: "Tech & cues",
    resources: ["lav_chart", "cue_categories", "cues"],
  },
  {
    id: "collab",
    label: "Notes & communication",
    resources: ["notes", "tasks", "bookmarks", "announcements", "notifications"],
  },
  {
    id: "rehearsal",
    label: "Rehearsal & reports",
    resources: ["rehearse", "rehearsals", "reports"],
  },
];

type PanelMode = "none" | "view" | "create";

type Props = {
  permissions: ProductionRolePermissionResponse[];
  onPermissionsChange: (next: ProductionRolePermissionResponse[]) => void;
};

export default function ProductionRolePermissionsSection({
  permissions,
  onPermissionsChange,
}: Props) {
  const toast = useToast();
  const [roles, setRoles] = useState<ProductionRoleDetail[]>([]);
  const [panelMode, setPanelMode] = useState<PanelMode>("none");
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(RESOURCE_GROUPS.map((group) => [group.id, true])),
  );
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [copyFromRoleCode, setCopyFromRoleCode] = useState("director");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const roleOptions = useMemo(() => {
    const fromApi = new Map(roles.map((role) => [role.code, role]));
    for (const permission of permissions) {
      if (!fromApi.has(permission.role_code)) {
        fromApi.set(permission.role_code, {
          code: permission.role_code,
          name: permission.role_name,
          description: null,
          is_active: true,
          is_system: ["member", "director", "actor"].includes(permission.role_code),
        });
      }
    }
    return Array.from(fromApi.values()).sort((a, b) =>
      a.name.localeCompare(b.name) || a.code.localeCompare(b.code),
    );
  }, [roles, permissions]);

  const selectedRole =
    panelMode === "view"
      ? (roleOptions.find((role) => role.code === selectedRoleCode) ?? null)
      : null;

  const selectedRows = useMemo(() => {
    if (panelMode !== "view" || !selectedRoleCode) return [];
    const byResource = new Map<string, ProductionRolePermissionResponse>();
    for (const permission of permissions) {
      if (permission.role_code !== selectedRoleCode) continue;
      if (!byResource.has(permission.resource)) {
        byResource.set(permission.resource, permission);
      }
    }
    return Array.from(byResource.values());
  }, [permissions, selectedRoleCode, panelMode]);

  async function reloadRoles() {
    const nextRoles = await api.listProductionRoleDefinitions();
    setRoles(nextRoles);
    return nextRoles;
  }

  useEffect(() => {
    void (async () => {
      try {
        await reloadRoles();
      } catch (err) {
        toast.error(formatApiError(err, "Failed to load production roles"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRole) {
      setEditName("");
      setEditDescription("");
      return;
    }
    setEditName(selectedRole.name);
    setEditDescription(selectedRole.description ?? "");
  }, [selectedRole]);

  function resetCreateForm() {
    setNewRoleName("");
    setNewRoleDescription("");
    setNewRoleCode("");
    setCopyFromRoleCode("director");
  }

  function openCreatePanel() {
    setPanelMode("create");
    setSelectedRoleCode("");
    setEditingDetails(false);
    resetCreateForm();
  }

  function openViewPanel(roleCode: string) {
    setPanelMode("view");
    setSelectedRoleCode(roleCode);
    setEditingDetails(false);
  }

  function closePanel() {
    setPanelMode("none");
    setSelectedRoleCode("");
    setEditingDetails(false);
    resetCreateForm();
  }

  function cancelEditingDetails() {
    if (selectedRole) {
      setEditName(selectedRole.name);
      setEditDescription(selectedRole.description ?? "");
    }
    setEditingDetails(false);
  }

  function togglePermission(resource: string, action: string, enabled: boolean) {
    if (!selectedRoleCode) return;
    onPermissionsChange(
      permissions.map((permission) =>
        permission.role_code === selectedRoleCode &&
        permission.resource === resource &&
        permission.action === action
          ? { ...permission, enabled }
          : permission,
      ),
    );
  }

  async function handleSavePermissions() {
    if (!selectedRoleCode) return;
    setSavingPermissions(true);
    try {
      const payload = permissions
        .filter((permission) => permission.role_code === selectedRoleCode)
        .map(({ role_code, resource, action, enabled }) => ({
          role_code,
          resource,
          action,
          enabled,
        }));
      const saved = await api.updateProductionRolePermissions(payload);
      onPermissionsChange(saved);
      toast.success("Production permissions saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save production permissions"));
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleCreateRole() {
    const name = newRoleName.trim();
    if (!name) {
      toast.error("Role name is required");
      return;
    }
    setCreatingRole(true);
    try {
      const created = await api.createProductionRole({
        name,
        description: newRoleDescription.trim() || null,
        code: newRoleCode.trim() || null,
        copy_from_role_code: copyFromRoleCode,
      });
      const refreshed = await api.getProductionRolePermissions();
      onPermissionsChange(refreshed);
      await reloadRoles();
      resetCreateForm();
      openViewPanel(created.code);
      toast.success(`Created role “${created.name}”`);
    } catch (err) {
      toast.error(formatApiError(err, "Failed to create role"));
    } finally {
      setCreatingRole(false);
    }
  }

  async function handleSaveRoleDetails() {
    if (!selectedRole) return;
    setUpdatingRole(true);
    try {
      const updated = await api.updateProductionRole(selectedRole.code, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setRoles((current) =>
        current.map((role) => (role.code === updated.code ? updated : role)),
      );
      onPermissionsChange(
        permissions.map((permission) =>
          permission.role_code === updated.code
            ? { ...permission, role_name: updated.name }
            : permission,
        ),
      );
      setEditingDetails(false);
      toast.success("Role details saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to update role"));
    } finally {
      setUpdatingRole(false);
    }
  }

  async function handleToggleActive() {
    if (!selectedRole || selectedRole.is_system) return;
    const nextActive = !selectedRole.is_active;
    setUpdatingRole(true);
    try {
      const updated = await api.updateProductionRole(selectedRole.code, {
        is_active: nextActive,
      });
      setRoles((current) =>
        current.map((role) => (role.code === updated.code ? updated : role)),
      );
      toast.success(nextActive ? "Role reactivated" : "Role deactivated");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to update role status"));
    } finally {
      setUpdatingRole(false);
    }
  }

  function toggleGroup(groupId: string) {
    setExpandedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium">Production roles & permissions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create org-wide production roles and edit what each role can do. Changes apply
          on the next authorization check for every active membership with that role.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="selected-production-role">Existing role</Label>
          <Select
            value={panelMode === "view" ? selectedRoleCode || undefined : undefined}
            onValueChange={openViewPanel}
          >
            <SelectTrigger id="selected-production-role" className="min-w-56">
              <SelectValue placeholder="Choose a role to view…" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((role) => (
                <SelectItem key={role.code} value={role.code}>
                  {role.name}
                  {!role.is_active ? " (inactive)" : ""}
                  {role.is_system ? "" : " · custom"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {panelMode === "create" ? (
          <Button type="button" variant="outline" onClick={closePanel}>
            Cancel create
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={openCreatePanel}>
            Create new role
          </Button>
        )}
        {panelMode === "view" && (
          <Button type="button" variant="ghost" onClick={closePanel}>
            Close
          </Button>
        )}
      </div>

      {panelMode === "none" && (
        <p className="text-sm text-muted-foreground">
          Choose an existing role to review its details and permissions, or create a new
          role.
        </p>
      )}

      {panelMode === "create" && (
        <div className="space-y-3 rounded-md border border-border border-dashed bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-medium">Create new role</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              New roles start with a copy of another role’s current permission matrix.
              For Stage Manager, copy from Director and then tighten if needed.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-role-name">Name</Label>
              <Input
                id="new-role-name"
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder="Stage Manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role-code">Code (optional)</Label>
              <Input
                id="new-role-code"
                value={newRoleCode}
                onChange={(event) => setNewRoleCode(event.target.value)}
                placeholder="stage_manager"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-role-description">Description (optional)</Label>
            <Input
              id="new-role-description"
              value={newRoleDescription}
              onChange={(event) => setNewRoleDescription(event.target.value)}
              placeholder="Runs rehearsals and production prep without Admin powers"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="copy-from-role">Copy permissions from</Label>
            <Select value={copyFromRoleCode} onValueChange={setCopyFromRoleCode}>
              <SelectTrigger id="copy-from-role" className="min-w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions
                  .filter((role) => role.is_active)
                  .map((role) => (
                    <SelectItem key={role.code} value={role.code}>
                      {role.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={creatingRole}
              onClick={() => void handleCreateRole()}
            >
              {creatingRole ? "Creating…" : "Create role"}
            </Button>
            <Button type="button" variant="outline" disabled={creatingRole} onClick={closePanel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {panelMode === "view" && selectedRole && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-md border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">
                  {selectedRole.name}
                  {!selectedRole.is_active ? " (inactive)" : ""}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {selectedRole.code}
                  {selectedRole.is_system ? " · system role" : " · custom role"}
                </p>
              </div>
              {!editingDetails && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingDetails(true)}
                >
                  Edit details
                </Button>
              )}
            </div>

            {editingDetails ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-role-name">Display name</Label>
                    <Input
                      id="edit-role-name"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-role-code">Code</Label>
                    <Input
                      id="edit-role-code"
                      value={selectedRole.code}
                      disabled
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role-description">Description</Label>
                  <Input
                    id="edit-role-description"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={updatingRole}
                    onClick={() => void handleSaveRoleDetails()}
                  >
                    Save details
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={updatingRole}
                    onClick={cancelEditingDetails}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Display name</dt>
                  <dd className="font-medium">{selectedRole.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Code</dt>
                  <dd className="font-mono text-xs">{selectedRole.code}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd>{selectedRole.description?.trim() || "—"}</dd>
                </div>
              </dl>
            )}

            {!editingDetails && !selectedRole.is_system && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={updatingRole}
                onClick={() => void handleToggleActive()}
              >
                {selectedRole.is_active ? "Deactivate role" : "Reactivate role"}
              </Button>
            )}
            {selectedRole.is_system && (
              <p className="text-xs text-muted-foreground">
                System roles cannot be deactivated. You can rename the label and edit
                permissions.
              </p>
            )}
          </div>

          {selectedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No permission rows for this role.</p>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-medium">Permissions</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Toggle capabilities for {selectedRole.name}, then save.
                </p>
              </div>
              <div className="space-y-3">
                {RESOURCE_GROUPS.map((group) => {
                  const groupRows = selectedRows.filter((row) =>
                    group.resources.includes(row.resource),
                  );
                  if (groupRows.length === 0) return null;
                  const expanded = expandedGroups[group.id] !== false;
                  return (
                    <div key={group.id} className="rounded-md border border-border">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/40"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={expanded}
                      >
                        <span>{group.label}</span>
                        <ChevronDownIcon
                          className={cn(
                            "size-4 text-muted-foreground transition-transform",
                            expanded ? "rotate-0" : "-rotate-90",
                          )}
                        />
                      </button>
                      {expanded && (
                        <Table storageKey={`production-role-permissions-${group.id}`}>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Resource</TableHead>
                              <TableHead className="text-center">Read</TableHead>
                              <TableHead className="text-center">Create</TableHead>
                              <TableHead className="text-center">Update</TableHead>
                              <TableHead className="text-center">Delete</TableHead>
                              {group.resources.some((resource) => resource === "timeline") && (
                                <>
                                  <TableHead className="text-center">Suggest</TableHead>
                                  <TableHead className="text-center">Approve</TableHead>
                                </>
                              )}
                              {group.resources.some((resource) => resource === "notes") && (
                                <TableHead className="text-center">Publish</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.resources.map((resource) => {
                              const row = groupRows.find(
                                (item) => item.resource === resource,
                              );
                              if (!row) return null;
                              return (
                                <TableRow key={resource}>
                                  <TableCell className="font-mono text-xs">
                                    {resource}
                                  </TableCell>
                                  {ACTIONS.map((action) => {
                                    const permission = permissions.find(
                                      (item) =>
                                        item.role_code === selectedRoleCode &&
                                        item.resource === resource &&
                                        item.action === action,
                                    );
                                    return (
                                      <TableCell key={action} className="text-center">
                                        {permission ? (
                                          <Checkbox
                                            checked={permission.enabled}
                                            disabled={
                                              savingPermissions || !selectedRole.is_active
                                            }
                                            aria-label={`${row.role_name} ${resource} ${action}`}
                                            onCheckedChange={(checked) =>
                                              togglePermission(
                                                resource,
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
                                  {(EXTRA_ACTIONS[resource] ?? []).map((extra) => {
                                    const permission = permissions.find(
                                      (item) =>
                                        item.role_code === selectedRoleCode &&
                                        item.resource === resource &&
                                        item.action === extra.action,
                                    );
                                    return (
                                      <TableCell key={extra.action} className="text-center">
                                        {permission ? (
                                          <Checkbox
                                            checked={permission.enabled}
                                            disabled={
                                              savingPermissions || !selectedRole.is_active
                                            }
                                            aria-label={`${row.role_name} ${resource} ${extra.action}`}
                                            onCheckedChange={(checked) =>
                                              togglePermission(
                                                resource,
                                                extra.action,
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
                                  {group.resources.includes("timeline") &&
                                    resource !== "timeline" && (
                                      <>
                                        <TableCell className="text-center text-muted-foreground">—</TableCell>
                                        <TableCell className="text-center text-muted-foreground">—</TableCell>
                                      </>
                                    )}
                                  {group.resources.includes("notes") && resource !== "notes" && (
                                    <TableCell className="text-center text-muted-foreground">—</TableCell>
                                  )}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                disabled={savingPermissions || !selectedRole.is_active}
                onClick={() => void handleSavePermissions()}
              >
                {savingPermissions ? "Saving…" : "Save permissions"}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
