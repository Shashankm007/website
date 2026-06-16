'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  CreditCard,
  Download,
  ExternalLink,
  ImageOff,
  Package,
  Truck,
  XCircle,
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { api, getAccessToken } from '@/lib/client-api';
import { PUBLIC_API_URL, ApiRequestError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatDateTime, formatMoney, orderStatusBadge } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';
import { ResumePaymentButton } from '@/components/checkout/ResumePaymentButton';

// Ordered "happy path" timeline. CANCELLED / REFUNDED are handled separately.
const TIMELINE: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING', label: 'Order placed' },
  { status: 'PAID', label: 'Payment confirmed' },
  { status: 'PRINTING', label: 'Printing' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
];

function timelineIndex(status: OrderStatus): number {
  const idx = TIMELINE.findIndex((s) => s.status === status);
  return idx;
}

function shippingField(snapshot: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!snapshot) return null;
  const v = snapshot[key];
  return typeof v === 'string' && v.trim() ? v : null;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: order, isLoading, mutate } = useApi<Order>(`/orders/${id}`);

  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const cancelOrder = async () => {
    if (!order) return;
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setCancelling(true);
    try {
      const { data } = await api.post<Order>(`/orders/${order.id}/cancel`);
      await mutate(data, { revalidate: false });
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const downloadInvoice = async () => {
    if (!order) return;
    setDownloading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/orders/${order.id}/invoice`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to download invoice (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `order-${order.orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download invoice');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <CenteredSpinner label="Loading order…" />;

  if (!order) {
    return (
      <EmptyState
        icon={<Package className="h-10 w-10" />}
        title="Order not found"
        description="We couldn't find this order. It may have been removed."
        action={
          <Link
            href="/account/orders"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Back to orders
          </Link>
        }
      />
    );
  }

  const badge = orderStatusBadge(order.status);
  const cancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const currentIdx = timelineIndex(order.status);

  const ship = order.shippingSnapshot;
  const shipName = shippingField(ship, 'fullName') ?? shippingField(ship, 'name');
  const shipLine1 = shippingField(ship, 'line1');
  const shipLine2 = shippingField(ship, 'line2');
  const shipCity = shippingField(ship, 'city');
  const shipState = shippingField(ship, 'state');
  const shipPostal = shippingField(ship, 'postalCode');
  const shipCountry = shippingField(ship, 'country');
  const shipPhone = shippingField(ship, 'phone');
  const hasShipping = Boolean(shipName || shipLine1 || shipCity);

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{order.orderNumber}</h2>
          <p className="mt-1 text-sm text-slate-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={badge.className}>{badge.label}</Badge>
          <Button variant="outline" size="sm" onClick={downloadInvoice} loading={downloading}>
            <Download className="h-4 w-4" /> Invoice
          </Button>
          {order.status === 'PENDING' && (
            <Button variant="danger" size="sm" onClick={cancelOrder} loading={cancelling}>
              Cancel order
            </Button>
          )}
        </div>
      </div>

      {order.status === 'PENDING' && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Payment pending</p>
              <p className="text-amber-700">Complete your payment to confirm this order and start production.</p>
            </div>
          </div>
          <ResumePaymentButton
            orderId={order.id}
            orderNumber={order.orderNumber}
            totalCents={order.totalCents}
            onPaid={() => {
              void mutate();
            }}
            className="shrink-0"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <section className="card p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Items</h3>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.imageSnapshot ? (
                      <Image src={item.imageSnapshot} alt={item.nameSnapshot} fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <ImageOff className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{item.nameSnapshot}</p>
                    {item.options && Object.keys(item.options).length > 0 && (
                      <p className="mt-0.5 text-sm text-slate-500">
                        {Object.entries(item.options)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    )}
                    {item.customText && (
                      <p className="mt-0.5 text-sm italic text-slate-500">&ldquo;{item.customText}&rdquo;</p>
                    )}
                    <p className="mt-1 text-sm text-slate-500">
                      {formatMoney(item.unitPriceCents, order.currency)} × {item.quantity}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-medium text-slate-900">
                    {formatMoney(item.totalCents, order.currency)}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Status timeline */}
          <section className="card p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Status</h3>
            {cancelled ? (
              <div className="flex items-center gap-3 rounded-lg bg-rose-50 p-4 text-rose-700">
                <XCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">{badge.label}</p>
                  <p className="text-sm text-rose-600">This order is no longer being processed.</p>
                </div>
              </div>
            ) : (
              <ol className="space-y-4">
                {TIMELINE.map((step, idx) => {
                  const done = currentIdx >= 0 && idx <= currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <li key={step.status} className="flex items-center gap-3">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                      )}
                      <span className={done ? 'font-medium text-slate-900' : 'text-slate-400'}>{step.label}</span>
                      {isCurrent && <Badge className="bg-brand-50 text-brand-700">Current</Badge>}
                    </li>
                  );
                })}
              </ol>
            )}

            {(() => {
              const courier = order.courierName || order.carrier;
              const trackingNo = order.awbCode || order.trackingNumber;
              if (!courier && !trackingNo && !order.trackingUrl) return null;
              return (
                <div className="mt-5 flex items-start gap-3 rounded-lg bg-slate-50 p-4">
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">Tracking</p>
                    {courier && <p className="text-slate-600">Courier: {courier}</p>}
                    {trackingNo && (
                      <p className="text-slate-600">
                        AWB / Tracking #: <span className="font-mono">{trackingNo}</span>
                      </p>
                    )}
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                      >
                        <Truck className="h-4 w-4" /> Track shipment
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>
        </div>

        {/* Sidebar: totals + shipping */}
        <div className="space-y-6">
          <section className="card p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="text-slate-900">{formatMoney(order.subtotalCents, order.currency)}</dd>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Discount</dt>
                  <dd className="text-emerald-600">−{formatMoney(order.discountCents, order.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Shipping</dt>
                <dd className="text-slate-900">
                  {order.shippingCents === 0 ? 'Free' : formatMoney(order.shippingCents, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">GST (18%)</dt>
                <dd className="text-slate-900">{formatMoney(order.taxCents, order.currency)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-base font-semibold">
                <dt className="text-slate-900">Total</dt>
                <dd className="text-slate-900">{formatMoney(order.totalCents, order.currency)}</dd>
              </div>
            </dl>
          </section>

          {hasShipping && (
            <section className="card p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Shipping address</h3>
              <address className="not-italic text-sm leading-relaxed text-slate-700">
                {shipName && <span className="block font-medium text-slate-900">{shipName}</span>}
                {shipLine1 && <span className="block">{shipLine1}</span>}
                {shipLine2 && <span className="block">{shipLine2}</span>}
                {(shipCity || shipState || shipPostal) && (
                  <span className="block">
                    {[shipCity, shipState].filter(Boolean).join(', ')}
                    {shipPostal ? ` ${shipPostal}` : ''}
                  </span>
                )}
                {shipCountry && <span className="block">{shipCountry}</span>}
                {shipPhone && <span className="block text-slate-500">{shipPhone}</span>}
              </address>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
