'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FolderTree, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Category } from '@/types';
import { useApi } from '@/lib/use-api';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

interface FlatCategory {
  category: Category;
  depth: number;
}

function flatten(tree: Category[], depth = 0, acc: FlatCategory[] = []): FlatCategory[] {
  for (const c of tree) {
    acc.push({ category: c, depth });
    if (c.children?.length) flatten(c.children, depth + 1, acc);
  }
  return acc;
}

/** Collect the id of a node and all of its descendants (excluded as parent options). */
function collectSubtreeIds(c: Category, acc: Set<string> = new Set()): Set<string> {
  acc.add(c.id);
  c.children?.forEach((child) => collectSubtreeIds(child, acc));
  return acc;
}

export default function AdminCategoriesPage() {
  const { data: tree, isLoading, mutate } = useApi<Category[]>('/categories');
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const flat = useMemo(() => flatten(tree ?? []), [tree]);

  // Parent options exclude the node being edited and its descendants (no cycles).
  const parentOptions = useMemo(() => {
    const excluded = editing ? collectSubtreeIds(editing) : new Set<string>();
    return flat.filter((f) => !excluded.has(f.category.id)).map((f) => ({ id: f.category.id, name: f.category.name, depth: f.depth }));
  }, [flat, editing]);

  const showForm = creating || !!editing;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/categories/${pendingDelete.id}`);
      toast.success('Category deleted');
      await mutate();
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not delete category');
    } finally {
      setDeleting(false);
    }
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  const onSaved = async () => {
    await mutate();
    closeForm();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organize your catalog into a browsable hierarchy."
        action={
          !showForm && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New category
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <CenteredSpinner label="Loading categories…" />
          ) : flat.length === 0 ? (
            <EmptyState
              icon={<FolderTree className="h-10 w-10" />}
              title="No categories yet"
              description="Create your first category to organize products."
              action={
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                  New category
                </Button>
              }
            />
          ) : (
            <ul className="card divide-y divide-slate-100">
              {flat.map(({ category, depth }) => (
                <li key={category.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center" style={{ paddingLeft: depth * 20 }}>
                    {depth > 0 && <span className="mr-2 text-slate-300">└</span>}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{category.name}</p>
                      <p className="truncate text-xs text-slate-400">/{category.slug}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCreating(false);
                        setEditing(category);
                      }}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setPendingDelete(category)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {showForm && (
          <div className="lg:col-span-1">
            <div className="card space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit category' : 'New category'}</h2>
                <button onClick={closeForm} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CategoryForm
                key={editing?.id ?? 'new'}
                category={editing ?? undefined}
                parentOptions={parentOptions}
                onSaved={onSaved}
                onCancel={closeForm}
              />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        danger
        title="Delete category"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? Products in this category will be uncategorized.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
