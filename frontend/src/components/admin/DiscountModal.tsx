'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BadgePercent, X } from 'lucide-react';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { cn, formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface DiscountTarget {
  id: string;
  name: string;
  priceCents: number;
  compareAtCents?: number | null;
  currency?: string;
}

/**
 * Quick per-product discount editor. Treats `compareAtCents` as the MRP/original
 * price and `priceCents` as the selling price, so applying a discount sets a sale
 * price below the MRP (PATCH /admin/products/:id). Supports % off or a fixed sale price.
 */
export function DiscountModal({
  product,
  onClose,
  onSaved,
}: {
  product: DiscountTarget | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<'percent' | 'price'>('percent');
  const [percent, setPercent] = useState('10');
  const [salePrice, setSalePrice] = useState('');
  const [saving, setSaving] = useState(false);

  if (!product) return null;

  const currency = product.currency ?? 'INR';
  const alreadyDiscounted = !!product.compareAtCents && product.compareAtCents > product.priceCents;
  // The MRP is the original price — the existing compare-at if already on sale, else the current price.
  const mrpCents = alreadyDiscounted ? product.compareAtCents! : product.priceCents;

  const saleCents = (() => {
    if (mode === 'percent') {
      const p = Number(percent);
      if (!Number.isFinite(p) || p <= 0) return null;
      return Math.max(0, Math.round(mrpCents * (1 - p / 100)));
    }
    const rs = Number(salePrice);
    if (!Number.isFinite(rs) || rs <= 0) return null;
    return Math.round(rs * 100);
  })();

  const valid = saleCents !== null && saleCents > 0 && saleCents < mrpCents;
  const pctOff = saleCents !== null && mrpCents > 0 ? Math.round(((mrpCents - saleCents) / mrpCents) * 100) : 0;

  const apply = async () => {
    if (!valid || saleCents === null) {
      toast.error('Enter a valid discount — the sale price must be below the MRP.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/admin/products/${product.id}`, { priceCents: saleCents, compareAtCents: mrpCents });
      toast.success(`Discount applied — ${pctOff}% off`);
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : 'Could not apply discount');
    } finally {
      setSaving(false);
    }
  };

  const removeDiscount = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/products/${product.id}`, { priceCents: mrpCents, compareAtCents: null });
      toast.success('Discount removed');
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : 'Could not remove discount');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <div className="card relative z-10 w-full max-w-md p-6">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <BadgePercent className="h-5 w-5 text-brand-600" /> Add discount
        </h2>
        <p className="mt-1 line-clamp-1 text-sm text-slate-500">{product.name}</p>
        <p className="mt-3 text-sm text-slate-600">
          MRP <span className="font-medium text-slate-900">{formatMoney(mrpCents, currency)}</span>
          {alreadyDiscounted && <> · currently {formatMoney(product.priceCents, currency)}</>}
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-slate-200 p-1">
          {(['percent', 'price'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                mode === m ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {m === 'percent' ? '% off' : 'Sale price'}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {mode === 'percent' ? (
            <Input
              label="Discount %"
              type="number"
              min={1}
              max={95}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          ) : (
            <Input
              label="Sale price (₹)"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
          {valid && saleCents !== null ? (
            <span className="flex flex-wrap items-center gap-2">
              New price <span className="font-semibold text-slate-900">{formatMoney(saleCents, currency)}</span>
              <span className="text-slate-400 line-through">{formatMoney(mrpCents, currency)}</span>
              <span className="rounded bg-rose-600 px-1.5 py-0.5 text-xs font-semibold text-white">{pctOff}% OFF</span>
            </span>
          ) : (
            <span className="text-slate-400">Enter a discount to preview the new price.</span>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {alreadyDiscounted ? (
            <Button variant="ghost" onClick={removeDiscount} loading={saving} className="text-rose-600">
              Remove discount
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={apply} loading={saving} disabled={!valid}>
              Apply discount
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
