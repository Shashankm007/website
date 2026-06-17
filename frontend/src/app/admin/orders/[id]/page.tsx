'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, CreditCard, Download, ExternalLink, MapPin, Package, Truck, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { useApi } from '@/lib/use-api';
import { ApiRequestError, PUBLIC_API_URL } from '@/lib/api';
import { api, getAccessToken } from '@/lib/client-api';
import { formatDateTime, formatMoney, orderStatusBadge } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/admin/PageHeader';
import { OrderStatusForm } from '@/components/admin/OrderStatusForm';

type PaymentStatus = 'REQUIRES_PAYMENT' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

interface OrderEvent {
  id: string;
  status: OrderStatus;
  message?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

interface OrderPayment {
  id: string;
  provider: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  failureReason?: string | null;
  refundedCents: number;
}

/** Shape returned by GET /admin/orders/:id (Order + relations included by adminGetById). */
interface AdminOrderDetail extends Order {
  payment?: OrderPayment | null;
  events?: OrderEvent[];
  user?: { id: string; email: string; name?: string | null } | null;
  cancelledAt?: string | null;
}

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  REQUIRES_PAYMENT: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SUCCEEDED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-800',
  REFUNDED: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-rose-100 text-rose-800',
};

function paymentLabel(status: PaymentStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Pull a readable shipping address out of the JSON snapshot. */
function shippingLines(snapshot: Record<string, unknown> | null | undefined): { name?: string; lines: string[] } {
  if (!snapshot) return { lines: [] };
  const get = (k: string) => (typeof snapshot[k] === 'string' ? (snapshot[k] as string) : undefined);
  const name = get('fullName') ?? get('name');
  const cityState = [get('city'), get('state')].filter(Boolean).join(', ');
  const cityLine = [cityState, get('postalCode')].filter(Boolean).join(' ');
  const lines = [get('line1'), get('line2'), cityLine, get('country'), get('phone')].filter(
    (v): v is string => Boolean(v),
  );
  return { name, lines };
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: order, error, isLoading, mutate } = useApi<AdminOrderDetail>(`/admin/orders/${id}`);
  const [downloading, setDownloading] = useState(false);
  const [shipping_, setShipping_] = useState(false);

  async function shipViaShiprocket() {
    setShipping_(true);
    try {
      await api.post(`/admin/orders/${id}/ship`);
      toast.success('Shipment created');
      await mutate();
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : 'Could not create the shipment';
      toast.error(message);
    } finally {
      setShipping_(false);
    }
  }

  async function downloadInvoice() {
    setDownloading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${PUBLIC_API_URL}/api/v1/orders/${id}/invoice`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate invoice');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order?.orderNumber ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the invoice');
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) return <CenteredSpinner label="Loading order…" />;

  if (error || !order) {
    return (
      <EmptyState
        icon={<Package className="h-10 w-10" />}
        title="Order not found"
        description="This order may have been removed or the link is incorrect."
        action={
          <Link href="/admin/orders">
            <Button variant="outline">Back to orders</Button>
          </Link>
        }
      />
    );
  }

  const badge = orderStatusBadge(order.status);
  const shipping = shippingLines(order.shippingSnapshot);
  const events = order.events ?? [];
  const canShip =
    !order.awbCode && !(['CANCELLED', 'REFUNDED', 'DELIVERED'] as OrderStatus[]).includes(order.status);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <PageHeader
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.createdAt)}`}
        action={
          <div className="flex items-center gap-3">
            <Badge className={badge.className}>{badge.label}</Badge>
            {canShip && (
              <Button onClick={shipViaShiprocket} loading={shipping_}>
                <Truck className="h-4 w-4" /> Ship via Shiprocket
              </Button>
            )}
            <Button variant="outline" onClick={downloadInvoice} loading={downloading}>
              <Download className="h-4 w-4" /> Invoice
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: items + totals + customer/shipping/payment */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card overflow-hidden">
            <header className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Items</h2>
            </header>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item: OrderItem) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.imageSnapshot ? (
                      <Image src={item.imageSnapshot} alt={item.nameSnapshot} fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{item.nameSnapshot}</p>
                    <p className="text-xs text-slate-500">SKU {item.skuSnapshot}</p>
                    {item.options && Object.keys(item.options).length > 0 && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {Object.entries(item.options)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    )}
                    {item.customText && <p className="mt-0.5 text-xs italic text-slate-500">“{item.customText}”</p>}
                    {item.modelLink && (
                      <a
                        href={item.modelLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> MakerWorld model
                      </a>
                    )}
                    {item.customUploadUrl && (
                      <a
                        href={item.customUploadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                      >
                        <Download className="h-3 w-3" /> Customer file
                      </a>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-slate-500">
                      {formatMoney(item.unitPriceCents, order.currency)} × {item.quantity}
                    </p>
                    <p className="font-medium tabular-nums text-slate-900">
                      {formatMoney(item.totalCents, order.currency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotalCents, order.currency)} />
              {order.discountCents > 0 && (
                <Row label="Discount" value={`−${formatMoney(order.discountCents, order.currency)}`} accent="text-emerald-600" />
              )}
              <Row label="Shipping" value={formatMoney(order.shippingCents, order.currency)} />
              <Row label="Tax" value={formatMoney(order.taxCents, order.currency)} />
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(order.totalCents, order.currency)}</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <InfoCard icon={<UserIcon className="h-4 w-4" />} title="Customer">
              <p className="font-medium text-slate-900">{order.user?.name ?? 'Guest'}</p>
              <p className="text-slate-600">{order.email}</p>
              {order.user ? (
                <Link href={`/admin/users?search=${encodeURIComponent(order.user.email)}`} className="mt-1 inline-block text-xs text-brand-600 hover:underline">
                  View account
                </Link>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Guest checkout</p>
              )}
            </InfoCard>

            <InfoCard icon={<MapPin className="h-4 w-4" />} title="Shipping address">
              {shipping.name || shipping.lines.length > 0 ? (
                <>
                  {shipping.name && <p className="font-medium text-slate-900">{shipping.name}</p>}
                  {shipping.lines.map((line, i) => (
                    <p key={i} className="text-slate-600">
                      {line}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-slate-400">No shipping snapshot.</p>
              )}
              {(order.trackingNumber || order.carrier) && (
                <p className="mt-2 text-xs text-slate-500">
                  {order.carrier && <span className="font-medium">{order.carrier} </span>}
                  {order.trackingNumber}
                </p>
              )}
            </InfoCard>
          </div>

          <InfoCard icon={<CreditCard className="h-4 w-4" />} title="Payment">
            {order.payment ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={PAYMENT_BADGE[order.payment.status] ?? 'bg-slate-100 text-slate-700'}>
                    {paymentLabel(order.payment.status)}
                  </Badge>
                  <span className="text-slate-600">
                    {formatMoney(order.payment.amountCents, order.payment.currency)} via{' '}
                    {order.payment.provider.toLowerCase()}
                  </span>
                </div>
                {order.payment.refundedCents > 0 && (
                  <p className="text-xs text-slate-500">
                    Refunded {formatMoney(order.payment.refundedCents, order.payment.currency)}
                  </p>
                )}
                {order.payment.failureReason && (
                  <p className="text-xs text-rose-600">{order.payment.failureReason}</p>
                )}
                {order.payment.razorpayPaymentId && (
                  <p className="font-mono text-xs text-slate-500">Razorpay: {order.payment.razorpayPaymentId}</p>
                )}
              </div>
            ) : (
              <p className="text-slate-400">No payment recorded yet.</p>
            )}
          </InfoCard>

          {order.awbCode && (
            <InfoCard icon={<Truck className="h-4 w-4" />} title="Shipment">
              <div className="space-y-1">
                {order.courierName && (
                  <Row label="Courier" value={order.courierName} />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">AWB</span>
                  <span className="font-mono text-slate-700">{order.awbCode}</span>
                </div>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                  >
                    Track shipment <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </InfoCard>
          )}
        </div>

        {/* Right column: status update + timeline */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Update fulfilment</h2>
            <OrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
              currentTracking={order.trackingNumber}
              currentCarrier={order.carrier}
              onUpdated={() => void mutate()}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-slate-400">No events yet.</p>
            ) : (
              <ol className="relative space-y-5 border-l border-slate-200 pl-5">
                {events.map((ev) => {
                  const evBadge = orderStatusBadge(ev.status);
                  return (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                      <div className="flex items-center gap-2">
                        <Badge className={evBadge.className}>{evBadge.label}</Badge>
                        <time className="text-xs text-slate-400">{formatDateTime(ev.createdAt)}</time>
                      </div>
                      {ev.message && <p className="mt-1 text-sm text-slate-600">{ev.message}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={accent ?? 'text-slate-700'}>{value}</span>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className="text-slate-400">{icon}</span>
        {title}
      </div>
      <div className="space-y-0.5 text-sm">{children}</div>
    </section>
  );
}
