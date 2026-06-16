'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BadgePercent, ImageOff, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { FulfillmentType, PaginationMeta, ProductStatus } from '@/types';
import { useApiList } from '@/lib/use-api';
import { api } from '@/lib/client-api';
import { ApiRequestError, qs } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { DiscountModal } from '@/components/admin/DiscountModal';

/** Admin product row (raw product joined with media + inventory). */
interface AdminProductRow {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  compareAtCents?: number | null;
  currency?: string;
  status: ProductStatus;
  fulfillment: FulfillmentType;
  media?: { type: string; url: string }[];
  inventory?: { quantity: number } | null;
}

const STATUS_BADGE: Record<ProductStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  ARCHIVED: 'bg-rose-100 text-rose-700',
};

export default function AdminProductsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | ProductStatus>('');
  const [pendingDelete, setPendingDelete] = useState<AdminProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<AdminProductRow | null>(null);

  // Status is filtered client-side (the admin list endpoint does not accept a status param).
  const key = `/admin/products${qs({ page, limit: 20, search })}`;
  const { data, isLoading, mutate } = useApiList<AdminProductRow[]>(key);

  const rows = useMemo(() => {
    const items = data?.data ?? [];
    return status ? items.filter((p) => p.status === status) : items;
  }, [data, status]);
  const meta: PaginationMeta | undefined = data?.meta;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/products/${pendingDelete.id}`);
      toast.success('Product deleted');
      await mutate();
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not delete product');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your catalog, pricing, and availability."
        action={
          <Button onClick={() => router.push('/admin/products/new')}>
            <Plus className="h-4 w-4" />
            New product
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={submitSearch} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by name or SKU…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <div className="sm:w-48">
          <Select value={status} onChange={(e) => setStatus(e.target.value as '' | ProductStatus)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
      </div>

      <DataTable<AdminProductRow>
        loading={isLoading}
        rows={rows}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title="No products found"
            description={search || status ? 'Try adjusting your filters.' : 'Create your first product to get started.'}
            action={
              <Button onClick={() => router.push('/admin/products/new')}>
                <Plus className="h-4 w-4" />
                New product
              </Button>
            }
          />
        }
        columns={[
          {
            key: 'thumbnail',
            header: '',
            className: 'w-14',
            render: (r) => {
              const img = r.media?.find((m) => m.type === 'IMAGE')?.url ?? r.media?.[0]?.url;
              return (
                <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-slate-100">
                  {img ? (
                    <Image src={img} alt={r.name} fill sizes="40px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: 'name',
            header: 'Name',
            render: (r) => (
              <Link href={`/admin/products/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                {r.name}
              </Link>
            ),
          },
          { key: 'sku', header: 'SKU', render: (r) => <span className="text-slate-500">{r.sku}</span> },
          {
            key: 'price',
            header: 'Price',
            render: (r) => {
              const onSale = !!r.compareAtCents && r.compareAtCents > r.priceCents;
              const pct = onSale ? Math.round(((r.compareAtCents! - r.priceCents) / r.compareAtCents!) * 100) : 0;
              return (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{formatMoney(r.priceCents, r.currency)}</span>
                  {onSale && (
                    <>
                      <span className="text-xs text-slate-400 line-through">{formatMoney(r.compareAtCents!, r.currency)}</span>
                      <Badge className="bg-rose-100 text-rose-700">{pct}% OFF</Badge>
                    </>
                  )}
                </div>
              );
            },
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge>,
          },
          {
            key: 'stock',
            header: 'Stock',
            render: (r) =>
              r.fulfillment === 'MADE_TO_ORDER' ? (
                <span className="text-slate-400">Made to order</span>
              ) : (
                <span className="tabular-nums">{r.inventory?.quantity ?? 0}</span>
              ),
          },
          {
            key: 'actions',
            header: '',
            className: 'w-32 text-right',
            render: (r) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDiscountTarget(r)}
                  aria-label="Add discount"
                  title="Add discount"
                >
                  <BadgePercent className="h-4 w-4 text-brand-600" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/products/${r.id}`)} aria-label="Edit">
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

      {meta && meta.totalPages > 1 && !status && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        danger
        title="Delete product"
        description={pendingDelete ? `Delete "${pendingDelete.name}"? This cannot be undone.` : undefined}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <DiscountModal
        product={discountTarget}
        onClose={() => setDiscountTarget(null)}
        onSaved={async () => {
          await mutate();
        }}
      />
    </div>
  );
}
