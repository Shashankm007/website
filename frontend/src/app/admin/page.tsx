'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle, IndianRupee, Package, ShoppingCart, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useApi } from '@/lib/use-api';
import { formatMoney, formatDate, orderStatusBadge } from '@/lib/utils';
import { ApiRequestError } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';

interface OverviewOrder {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  totalCents: number;
  createdAt: string;
}

interface OverviewTopProduct {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  salesCount: number;
  revenueCents: number;
}

interface AdminOverview {
  revenueCents: number;
  orderCount: number;
  paidOrderCount: number;
  userCount: number;
  lowStockCount: number;
  recentOrders: OverviewOrder[];
  topProducts: OverviewTopProduct[];
}

export default function AdminOverviewPage() {
  const { data, error, isLoading } = useApi<AdminOverview>('/admin/overview');

  useEffect(() => {
    if (error) {
      const msg = error instanceof ApiRequestError ? error.message : 'Failed to load dashboard';
      toast.error(msg);
    }
  }, [error]);

  const stats = [
    {
      label: 'Revenue',
      value: data ? formatMoney(data.revenueCents) : '—',
      icon: <IndianRupee className="h-5 w-5" />,
      hint: 'Paid & fulfilled orders',
    },
    { label: 'Total orders', value: data ? data.orderCount : '—', icon: <ShoppingCart className="h-5 w-5" /> },
    { label: 'Paid orders', value: data ? data.paidOrderCount : '—', icon: <Package className="h-5 w-5" /> },
    { label: 'Customers', value: data ? data.userCount : '—', icon: <Users className="h-5 w-5" /> },
    {
      label: 'Low stock',
      value: data ? data.lowStockCount : '—',
      icon: <AlertTriangle className="h-5 w-5" />,
      hint: 'At or below threshold',
    },
  ];

  const orderColumns: DataTableColumn<OverviewOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order',
      render: (o) => (
        <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-700 hover:underline">
          {o.orderNumber}
        </Link>
      ),
    },
    {
      key: 'email',
      header: 'Customer',
      render: (o) => <span className="text-slate-600">{o.email}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => {
        const b = orderStatusBadge(o.status);
        return <Badge className={b.className}>{b.label}</Badge>;
      },
    },
    {
      key: 'totalCents',
      header: 'Total',
      className: 'text-right',
      render: (o) => <span className="font-medium tabular-nums">{formatMoney(o.totalCents)}</span>,
    },
    {
      key: 'createdAt',
      header: 'Date',
      className: 'text-right',
      render: (o) => <span className="text-slate-500">{formatDate(o.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Overview" description="Store performance at a glance." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} hint={s.hint} />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <DataTable
            columns={orderColumns}
            rows={data?.recentOrders ?? []}
            loading={isLoading}
            rowKey={(o) => o.id}
            empty={<EmptyState title="No orders yet" description="Orders will appear here as they come in." />}
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Top products</h2>
            <Link href="/admin/products" className="text-sm font-medium text-brand-700 hover:underline">
              Manage
            </Link>
          </div>
          <div className="card divide-y divide-slate-100">
            {isLoading ? (
              <ul className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 p-4">
                    <div className="skeleton h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-2/3" />
                      <div className="skeleton h-3 w-1/3" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (data?.topProducts?.length ?? 0) === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No sales data yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data!.topProducts.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${p.slug}`}
                        className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-slate-500">{p.salesCount} sold</p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
                      {formatMoney(p.revenueCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
