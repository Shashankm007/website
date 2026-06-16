'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/** Slide-over cart accessible from the navbar. */
export function CartDrawer() {
  const { cart, open, setOpen, update, remove } = useCart();

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-slate-900/40 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingBag className="h-5 w-5" /> Your cart
          </h2>
          <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close cart">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!cart || cart.items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
              <ShoppingBag className="mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium">Your cart is empty</p>
              <Link href="/products" onClick={() => setOpen(false)} className="mt-4 text-sm font-medium text-brand-700">
                Browse products →
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="80px" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <Link href={`/products/${item.slug}`} onClick={() => setOpen(false)} className="line-clamp-1 text-sm font-medium">
                        {item.name}
                      </Link>
                      <button onClick={() => void remove(item.id)} className="text-slate-400 hover:text-rose-600" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {item.options && Object.keys(item.options).length > 0 && (
                      <p className="text-xs text-slate-500">
                        {Object.entries(item.options)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    )}
                    {item.customText && <p className="text-xs italic text-slate-500">“{item.customText}”</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-lg border border-slate-200">
                        <button
                          onClick={() => void update(item.id, Math.max(1, item.quantity - 1))}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-50"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => void update(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-50"
                          aria-label="Increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold">{formatMoney(item.lineTotalCents)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart && cart.items.length > 0 && (
          <div className="border-t border-slate-200 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="text-lg font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
            <p className="mb-3 text-xs text-slate-500">Shipping & taxes calculated at checkout.</p>
            <Link href="/checkout" onClick={() => setOpen(false)}>
              <Button className="w-full" size="lg">
                Checkout
              </Button>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
