'use client';

import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import type { CartView, Order } from '@/types';
import { formatMoney } from '@/lib/utils';

/** A single summary line (label + value). */
function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-slate-500' : 'text-slate-600'}>{label}</span>
      <span className={muted ? 'text-slate-500' : 'font-medium text-slate-900'}>{value}</span>
    </div>
  );
}

interface Totals {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * Order summary panel. Before an order exists it renders the cart line items
 * with a previewed discount; once the order is created it renders the
 * server-computed totals (which are authoritative).
 */
export function OrderSummary({
  cart,
  order,
  discountPreviewCents = 0,
  title = 'Order summary',
}: {
  cart?: CartView | null;
  order?: Order | null;
  discountPreviewCents?: number;
  title?: string;
}) {
  const items = order
    ? order.items.map((i) => ({
        id: i.id,
        name: i.nameSnapshot,
        imageUrl: i.imageSnapshot,
        options: i.options ?? undefined,
        customText: i.customText,
        quantity: i.quantity,
        lineTotalCents: i.totalCents,
      }))
    : (cart?.items ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        imageUrl: i.imageUrl,
        options: i.options,
        customText: i.customText,
        quantity: i.quantity,
        lineTotalCents: i.lineTotalCents,
      }));

  const totals: Totals | null = order
    ? {
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        shippingCents: order.shippingCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
      }
    : cart
      ? {
          subtotalCents: cart.subtotalCents,
          discountCents: discountPreviewCents,
          shippingCents: 0,
          taxCents: 0,
          totalCents: Math.max(0, cart.subtotalCents - discountPreviewCents),
        }
      : null;

  return (
    <div className="card sticky top-24 p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>

      <ul className="mb-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">
                  <ImageOff className="h-5 w-5" />
                </div>
              )}
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-900 px-1 text-[11px] font-medium text-white">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-medium text-slate-900">{item.name}</p>
              {item.options && Object.keys(item.options).length > 0 && (
                <p className="line-clamp-1 text-xs text-slate-500">
                  {Object.entries(item.options)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')}
                </p>
              )}
              {item.customText && <p className="line-clamp-1 text-xs italic text-slate-500">&ldquo;{item.customText}&rdquo;</p>}
            </div>
            <span className="text-sm font-medium text-slate-900">{formatMoney(item.lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      {totals && (
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <Line label="Subtotal" value={formatMoney(totals.subtotalCents)} />
          {totals.discountCents > 0 && (
            <Line label="Discount" value={`-${formatMoney(totals.discountCents)}`} />
          )}
          <Line
            label="Shipping"
            value={order ? (totals.shippingCents === 0 ? 'Free' : formatMoney(totals.shippingCents)) : 'Calculated at next step'}
            muted={!order}
          />
          <Line label="GST (18%)" value={order ? formatMoney(totals.taxCents) : 'Calculated at next step'} muted={!order} />
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-base font-semibold text-slate-900">Total</span>
            <span className="text-base font-semibold text-slate-900">{formatMoney(totals.totalCents)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
