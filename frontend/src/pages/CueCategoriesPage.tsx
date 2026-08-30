import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import EmptyState from "@/components/EmptyState";
import CatalogCsvImport from "@/components/CatalogCsvImport";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import type { CueCategoryResponse } from "@/lib/types";

const COMMON_CATEGORIES = ["Lighting", "Sound", "Music", "Projection", "FX"];

export default function CueCategoriesPage() {
  const { id } = useParams<{ id: string }>();
  const productionId = Number(id);
  const { hasCapability } = useProductionAccess();
  const canManagePreparation = ["create", "update", "delete"].some((action) =>
    hasCapability("cue_categories", action),
  );
  const confirm = useConfirm();
  const toast = useToast();

  const [categories, setCategories] = useState<CueCategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CueCategoryResponse | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const categoryData = await api.listCueCategories(productionId);
      setCategories(categoryData);
    } catch (err) {
      setError(formatApiError(err, "Failed to load cue categories"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [productionId]);

  function openCreateDialog() {
    setEditingCategory(null);
    setName("");
    setDescription("");
    setDialogOpen(true);
  }

  function openEditDialog(category: CueCategoryResponse) {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingCategory(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editingCategory) {
        await api.updateCueCategory(productionId, editingCategory.id, {
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Category updated");
      } else {
        await api.createCueCategory(productionId, {
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Category created");
      }
      closeDialog();
      await loadData();
    } catch (err) {
      toast.error(
        formatApiError(
          err,
          editingCategory ? "Failed to update category" : "Failed to create category",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCommonCategories() {
    const existing = new Set(categories.map((c) => c.name.toLowerCase()));
    const missing = COMMON_CATEGORIES.filter((name) => !existing.has(name.toLowerCase()));
    if (missing.length === 0) {
      toast.success("All common categories already exist");
      return;
    }

    setSaving(true);
    try {
      for (const categoryName of missing) {
        await api.createCueCategory(productionId, { name: categoryName, description: null });
      }
      toast.success(
        missing.length === 1
          ? `Added ${missing[0]}`
          : `Added ${missing.length} common categories`,
      );
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to add common categories"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId: number) {
    const ok = await confirm({
      title: "Delete this cue category?",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    try {
      await api.deleteCueCategory(productionId, categoryId);
      toast.success("Category deleted");
      await loadData();
    } catch (err) {
      toast.error(formatApiError(err, "Failed to delete category"));
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
        <h1 className="text-2xl font-semibold tracking-tight">Cue Categories</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {canManagePreparation && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openCreateDialog}>
            Add category
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => void handleAddCommonCategories()}
          >
            Add common categories
          </Button>
          <CatalogCsvImport
            productionId={productionId}
            kind="cue-categories"
            onImported={loadData}
          />
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState
          title="No cue categories yet"
          description="Add categories like Lighting or Sound to organize technical cues."
          actionLabel={canManagePreparation ? "Add category" : undefined}
          onAction={canManagePreparation ? openCreateDialog : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table storageKey="cue-categories">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                {canManagePreparation && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {category.description ?? "—"}
                  </TableCell>
                  {canManagePreparation && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(category)}
                          aria-label={`Edit ${category.name}`}
                          title="Edit"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saving}
                          onClick={() => void handleDelete(category.id)}
                          aria-label={`Delete ${category.name}`}
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
          if (!open) setEditingCategory(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Edit category" : "Add category"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lighting"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Input
                  id="category-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {editingCategory ? "Save" : "Add category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
