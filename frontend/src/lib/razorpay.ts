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
  /** Called on a failed attempt. Does NOT end the flow — Razorpay keeps the modal open for retry. */
  onFailure?: (reason: string) => void;
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
 * Opens the Razorpay modal and resolves with the signed handler response on a
 * SUCCESSFUL payment (verify it server-side before trusting it).
 *
 * A failed attempt does NOT end the flow: Razorpay keeps the modal open so the
 * user can retry (e.g. switch UPI app or card). We only surface the reason via
 * `onFailure`. The eventual success still fires `handler` (→ resolve), and if
 * the user closes the modal `ondismiss` fires (→ reject 'Payment cancelled').
 * This is what makes a "fail → retry → succeed" flow reflect on the site.
 */
export async function openRazorpayCheckout(options: OpenCheckoutOptions): Promise<RazorpayHandlerResponse> {
  const ok = await loadRazorpay();
  if (!ok) throw new Error('Failed to load Razorpay checkout');

  return new Promise<RazorpayHandlerResponse>((resolve, reject) => {
    const RazorpayCtor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => RazorpayInstance })
      .Razorpay;

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

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
      // Razorpay calls this with the signed response once a payment SUCCEEDS,
      // including after one or more failed attempts in the same modal.
      handler: (resp: RazorpayHandlerResponse) => finish(() => resolve(resp)),
      // User closed the modal without a successful payment.
      modal: { ondismiss: () => finish(() => reject(new Error('Payment cancelled'))) },
    });

    // Surface a failed attempt but keep the modal open for retry — do not settle.
    rzp.on('payment.failed', (resp: { error?: { description?: string } }) => {
      options.onFailure?.(resp?.error?.description ?? 'Payment failed. Please try again.');
    });

    rzp.open();
  });
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
}
