'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ShoppingBag } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { useApiList } from '@/lib/use-api';
import { qs } from '@/lib/api';
import { formatDateTime, formatMoney, orderStatusBadge } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';

const STATUS_OPTIONS: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const query = qs({ page, limit: PAGE_SIZE, status: status || undefined, search: search || undefined });
  const { data, isLoading } = useApiList<Order[]>(`/admin/orders${query}`);

  const orders = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const total = data?.meta?.total ?? 0;

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function onStatusChange(value: string) {
    setPage(1);
    setStatus(value as OrderStatus | '');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={total ? `${total} order${total === 1 ? '' : 's'}` : 'Manage and fulfil customer orders'}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form onSubmit={applySearch} className="flex w-full items-end gap-2 sm:max-w-sm">
          <Input
            label="Search"
            placeholder="Order number or email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Search orders">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <div className="w-full sm:max-w-[12rem]">
          <Select label="Status" value={status} onChange={(e) => onStatusChange(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {orderStatusBadge(s).label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <DataTable<Order>
        loading={isLoading}
        rows={orders}
        rowKey={(o) => o.id}
        empty={
          <EmptyState
            icon={<ShoppingBag className="h-10 w-10" />}
            title="No orders found"
            description={
              search || status
                ? 'Try adjusting your search or status filter.'
                : 'Orders will appear here once customers start buying.'
            }
          />
        }
        columns={[
          {
            key: 'orderNumber',
            header: 'Order',
            render: (o) => <span className="font-medium text-slate-900">{o.orderNumber}</span>,
          },
          {
            key: 'email',
            header: 'Customer',
            render: (o) => <span className="text-slate-600">{o.email}</span>,
          },
          {
            key: 'createdAt',
            header: 'Placed',
            render: (o) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(o.createdAt)}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (o) => {
              const badge = orderStatusBadge(o.status);
              return <Badge className={badge.className}>{badge.label}</Badge>;
            },
          },
          {
            key: 'totalCents',
            header: 'Total',
            className: 'text-right',
            render: (o) => <span className="font-medium tabular-nums">{formatMoney(o.totalCents, o.currency)}</span>,
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (o) => (
              <Link href={`/admin/orders/${o.id}`}>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </Link>
            ),
          },
        ]}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
