'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, ImageOff, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';

export default function CartPage() {
  const { cart, loading, refresh, update, remove } = useCart();
  const [mounted, setMounted] = useState(false);
  // Track per-item pending state to disable controls during a mutation.
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void refresh().finally(() => setMounted(true));
  }, [refresh]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busy[id]) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update your cart');
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const changeQty = (id: string, qty: number) => withBusy(id, () => update(id, qty));
  const removeItem = (id: string) =>
    withBusy(id, async () => {
      await remove(id);
      toast.success('Removed from cart');
    });

  // Show a spinner only on first load (before we know whether the cart is empty).
  if (!mounted && loading) {
    return (
      <div className="container-page">
        <CenteredSpinner label="Loading your cart…" />
      </div>
    );
  }

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="container-page max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Your cart</h1>
        <EmptyState
          icon={<ShoppingCart className="h-10 w-10" />}
          title="Your cart is empty"
          description="Browse our catalog of premium 3D-printed products and custom prints to get started."
          action={
            <Link href="/products">
              <Button size="lg">Browse products</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your cart</h1>
        <span className="text-sm text-slate-500">
          {cart?.itemCount} item{(cart?.itemCount ?? 0) === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="card divide-y divide-slate-200">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 p-4 sm:p-5">
              <Link
                href={`/products/${item.slug}`}
                className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100"
              >
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="96px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/products/${item.slug}`} className="line-clamp-2 font-medium text-slate-900 hover:text-brand-700">
                      {item.name}
                    </Link>
                    {item.options && Object.keys(item.options).length > 0 && (
                      <p className="mt-0.5 text-sm text-slate-500">
                        {Object.entries(item.options)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    )}
                    {item.customText && <p className="mt-0.5 text-sm italic text-slate-500">&ldquo;{item.customText}&rdquo;</p>}
                    {item.modelLink && (
                      <a
                        href={item.modelLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-block text-xs font-medium text-brand-600 hover:underline"
                      >
                        MakerWorld model ↗
                      </a>
                    )}
                    {item.customUploadUrl && (
                      <p className="mt-0.5 text-xs text-slate-500">Custom file attached</p>
                    )}
                    {!item.inStock && <p className="mt-1 text-xs font-medium text-rose-600">Currently out of stock</p>}
                  </div>
                  <button
                    onClick={() => void removeItem(item.id)}
                    disabled={busy[item.id]}
                    className="h-fit rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-auto flex items-end justify-between pt-3">
                  <div className="inline-flex items-center rounded-lg border border-slate-300">
                    <button
                      onClick={() => void changeQty(item.id, Math.max(1, item.quantity - 1))}
                      disabled={busy[item.id] || item.quantity <= 1}
                      className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => void changeQty(item.id, item.quantity + 1)}
                      disabled={busy[item.id]}
                      className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{formatMoney(item.lineTotalCents)}</p>
                    {item.quantity > 1 && <p className="text-xs text-slate-500">{formatMoney(item.unitPriceCents)} each</p>}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="space-y-4">
          <div className="card sticky top-24 p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Summary</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium text-slate-900">{formatMoney(cart?.subtotalCents ?? 0)}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Shipping &amp; taxes calculated at checkout.</p>
            <Link href="/checkout" className="mt-5 block">
              <Button size="lg" className="w-full">
                <ShoppingBag className="h-4 w-4" /> Proceed to checkout
              </Button>
            </Link>
            <Link
              href="/products"
              className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700"
            >
              <ArrowLeft className="h-4 w-4" /> Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
