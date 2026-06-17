'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Tags, Trash2 } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

interface AdminTag {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export default function AdminTagsPage() {
  const { data, isLoading, mutate } = useApi<AdminTag[]>('/admin/tags');
  const rows = data ?? [];
  const [pendingDelete, setPendingDelete] = useState<AdminTag | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/tags/${pendingDelete.id}`);
      toast.success('Tag deleted');
      await mutate();
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not delete tag');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tags"
        description="Tags are created from the product form. Delete a tag to remove it from every product."
      />

      <DataTable<AdminTag>
        loading={isLoading}
        rows={rows}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={<Tags className="h-10 w-10" />}
            title="No tags yet"
            description="Add tags to a product (in the product form) and they'll appear here."
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Tag',
            render: (r) => <span className="font-medium text-slate-900">{r.name}</span>,
          },
          {
            key: 'slug',
            header: 'Slug',
            render: (r) => <span className="font-mono text-xs text-slate-500">{r.slug}</span>,
          },
          {
            key: 'products',
            header: 'Products',
            render: (r) => <span className="tabular-nums text-slate-600">{r.productCount}</span>,
          },
          {
            key: 'actions',
            header: '',
            className: 'w-16 text-right',
            render: (r) => (
              <div className="flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => setPendingDelete(r)} aria-label={`Delete ${r.name}`}>
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            ),
          },
        ]}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        danger
        title="Delete tag"
        description={
          pendingDelete
            ? `Delete tag "${pendingDelete.name}"?${
                pendingDelete.productCount > 0
                  ? ` It will be removed from ${pendingDelete.productCount} product${
                      pendingDelete.productCount === 1 ? '' : 's'
                    }.`
                  : ''
              }`
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
