'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Boxes, Search, SlidersHorizontal } from 'lucide-react';
import type { FulfillmentType, PaginationMeta } from '@/types';
import { useApiList } from '@/lib/use-api';
import { qs } from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { AdjustStockModal } from '@/components/admin/AdjustStockModal';

type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'MADE_TO_ORDER';

interface InventoryRow {
  productId: string;
  name: string;
  sku: string;
  fulfillment: FulfillmentType;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  status: InventoryStatus;
}

const STATUS_BADGE: Record<InventoryStatus, { label: string; className: string }> = {
  IN_STOCK: { label: 'In stock', className: 'bg-emerald-100 text-emerald-800' },
  LOW_STOCK: { label: 'Low stock', className: 'bg-amber-100 text-amber-800' },
  OUT_OF_STOCK: { label: 'Out of stock', className: 'bg-rose-100 text-rose-700' },
  MADE_TO_ORDER: { label: 'Made to order', className: 'bg-slate-100 text-slate-600' },
};

export default function AdminInventoryPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);

  const key = `/admin/inventory${qs({ page, limit: 20, search, lowOnly: lowOnly || undefined })}`;
  const { data, isLoading, mutate } = useApiList<InventoryRow[]>(key);
  const rows = data?.data ?? [];
  const meta: PaginationMeta | undefined = data?.meta;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Track stock levels and make manual adjustments." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={submitSearch} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by product name or SKU…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <Button
          type="button"
          variant={lowOnly ? 'primary' : 'outline'}
          onClick={() => {
            setLowOnly((v) => !v);
            setPage(1);
          }}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Low stock only
        </Button>
      </div>

      <DataTable<InventoryRow>
        loading={isLoading}
        rows={rows}
        rowKey={(r) => r.productId}
        empty={
          <EmptyState
            icon={<Boxes className="h-10 w-10" />}
            title="No products found"
            description={lowOnly ? 'No products are low on stock.' : 'Adjust your search to find products.'}
          />
        }
        columns={[
          {
            key: 'name',
            header: 'Product',
            render: (r) => (
              <div>
                <p className="font-medium text-slate-900">{r.name}</p>
                <p className="text-xs text-slate-400">{r.sku}</p>
              </div>
            ),
          },
          {
            key: 'quantity',
            header: 'Quantity',
            render: (r) => (r.fulfillment === 'MADE_TO_ORDER' ? <span className="text-slate-400">—</span> : <span className="tabular-nums">{r.quantity}</span>),
          },
          {
            key: 'reserved',
            header: 'Reserved',
            render: (r) => (r.fulfillment === 'MADE_TO_ORDER' ? <span className="text-slate-400">—</span> : <span className="tabular-nums">{r.reserved}</span>),
          },
          {
            key: 'available',
            header: 'Available',
            render: (r) =>
              r.fulfillment === 'MADE_TO_ORDER' ? (
                <span className="text-slate-400">—</span>
              ) : (
                <span className="tabular-nums font-medium text-slate-900">{r.available}</span>
              ),
          },
          {
            key: 'threshold',
            header: 'Threshold',
            render: (r) => (r.fulfillment === 'MADE_TO_ORDER' ? <span className="text-slate-400">—</span> : <span className="tabular-nums">{r.lowStockThreshold}</span>),
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <Badge className={STATUS_BADGE[r.status].className}>{STATUS_BADGE[r.status].label}</Badge>,
          },
          {
            key: 'actions',
            header: '',
            className: 'w-24 text-right',
            render: (r) => (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={r.fulfillment === 'MADE_TO_ORDER'}
                  onClick={() => setAdjusting(r)}
                >
                  Adjust
                </Button>
              </div>
            ),
          },
        ]}
      />

      {meta && meta.totalPages > 1 && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}

      {adjusting && (
        <AdjustStockModal
          productId={adjusting.productId}
          productName={adjusting.name}
          currentQuantity={adjusting.quantity}
          onClose={() => setAdjusting(null)}
          onAdjusted={async () => {
            await mutate();
            setAdjusting(null);
            toast.success('Inventory updated');
          }}
        />
      )}
    </div>
  );
}
