'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Check, CreditCard, MapPin, Plus, ShoppingCart } from 'lucide-react';
import type { Address, CreateRazorpayOrderResponse, Order } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-store';
import { useApi } from '@/lib/use-api';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { cn, formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner, EmptyState, Spinner } from '@/components/ui/Feedback';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AddressForm, type AddressFormValues } from '@/components/checkout/AddressForm';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { CouponField, type AppliedCoupon } from '@/components/checkout/CouponField';
import { RazorpayCheckout } from '@/components/checkout/RazorpayCheckout';

type Step = 1 | 2;

const NEW_ADDRESS = '__new__';
const ADDRESS_FORM_ID = 'checkout-address-form';

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1 as const, label: 'Shipping', icon: MapPin },
    { n: 2 as const, label: 'Payment', icon: CreditCard },
  ];
  return (
    <ol className="mb-8 flex items-center gap-3">
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        const Icon = s.icon;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition',
                  done && 'border-brand-600 bg-brand-600 text-white',
                  active && 'border-brand-600 bg-brand-50 text-brand-700',
                  !done && !active && 'border-slate-300 bg-white text-slate-400',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className={cn('text-sm font-medium', active || done ? 'text-slate-900' : 'text-slate-400')}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <span className={cn('h-px flex-1', done ? 'bg-brand-600' : 'bg-slate-200')} />}
          </li>
        );
      })}
    </ol>
  );
}

