'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import type { CreateRazorpayOrderResponse, Order } from '@/types';
import { api } from '@/lib/client-api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/**
 * Opens Razorpay Checkout for a created order, then verifies the returned
 * signature server-side (POST /payments/verify) before treating it as paid.
 */
export function RazorpayCheckout({
  order,
  payment,
  customer,
  returnUrl,
  onSuccess,
}: {
  order: Order;
  payment: CreateRazorpayOrderResponse;
  customer?: { name?: string | null; email?: string | null; phone?: string | null };
  returnUrl: string;
  onSuccess?: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // Razorpay not configured (no key) — surface a clear message rather than a broken modal.
  if (!payment.keyId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Online payments aren’t configured yet. Add <code>RAZORPAY_KEY_ID</code> /{' '}
        <code>RAZORPAY_KEY_SECRET</code> on the server and{' '}
        <code>NEXT_PUBLIC_RAZORPAY_KEY_ID</code> on the client to enable checkout.
      </div>
    );
  }

  const pay = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const resp = await openRazorpayCheckout({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        orderId: payment.razorpayOrderId,
        name: 'HashTag Creations',
        description: `Order ${order.orderNumber}`,
        prefill: {
          name: customer?.name ?? undefined,
          email: customer?.email ?? undefined,
          contact: customer?.phone ?? undefined,
        },
        notes: { orderNumber: order.orderNumber },
      });

      // Verify server-side and create Shiprocket shipment before treating the order as paid.
      // If the confirm request fails (network/timeout/shiprocket), retry a few times
      // then poll the order status until it's PAID so the SPA can show success.
      const confirmBody = {
        orderId: order.id,
        razorpayOrderId: resp.razorpay_order_id,
        razorpayPaymentId: resp.razorpay_payment_id,
        razorpaySignature: resp.razorpay_signature,
      };

      const maxAttempts = 3;
      let attempt = 0;
      let confirmed = false;
      while (attempt < maxAttempts && !confirmed) {
        attempt += 1;
        try {
          await api.post('/checkout/confirm', confirmBody);
          confirmed = true;
          break;
        } catch (e) {
          // small backoff before retry
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }

      if (!confirmed) {
        // Poll order status until PAID (30s total) so that transient failures don't leave the user confused.
        const start = Date.now();
        const timeoutMs = 30000;
        const pollInterval = 2000;
        while (Date.now() - start < timeoutMs) {
          try {
            const { data: polled } = await api.get(`/orders/${order.id}`);
            if ((polled as any).status === 'PAID') {
              confirmed = true;
              break;
            }
          } catch (_) {
            // ignore and retry
          }
          await new Promise((r) => setTimeout(r, pollInterval));
        }
      }

      if (!confirmed) throw new Error('Payment succeeded but server confirmation pending; please check Orders page.');

      await onSuccess?.();
      router.push(returnUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      if (msg === 'Payment cancelled') toast.info('Payment cancelled — you can try again.');
      else toast.error(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        Pay securely with <strong>Razorpay</strong> — UPI, cards, net banking & wallets all supported.
      </div>
      <Button onClick={pay} size="lg" className="w-full" loading={submitting}>
        <Lock className="h-4 w-4" /> Pay {formatMoney(order.totalCents)}
      </Button>
      <p className="text-center text-xs text-slate-500">
        Payments are securely processed by Razorpay. Your card/UPI details never touch our servers.
      </p>
    </div>
  );
}
