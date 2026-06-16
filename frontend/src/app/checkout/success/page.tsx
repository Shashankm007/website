'use client';

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Package, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner } from '@/components/ui/Feedback';

function SuccessContent() {
  const params = useSearchParams();
  const orderNumber = params.get('order');
  const paymentIntent = params.get('payment_intent');
  const refresh = useCart((s) => s.refresh);
  const refreshed = useRef(false);

  // Clear the (now-purchased) cart once after landing here.
  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    void refresh();
  }, [refresh]);

  return (
    <div className="container-page flex max-w-xl flex-col items-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-11 w-11 text-emerald-600" />
      </div>

      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Thank you for your order!</h1>
      <p className="mt-3 max-w-md text-slate-600">
        Your payment was successful and we&rsquo;ve started processing your order. A confirmation email is on its way.
      </p>

      {orderNumber && (
        <div className="card mt-8 w-full p-6">
          <p className="text-sm text-slate-500">Order number</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{orderNumber}</p>
          {paymentIntent && <p className="mt-2 break-all text-xs text-slate-400">Payment reference: {paymentIntent}</p>}
        </div>
      )}

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/account/orders" className="sm:w-auto">
          <Button size="lg" className="w-full">
            <Package className="h-4 w-4" /> View my orders
          </Button>
        </Link>
        <Link href="/products" className="sm:w-auto">
          <Button size="lg" variant="outline" className="w-full">
            <ShoppingBag className="h-4 w-4" /> Continue shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading…" />}>
      <SuccessContent />
    </Suspense>
  );
}
