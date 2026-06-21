'use client';

/**
 * Razorpay Checkout helper. Loads the hosted checkout.js script on demand and
 * opens the payment modal, resolving with the handler response on success.
 * The publishable key id is safe to expose; the secret never touches the client.
 */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise: Promise<boolean> | null = null;

export interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface OpenCheckoutOptions {
  key: string; // Razorpay key id (rzp_...)
  amount: number; // paise
  currency: string; // INR
  orderId: string; // Razorpay order id (order_...)
  name: string; // merchant/brand name
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  themeColor?: string;
}

/** Inject checkout.js once; resolves true when window.Razorpay is available. */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise<boolean>((resolve) => {
      const s = document.createElement('script');
      s.src = CHECKOUT_SRC;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Opens the Razorpay modal. Resolves with the signed handler response (to be
 * verified server-side via POST /payments/verify); rejects on dismiss/failure.
 */
export async function openRazorpayCheckout(options: OpenCheckoutOptions): Promise<RazorpayHandlerResponse> {
  const ok = await loadRazorpay();
  if (!ok) throw new Error('Failed to load Razorpay checkout');

  return new Promise<RazorpayHandlerResponse>((resolve, reject) => {
    const RazorpayCtor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => RazorpayInstance })
      .Razorpay;
    const rzp = new RazorpayCtor({
      key: options.key,
      amount: options.amount,
      currency: options.currency,
      order_id: options.orderId,
      name: options.name,
      description: options.description,
      prefill: options.prefill,
      notes: options.notes,
      theme: { color: options.themeColor ?? '#4f46e5' },
      handler: (resp: RazorpayHandlerResponse) => resolve(resp),
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    let settled = false;
    const forceClose = () => {
      try {
        if (typeof (rzp as any).close === 'function') (rzp as any).close();
      } catch (e) {
        // Fallback: remove any Razorpay iframe(s) from the DOM
        try {
          const iframes = Array.from(document.getElementsByTagName('iframe')) as HTMLIFrameElement[];
          for (const f of iframes) {
            const src = f.src || '';
            if (src.includes('checkout.razorpay.com') || src.includes('razorpay.com')) f.remove();
          }
          // remove any overlays that Razorpay may have added
          const overlays = Array.from(document.querySelectorAll('[id^="razorpay-"]'));
          overlays.forEach((el) => el.remove());
        } catch {}
      }
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      forceClose();
      fn();
    };

    rzp.on('payment.failed', (resp: { error?: { description?: string } }) =>
      settle(() => reject(new Error(resp?.error?.description ?? 'Payment failed'))),
    );

    // Safety timeout: if user/checkout hangs, close modal and reject after 60s
    const timeout = setTimeout(() => settle(() => reject(new Error('Payment timeout'))), 60000);

    const cleanup = () => clearTimeout(timeout);
    // Wrap resolve/reject to cleanup timer
    const origResolve = resolve;
    const origReject = reject;
    // override via rzp handler by wrapping
    (rzp as any).handler = (resp: RazorpayHandlerResponse) => {
      cleanup();
      settle(() => origResolve(resp));
    };
    rzp.open();
  });
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
}
