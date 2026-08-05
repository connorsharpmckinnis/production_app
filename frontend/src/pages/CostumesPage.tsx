import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import CatalogCsvImport from "@/components/CatalogCsvImport";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { CostumeResponse } from "@/lib/types";
import { sortByName } from "@/lib/utils";

export default function CostumesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const [searchParams] = useSearchParams();
  const { canManagePreparation } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [characters, setCharacters] = useState<
    Awaited<ReturnType<typeof api.listCharacters>>
  >([]);
  const [costumes, setCostumes] = useState<CostumeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCostume, setEditingCostume] = useState<CostumeResponse | null>(null);
  const [characterId, setCharacterId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const [characterData, costumeData] = await Promise.all([
        api.listCharacters(productionId),
        api.listCostumes(productionId),
      ]);
      setCharacters(sortByName(characterData));
      setCostumes(costumeData);
    } catch (err) {
      setError(formatApiError(err, "Failed to load costumes"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  function resolvePrefillCharacterId(): string {
    const param = searchParams.get("characterId");
    if (!param) return "";
    const parsed = Number(param);
    if (!Number.isFinite(parsed)) return "";
    return characters.some((character) => character.id === parsed) ? String(parsed) : "";
  }

  function openCreateDialog() {
    setEditingCostume(null);
    setCharacterId(resolvePrefillCharacterId());
    setName("");
    setDescription("");
    setDialogOpen(true);
  }

  function openEditDialog(costume: CostumeResponse) {
    setEditingCostume(costume);
    setCharacterId(String(costume.character_id));
    setName(costume.name);
    setDescription(costume.description ?? "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingCostume(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!characterId || !name.trim()) return;

    setSaving(true);
    try {
      if (editingCostume) {
        await api.updateCostume(productionId, editingCostume.id, {
          character_id: Number(characterId),
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Costume updated");
      } else {
        await api.createCostume(productionId, {
          character_id: Number(characterId),
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Costume created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        formatApiError(
          err,
          editingCostume ? "Failed to update costume" : "Failed to create costume",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(costumeId: number) {
    const ok = await confirm({
      title: "Delete this costume?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api.deleteCostume(productionId, costumeId);
      toast.success("Costume deleted");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete costume"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <CatalogPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/productions/${productionId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Costumes</h1>
        <p className="text-sm text-muted-foreground">
          {canManagePreparation
            ? "Manage the costume/look catalog, then record wear/clear changes on the timeline."
            : "Costumes in this production."}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canManagePreparation && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={openCreateDialog}>
            Add costume
          </Button>
          <CatalogCsvImport
            productionId={productionId}
            kind="costumes"
            onImported={loadData}
          />
        </div>
      )}

      {costumes.length === 0 ? (
        <EmptyState
          title="No costumes yet"
          description="Add looks to the catalog, then record wear/clear changes on the timeline."
          actionLabel={canManagePreparation ? "Add costume" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Character</TableHead>
                <TableHead>Costume</TableHead>
                <TableHead>Description</TableHead>
                {canManagePreparation && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {costumes.map((costume) => (
                <TableRow key={costume.id}>
                  <TableCell className="font-medium">{costume.character_name}</TableCell>
                  <TableCell className="font-medium">{costume.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {costume.description ?? "—"}
                  </TableCell>
                  {canManagePreparation && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(costume)}
                          aria-label={`Edit ${costume.name}`}
                          title="Edit"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          onClick={() => void handleDelete(costume.id)}
                          aria-label={`Delete ${costume.name}`}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingCostume(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editingCostume ? "Edit costume" : "Add costume"}</DialogTitle>
              <DialogDescription>
                {editingCostume
                  ? "Update this costume in the catalog."
                  : "Add a look to the catalog. Record when it's worn from the timeline."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Select value={characterId} onValueChange={setCharacterId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select character…" />
                </SelectTrigger>
                <SelectContent>
                  {characters.map((character) => (
                    <SelectItem key={character.id} value={String(character.id)}>
                      {character.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Costume name"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !characterId || !name.trim()}
              >
                {editingCostume ? "Save" : "Add costume"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
