'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Package, ShoppingBag } from 'lucide-react';
import type { Order } from '@/types';
import { qs } from '@/lib/api';
import { useApiList } from '@/lib/use-api';
import { formatDate, formatMoney, orderStatusBadge } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';
import { ResumePaymentButton } from '@/components/checkout/ResumePaymentButton';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApiList<Order[]>(`/orders${qs({ page })}`);

  const orders = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Order history</h2>
        <p className="mt-1 text-sm text-slate-500">View and track all of your orders.</p>
      </div>

      {isLoading ? (
        <CenteredSpinner label="Loading your orders…" />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="No orders yet"
          description="When you place an order, it will show up here."
          action={
            <Link
              href="/products"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Browse products
            </Link>
          }
        />
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="space-y-3 sm:hidden">
            {orders.map((order) => {
              const badge = orderStatusBadge(order.status);
              return (
                <li key={order.id} className="space-y-2">
                  <Link href={`/account/orders/${order.id}`} className="card flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-900">{order.orderNumber}</span>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
                        <span>{formatDate(order.createdAt)}</span>
                        <span className="font-medium text-slate-700">{formatMoney(order.totalCents, order.currency)}</span>
                      </div>
                    </div>
                  </Link>
                  {order.status === 'PENDING' && (
                    <ResumePaymentButton
                      orderId={order.id}
                      orderNumber={order.orderNumber}
                      totalCents={order.totalCents}
                      className="w-full"
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="card hidden overflow-hidden sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const badge = orderStatusBadge(order.status);
                  return (
                    <tr key={order.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <Link href={`/account/orders/${order.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(order.createdAt)}</td>
                      <td className="px-5 py-4">
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-900">
                        {formatMoney(order.totalCents, order.currency)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {order.status === 'PENDING' && (
                            <ResumePaymentButton
                              orderId={order.id}
                              orderNumber={order.orderNumber}
                              totalCents={order.totalCents}
                              label="Resume payment"
                            />
                          )}
                          <Link
                            href={`/account/orders/${order.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
                          >
                            View <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