function CheckoutFlow() {
  const { user } = useAuth();
  const { cart, refresh } = useCart();

  const { data: addresses, isLoading: addressesLoading } = useApi<Address[]>('/users/me/addresses');

  const [step, setStep] = useState<Step>(1);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [inlineAddress, setInlineAddress] = useState<AddressFormValues | null>(null);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  // Payment state (populated when the order is created in step 2).
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<CreateRazorpayOrderResponse | null>(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);

  // Ensure the cart is current.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Default the address selection: prefer the default saved address.
  useEffect(() => {
    if (!addresses || selectedAddressId) return;
    if (addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      setSelectedAddressId(def.id);
    } else {
      setSelectedAddressId(NEW_ADDRESS);
    }
  }, [addresses, selectedAddressId]);

  const usingNewAddress = selectedAddressId === NEW_ADDRESS;
  const cartEmpty = !cart || cart.items.length === 0;
  const subtotalCents = cart?.subtotalCents ?? 0;

  // Build the order payload from the selected/entered shipping address.
  const buildOrderBody = (shipping: AddressFormValues | null) => {
    const base: Record<string, unknown> = {
      email: user?.email,
      couponCode: coupon?.code,
    };
    if (usingNewAddress) {
      if (!shipping) return null;
      base.shippingAddress = {
        fullName: shipping.fullName,
        line1: shipping.line1,
        line2: shipping.line2 || undefined,
        city: shipping.city,
        state: shipping.state || undefined,
        postalCode: shipping.postalCode,
        country: shipping.country,
        phone: shipping.phone || undefined,
      };
    } else {
      base.shippingAddressId = selectedAddressId;
    }
    return base;
  };

  const placeOrder = async (shipping: AddressFormValues | null) => {
    if (placingRef.current) return;
    if (cartEmpty) {
      toast.error('Your cart is empty');
      return;
    }
    const body = buildOrderBody(shipping);
    if (!body) {
      toast.error('Please complete your shipping address');
      return;
    }

    placingRef.current = true;
    setPlacing(true);
    try {
      const { data: createdOrder } = await api.post<Order>('/orders', body);
      // Initiate Shiprocket-hosted checkout session and redirect URL
      const { data: resp } = await api.post<{ redirectUrl: string }>('/checkout/initiate', {
        orderId: createdOrder.id,
        returnUrl: `/checkout/success?order=${encodeURIComponent(createdOrder.orderNumber)}`,
      });
      if (resp?.redirectUrl) {
        // Redirect the browser to Shiprocket hosted checkout
        window.location.href = resp.redirectUrl;
        return;
      }
      // Fallback: proceed to payment step (legacy Razorpay flow)
      const { data: rzp } = await api.post<CreateRazorpayOrderResponse>('/payments/create-order', {
        orderId: createdOrder.id,
      });
      if (!rzp.razorpayOrderId) {
        throw new ApiRequestError('PAYMENT_ERROR', 'Could not initialize payment. Please try again.', 500);
      }
      setOrder(createdOrder);
      setPayment(rzp);
      setStep(2);
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Could not place your order. Please try again.';
      toast.error(message);
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  // Step 1 "continue": if a new address, defer to the form's submit handler;
  // otherwise place the order immediately with the saved address.
  const continueFromShipping = () => {
    if (placing) return;
    if (usingNewAddress) {
      // Trigger react-hook-form validation + submit; placeOrder runs in onSubmit.
      document.getElementById(ADDRESS_FORM_ID)?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    } else {
      if (!selectedAddressId) {
        toast.error('Please choose a shipping address');
        return;
      }
      void placeOrder(null);
    }
  };

  const onPaymentSuccess = async () => {
    await refresh();
  };

  const summary = useMemo(
    () => <OrderSummary cart={cart} order={order} discountPreviewCents={coupon?.discountCents ?? 0} />,
    [cart, order, coupon],
  );

  if (cartEmpty && step === 1) {
    return (
      <div className="container-page max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Checkout</h1>
        <EmptyState
          icon={<ShoppingCart className="h-10 w-10" />}
          title="Your cart is empty"
          description="Add some products before checking out."
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
    <div className="container-page max-w-5xl">
      <div className="mb-6">
        <Link href="/cart" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to cart
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
      </div>

      <Stepper step={step} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {step === 1 && (
            <>
              <section className="card p-5">
                <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
                  <MapPin className="h-5 w-5 text-brand-600" /> Shipping address
                </h2>

                {addressesLoading ? (
                  <CenteredSpinner label="Loading addresses…" />
                ) : (
                  <div className="space-y-3">
                    {(addresses ?? []).map((addr) => (
                      <label
                        key={addr.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition',
                          selectedAddressId === addr.id ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300',
                        )}
                      >
                        <input
                          type="radio"
                          name="shipping-address"
                          className="mt-1 h-4 w-4 accent-brand-600"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                        />
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">
                            {addr.fullName}
                            {addr.isDefault && <span className="ml-2 text-xs font-normal text-brand-600">Default</span>}
                          </p>
                          <p className="text-slate-600">
                            {addr.line1}
                            {addr.line2 ? `, ${addr.line2}` : ''}
                          </p>
                          <p className="text-slate-600">
                            {addr.city}
                            {addr.state ? `, ${addr.state}` : ''} {addr.postalCode}, {addr.country}
                          </p>
                          {addr.phone && <p className="text-slate-500">{addr.phone}</p>}
                        </div>
                      </label>
                    ))}

                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition',
                        usingNewAddress ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <input
                        type="radio"
                        name="shipping-address"
                        className="h-4 w-4 accent-brand-600"
                        checked={usingNewAddress}
                        onChange={() => setSelectedAddressId(NEW_ADDRESS)}
                      />
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        <Plus className="h-4 w-4" /> Use a new address
                      </span>
                    </label>

                    {usingNewAddress && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <AddressForm
                          formId={ADDRESS_FORM_ID}
                          defaultValues={inlineAddress ?? { fullName: user?.name ?? '' }}
                          onSubmit={(values) => {
                            setInlineAddress(values);
                            void placeOrder(values);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="card p-5">
                <CouponField
                  subtotalCents={subtotalCents}
                  applied={coupon}
                  onApply={setCoupon}
                  onClear={() => setCoupon(null)}
                  disabled={placing}
                />
              </section>

              <Button size="lg" className="w-full" loading={placing} onClick={continueFromShipping}>
                Continue to payment
              </Button>
            </>
          )}

          {step === 2 && order && payment && (
            <section className="card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
                <CreditCard className="h-5 w-5 text-brand-600" /> Payment
              </h2>
              <p className="mb-5 text-sm text-slate-500">
                Order <span className="font-medium text-slate-700">{order.orderNumber}</span> · Pay{' '}
                <span className="font-medium text-slate-700">{formatMoney(order.totalCents)}</span> to complete your purchase.
              </p>
              <RazorpayCheckout
                order={order}
                payment={payment}
                customer={{ name: user?.name, email: user?.email }}
                returnUrl={`/checkout/success?order=${encodeURIComponent(order.orderNumber)}`}
                onSuccess={onPaymentSuccess}
              />
            </section>
          )}

          {step === 2 && (!order || !payment) && (
            <div className="card flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Spinner /> Preparing payment…
            </div>
          )}
        </div>

        <aside>{summary}</aside>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <CheckoutFlow />
    </RequireAuth>
  );
}
