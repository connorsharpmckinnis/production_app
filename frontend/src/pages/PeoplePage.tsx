import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import MobileListCard from "@/components/MobileListCard";
import ObjectLink from "@/components/object-detail/ObjectLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function CandidateMultiSelect({
  candidates,
  selectedIds,
  onChange,
  disabled = false,
}: {
  candidates: ProductionMemberCandidateResponse[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const searchLower = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchLower) return candidates;
    return candidates.filter((candidate) => {
      const haystack = `${candidate.display_name} ${candidate.email ?? ""}`.toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [candidates, searchLower]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
    } else {
      setSearch("");
    }
  }, [open]);

  const buttonLabel = (() => {
    if (selectedIds.length === 0) return "Choose people…";
    if (selectedIds.length === 1) {
      return (
        candidates.find((candidate) => candidate.user_id === selectedIds[0])
          ?.display_name ?? "1 person"
      );
    }
    return `${selectedIds.length} people selected`;
  })();

  function toggle(userId: number, checked: boolean | "indeterminate") {
    if (checked === true) {
      onChange([...new Set([...selectedIds, userId])]);
    } else {
      onChange(selectedIds.filter((id) => id !== userId));
    }
  }

  function selectFiltered() {
    onChange([
      ...new Set([...selectedIds, ...filtered.map((candidate) => candidate.user_id)]),
    ]);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="relative max-w-md">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="w-full justify-between font-normal"
        aria-label="Choose people to add"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{buttonLabel}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </Button>

      {open && !disabled && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close people picker"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-30 mt-1 w-full min-w-72 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
            <Input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search people to add"
              className="mb-2"
            />
            <div className="mb-2 flex gap-2 border-b border-border pb-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={selectFiltered}
                disabled={filtered.length === 0}
                className="h-auto px-0 text-xs"
              >
                Select {searchLower ? "matches" : "all"}
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={clearAll}
                disabled={selectedIds.length === 0}
                className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                No people match your search.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {filtered.map((candidate) => {
                  const checkboxId = `candidate-${candidate.user_id}`;
                  return (
                    <li key={candidate.user_id}>
                      <Label
                        htmlFor={checkboxId}
                        className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 font-normal hover:bg-accent"
                      >
                        <Checkbox
                          id={checkboxId}
                          className="mt-0.5"
                          checked={selectedSet.has(candidate.user_id)}
                          onCheckedChange={(checked) =>
                            toggle(candidate.user_id, checked)
                          }
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm leading-snug">
                            {candidate.display_name}
                          </span>
                          {candidate.email ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {candidate.email}
                            </span>
                          ) : null}
                        </span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
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
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
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
    if (selectedCandidateIds.length === 0 || newRoles.length === 0) {
      toast.error("Choose at least one person and one production role.");
      return;
    }

    setSavingKey("add-bulk");
    let added = 0;
    const failures: string[] = [];
    try {
      for (const userId of selectedCandidateIds) {
        const candidate = candidates.find((row) => row.user_id === userId);
        try {
          await api.addProductionPerson(productionId, {
            user_id: userId,
            role_codes: newRoles,
          });
          added += 1;
        } catch (err) {
          const name = candidate?.display_name ?? `User ${userId}`;
          failures.push(`${name}: ${formatApiError(err, "could not add")}`);
        }
      }

      if (added > 0) {
        setSelectedCandidateIds([]);
        await loadData();
      }

      if (failures.length === 0) {
        toast.success(
          added === 1
            ? "Person added to production"
            : `${added} people added to production`,
        );
      } else if (added === 0) {
        toast.error(failures[0] ?? "Could not add production members.");
      } else {
        toast.error(
          `Added ${added}, but ${failures.length} failed. ${failures[0]}`,
        );
      }
    } finally {
      setSavingKey(null);
    }
  }

  function clearSelectedCandidates() {
    setSelectedCandidateIds([]);
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
            <h2 className="text-sm font-medium">Add existing users</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select one or more people from this organization, then choose the
              production roles to give all of them.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">People</span>
              {selectedCandidateIds.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={savingKey != null}
                  onClick={clearSelectedCandidates}
                >
                  Clear selection
                </Button>
              )}
            </div>
            <CandidateMultiSelect
              candidates={candidates}
              selectedIds={selectedCandidateIds}
              onChange={setSelectedCandidateIds}
              disabled={savingKey != null}
            />
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
            disabled={
              selectedCandidateIds.length === 0 ||
              newRoles.length === 0 ||
              savingKey != null
            }
            onClick={() => void handleAdd()}
          >
            {savingKey === "add-bulk"
              ? "Adding…"
              : selectedCandidateIds.length <= 1
                ? "Add person"
                : `Add ${selectedCandidateIds.length} people`}
          </Button>
        </section>
      )}

      {people.length === 0 ? (
        <EmptyState
          title="No active members yet"
          description={
            canCreate
              ? "Add existing organization users to begin building the production roster."
              : "No active production members are available."
          }
        />
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {people.map((person) => {
              const editing = editingUserId === person.user_id;
              const busy = savingKey != null;
              return (
                <MobileListCard
                  key={person.user_id}
                  actions={
                    canMutate ? (
                      editing ? (
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
                      )
                    ) : undefined
                  }
                >
                  <p className="font-medium">
                    <ObjectLink
                      objectType="person"
                      objectId={person.user_id}
                      label={person.display_name}
                    />
                  </p>
                  {person.email && (
                    <p className="text-xs text-muted-foreground">{person.email}</p>
                  )}
                  <div className="pt-2">
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
                        idPrefix={`mobile-edit-role-${person.user_id}`}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {person.roles.map((role) => (
                          <Badge key={role.code} variant="secondary">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    {person.assigned_characters.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {person.assigned_characters.map((character) => (
                          <ObjectLink
                            key={character.id}
                            objectType="character"
                            objectId={character.id}
                            label={character.name}
                            className="text-xs"
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not cast</span>
                    )}
                  </div>
                </MobileListCard>
              );
            })}
          </ul>

          <div className="hidden rounded-lg border border-border md:block">
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
                        <p className="font-medium">
                          <ObjectLink
                            objectType="person"
                            objectId={person.user_id}
                            label={person.display_name}
                          />
                        </p>
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
                              <ObjectLink
                                key={character.id}
                                objectType="character"
                                objectId={character.id}
                                label={`${character.name} · Cast`}
                                className="text-xs"
                              />
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
        </>
      )}
    </div>
  );
}
