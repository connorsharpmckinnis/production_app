import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useConfirm } from "@/context/ConfirmContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type {
  ProductionMemberCandidateResponse,
  ProductionMemberResponse,
  ProductionRoleSummary,
} from "@/lib/types";

function sortedRoles(codes: string[], roles: ProductionRoleSummary[]): string[] {
  const order = new Map(
    roles.map((role, index) => [role.code, index]),
  );
  return [...new Set(codes)].sort((a, b) => {
    const orderA = order.get(a);
    const orderB = order.get(b);
    if (orderA != null && orderB != null) return orderA - orderB;
    if (orderA != null) return -1;
    if (orderB != null) return 1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}

function RoleCheckboxes({
  selected,
  roles,
  onChange,
  disabled = false,
  idPrefix,
}: {
  selected: string[];
  roles: ProductionRoleSummary[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  function toggle(code: string, checked: boolean | "indeterminate") {
    const next = checked === true
      ? [...new Set([...selected, code])]
      : selected.filter((current) => current !== code);
    onChange(sortedRoles(next, roles));
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {roles.map((role) => {
        const checkboxId = `${idPrefix}-${role.code}`;
        return (
          <label key={role.code} htmlFor={checkboxId} className="flex items-center gap-2 text-sm">
            <Checkbox
              id={checkboxId}
              checked={selected.includes(role.code)}
              disabled={disabled}
              onCheckedChange={(checked) => toggle(role.code, checked)}
            />
            {role.name}
          </label>
        );
      })}
    </div>
  );
}

export default function PeoplePage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { access, loading: accessLoading, error: accessError, hasCapability } =
    useProductionAccess();
  const confirm = useConfirm();
  const toast = useToast();
  const canRead = hasCapability("people", "read");
  const canCreate = hasCapability("people", "create");
  const canUpdate = hasCapability("people", "update");
  const canMutate = canCreate || canUpdate;

  const [people, setPeople] = useState<ProductionMemberResponse[]>([]);
  const [candidates, setCandidates] = useState<ProductionMemberCandidateResponse[]>([]);
  const [roleRegistry, setRoleRegistry] = useState<ProductionRoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [newRoles, setNewRoles] = useState(["member"]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingRoles, setEditingRoles] = useState<string[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function loadData() {
    if (!canRead) {
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const [roster, roles] = await Promise.all([
        api.listProductionPeople(productionId),
        api.listProductionRoles(productionId),
      ]);
      setPeople(roster);
      setRoleRegistry(roles);
      const defaultRole = roles.find((role) => role.code === "member") ?? roles[0];
      if (defaultRole) {
        setNewRoles((current) =>
          current.length > 0 && current.every((code) =>
            roles.some((role) => role.code === code)
          )
            ? current
            : [defaultRole.code],
        );
      }
      if (canCreate) {
        setCandidates(await api.listProductionPeopleCandidates(productionId));
      } else {
        setCandidates([]);
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to load production people."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void loadData();
  }, [productionId, canCreate, canRead]);

  async function handleAdd() {
    const userId = Number(selectedCandidate);
    if (!userId || newRoles.length === 0) {
      toast.error("Choose a person and at least one production role.");
      return;
    }

    setSavingKey(`add-${userId}`);
    try {
      await api.addProductionPerson(productionId, {
        user_id: userId,
        role_codes: newRoles,
      });
      setSelectedCandidate("");
      setNewRoles(["member"]);
      toast.success("Person added to production");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Could not add production member."));
    } finally {
      setSavingKey(null);
    }
  }

  function startEditing(person: ProductionMemberResponse) {
    setEditingUserId(person.user_id);
    const roles = [...roleRegistry];
    for (const assignedRole of person.roles) {
      if (!roles.some((role) => role.code === assignedRole.code)) {
        roles.push(assignedRole);
      }
    }
    setEditingRoles(sortedRoles(person.roles.map((role) => role.code), roles));
  }

  async function saveRoles(userId: number) {
    if (editingRoles.length === 0) {
      toast.error("Choose at least one production role.");
      return;
    }

    setSavingKey(`edit-${userId}`);
    try {
      await api.updateProductionPerson(productionId, userId, {
        role_codes: editingRoles,
      });
      setEditingUserId(null);
      toast.success("Production roles updated");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Could not update production roles."));
    } finally {
      setSavingKey(null);
    }
  }

  async function handleDeactivate(person: ProductionMemberResponse) {
    const confirmed = await confirm({
      title: `Remove ${person.display_name} from this production?`,
      description: "Their production roles will stop granting access. Their casting history will be preserved.",
      confirmLabel: "Deactivate membership",
      destructive: true,
    });
    if (!confirmed) return;

    setSavingKey(`deactivate-${person.user_id}`);
    try {
      await api.deactivateProductionPerson(productionId, person.user_id);
      toast.success("Production membership deactivated");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Could not deactivate membership."));
    } finally {
      setSavingKey(null);
    }
  }

  if (accessLoading || loading) {
    return <CatalogPageSkeleton />;
  }

  if (accessError || !access || !canRead) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {accessError ?? "You do not have access to the production people roster."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          to={`/productions/${productionId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Overview
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">People</h1>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {canCreate && candidates.length > 0 && (
        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <h2 className="text-sm font-medium">Add an existing user</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add someone from this organization and choose one or more production roles.
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-64 space-y-2">
              <label htmlFor="candidate" className="text-sm font-medium">Person</label>
              <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
                <SelectTrigger id="candidate">
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.user_id} value={String(candidate.user_id)}>
                      {candidate.display_name}{candidate.email ? ` — ${candidate.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Production roles</span>
              <RoleCheckboxes
                selected={newRoles}
                roles={roleRegistry}
                onChange={setNewRoles}
                disabled={savingKey != null}
                idPrefix="new-role"
              />
            </div>
            <Button
              type="button"
              disabled={!selectedCandidate || savingKey != null}
              onClick={() => void handleAdd()}
            >
              {savingKey?.startsWith("add-") ? "Adding…" : "Add person"}
            </Button>
          </div>
        </section>
      )}

      {people.length === 0 ? (
        <EmptyState
          title="No active members yet"
          description={
            canCreate
              ? "Add an existing organization user to begin building the production roster."
              : "No active production members are available."
          }
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table storageKey="production-people">
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Production roles</TableHead>
                <TableHead>Assigned characters</TableHead>
                {canMutate && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const editing = editingUserId === person.user_id;
                const busy = savingKey != null;
                return (
                  <TableRow key={person.user_id}>
                    <TableCell>
                      <p className="font-medium">{person.display_name}</p>
                      {person.email && (
                        <p className="text-xs text-muted-foreground">{person.email}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <RoleCheckboxes
                          selected={editingRoles}
                          roles={[
                            ...roleRegistry,
                            ...person.roles.filter(
                              (assignedRole) =>
                                !roleRegistry.some(
                                  (role) => role.code === assignedRole.code,
                                ),
                            ),
                          ]}
                          onChange={setEditingRoles}
                          disabled={busy}
                          idPrefix={`edit-role-${person.user_id}`}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {person.roles.map((role) => (
                            <Badge key={role.code} variant="secondary">{role.name}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {person.assigned_characters.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {person.assigned_characters.map((character) => (
                            <Badge key={character.id} variant="outline">
                              {character.name} · Cast
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not cast</span>
                      )}
                    </TableCell>
                    {canMutate && (
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {editing ? (
                            <>
                              {canUpdate && (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void saveRoles(person.user_id)}
                                >
                                  Save
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setEditingUserId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              {canUpdate && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditing(person)}
                                >
                                  Edit roles
                                </Button>
                              )}
                              {canUpdate && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  disabled={busy}
                                  onClick={() => void handleDeactivate(person)}
                                >
                                  Deactivate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
