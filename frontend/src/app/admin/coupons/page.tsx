'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import type { PaginationMeta } from '@/types';
import { useApiList } from '@/lib/use-api';
import { api } from '@/lib/client-api';
import { ApiRequestError, qs } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { CouponForm, type AdminCoupon } from '@/components/admin/CouponForm';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

export default function AdminCouponsPage() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminCoupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, mutate } = useApiList<AdminCoupon[]>(`/admin/coupons${qs({ page, limit: 20 })}`);
  const rows = data?.data ?? [];
  const meta: PaginationMeta | undefined = data?.meta;
  const showModal = creating || !!editing;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/coupons/${pendingDelete.id}`);
      toast.success('Coupon deleted');
      await mutate();
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not delete coupon');
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    setCreating(false);
    setEditing(null);
  };
  const onSaved = async () => {
    await mutate();
    closeModal();
  };

  const formatValue = (c: AdminCoupon) => (c.type === 'PERCENTAGE' ? `${c.value}%` : formatMoney(c.value));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Create and manage discount codes."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New coupon
          </Button>
        }
      />

      <DataTable<AdminCoupon>
        loading={isLoading}
        rows={rows}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={<Tag className="h-10 w-10" />}
            title="No coupons yet"
            description="Create a discount code to run a promotion."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                New coupon
              </Button>
            }
          />
        }
        columns={[
          { key: 'code', header: 'Code', render: (r) => <span className="font-mono font-medium text-slate-900">{r.code}</span> },
          { key: 'type', header: 'Type', render: (r) => <span className="text-slate-500">{r.type === 'PERCENTAGE' ? 'Percentage' : 'Fixed'}</span> },
          { key: 'value', header: 'Value', render: (r) => formatValue(r) },
          {
            key: 'min',
            header: 'Min subtotal',
            render: (r) => (r.minSubtotalCents ? formatMoney(r.minSubtotalCents) : <span className="text-slate-400">—</span>),
          },
          {
            key: 'usage',
            header: 'Usage',
            render: (r) => (
              <span className="tabular-nums text-slate-600">
                {r.redemptions ?? 0}
                {r.maxRedemptions ? ` / ${r.maxRedemptions}` : ''}
              </span>
            ),
          },
          {
            key: 'expires',
            header: 'Expires',
            render: (r) => (r.expiresAt ? formatDate(r.expiresAt) : <span className="text-slate-400">Never</span>),
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) =>
              r.active ? (
                <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-600">Inactive</Badge>
              ),
          },
          {
            key: 'actions',
            header: '',
            className: 'w-24 text-right',
            render: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPendingDelete(r)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            ),
          },
        ]}
      />

      {meta && meta.totalPages > 1 && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="card w-full max-w-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? `Edit ${editing.code}` : 'New coupon'}</h2>
              <button onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <CouponForm key={editing?.id ?? 'new'} coupon={editing ?? undefined} onSaved={onSaved} onCancel={closeModal} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        danger
        title="Delete coupon"
        description={pendingDelete ? `Delete coupon "${pendingDelete.code}"?` : undefined}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
