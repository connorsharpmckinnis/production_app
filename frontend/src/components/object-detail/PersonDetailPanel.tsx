import { useCallback, useEffect, useMemo, useState } from "react";
import ObjectLink from "@/components/object-detail/ObjectLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useRegisterObjectDetailPanel } from "@/components/object-detail/useRegisterObjectDetailPanel";
import { useObjectDetailInternal } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type {
  ProductionMemberResponse,
  ProductionRoleSummary,
} from "@/lib/types";

interface PersonDetailPanelProps {
  userId: number;
}

function sortedRoleCodes(codes: string[], roles: ProductionRoleSummary[]): string[] {
  const order = new Map(roles.map((role, index) => [role.code, index]));
  return [...new Set(codes)].sort((a, b) => {
    const orderA = order.get(a);
    const orderB = order.get(b);
    if (orderA != null && orderB != null) return orderA - orderB;
    if (orderA != null) return -1;
    if (orderB != null) return 1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}

export default function PersonDetailPanel({ userId }: PersonDetailPanelProps) {
  const { productionId } = useObjectDetailInternal();
  const { hasCapability } = useProductionAccess();
  const toast = useToast();
  const canUpdate = hasCapability("people", "update");

  const [person, setPerson] = useState<ProductionMemberResponse | null>(null);
  const [roles, setRoles] = useState<ProductionRoleSummary[]>([]);
  const [roleCodes, setRoleCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (productionId == null) return;
    setLoading(true);
    setError(null);
    try {
      const [people, roleList] = await Promise.all([
        api.listProductionPeople(productionId),
        api.listProductionRoles(productionId),
      ]);
      const found = people.find((row) => row.user_id === userId) ?? null;
      setRoles(roleList);
      if (!found) {
        setPerson(null);
        setError("Person not found on this production roster.");
        return;
      }
      setPerson(found);
      setRoleCodes(found.roles.map((role) => role.code));
    } catch (err) {
      setError(formatApiError(err, "Failed to load person"));
      setPerson(null);
    } finally {
      setLoading(false);
    }
  }, [productionId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const savedCodes = useMemo(
    () => (person ? sortedRoleCodes(person.roles.map((r) => r.code), roles) : []),
    [person, roles],
  );
  const currentCodes = useMemo(
    () => sortedRoleCodes(roleCodes, roles),
    [roleCodes, roles],
  );
  const dirty =
    person != null &&
    (currentCodes.length !== savedCodes.length ||
      currentCodes.some((code, index) => code !== savedCodes[index]));

  const save = useCallback(async () => {
    if (productionId == null || person == null || !canUpdate) return;
    if (currentCodes.length === 0) {
      toast.error("Select at least one role");
      throw new Error("Select at least one role");
    }
    setSaving(true);
    try {
      const updated = await api.updateProductionPerson(productionId, person.user_id, {
        role_codes: currentCodes,
      });
      setPerson(updated);
      setRoleCodes(updated.roles.map((role) => role.code));
      toast.success("Person saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save person"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, currentCodes, person, productionId, toast]);

  const discard = useCallback(() => {
    if (person == null) return;
    setRoleCodes(person.roles.map((role) => role.code));
  }, [person]);

  const controllers = useMemo(() => {
    if (person == null) return null;
    return {
      title: `Person · ${person.display_name}`,
      dirty: canUpdate && dirty,
      canUpdate,
      save,
      discard,
    };
  }, [canUpdate, dirty, discard, person, save]);

  useRegisterObjectDetailPanel(controllers);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || person == null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Person not found."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Name
        </p>
        <p className="text-sm font-medium">{person.display_name}</p>
      </div>

      {person.email ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </p>
          <p className="text-sm text-muted-foreground">{person.email}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        <p className="text-sm">{person.is_active ? "Active" : "Inactive"}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Roles
        </p>
        {canUpdate ? (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {roles.map((role) => {
              const checkboxId = `object-detail-person-role-${role.code}`;
              return (
                <label
                  key={role.code}
                  htmlFor={checkboxId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={roleCodes.includes(role.code)}
                    disabled={saving}
                    onCheckedChange={(checked) => {
                      setRoleCodes((prev) =>
                        sortedRoleCodes(
                          checked === true
                            ? [...prev, role.code]
                            : prev.filter((code) => code !== role.code),
                          roles,
                        ),
                      );
                    }}
                  />
                  {role.name}
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm">
            {person.roles.map((role) => role.name).join(", ") || "—"}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cast as
        </p>
        {person.assigned_characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not cast</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
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
        )}
      </div>
    </div>
  );
}
