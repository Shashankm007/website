'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';
import type { CreateRazorpayOrderResponse } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { formatMoney } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/Button';

/**
 * Resumes payment for an existing PENDING order: fetches (or reuses) the Razorpay
 * order, opens Razorpay Checkout, verifies the signature server-side, then sends
 * the customer to the confirmation page. Drop-in for the orders list / detail.
 */
export function ResumePaymentButton({
  orderId,
  orderNumber,
  totalCents,
  size = 'sm',
  variant = 'primary',
  className,
  onPaid,
  label,
}: {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
  /** Called after a verified payment, before navigating (e.g. to mutate SWR). */
  onPaid?: () => void | Promise<void>;
  label?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const resume = async (e: React.MouseEvent) => {
    // Guard against the click bubbling to a wrapping <Link>.
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      const { data: rzp } = await api.post<CreateRazorpayOrderResponse>('/payments/create-order', { orderId });
      if (!rzp.keyId) {
        toast.error('Online payments aren’t configured yet. Please try again later.');
        return;
      }

      const resp = await openRazorpayCheckout({
        key: rzp.keyId,
        amount: rzp.amount,
        currency: rzp.currency,
        orderId: rzp.razorpayOrderId,
        name: 'HashTag Creations',
        description: `Order ${orderNumber}`,
        prefill: { name: user?.name ?? undefined, email: user?.email ?? undefined },
        notes: { orderNumber },
      });

      await api.post('/payments/verify', {
        orderId,
        razorpayOrderId: resp.razorpay_order_id,
        razorpayPaymentId: resp.razorpay_payment_id,
        razorpaySignature: resp.razorpay_signature,
      });

      toast.success('Payment successful');
      await onPaid?.();
      router.push(`/checkout/success?order=${encodeURIComponent(orderNumber)}`);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not complete payment';
      if (msg === 'Payment cancelled') toast.info('Payment cancelled — you can resume any time.');
      else toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <Button size={size} variant={variant} className={className} loading={loading} onClick={resume}>
      <CreditCard className="h-4 w-4" /> {label ?? `Resume payment · ${formatMoney(totalCents)}`}
    </Button>
  );
}
