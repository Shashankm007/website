'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Tag, X } from 'lucide-react';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface AppliedCoupon {
  code: string;
  discountCents: number;
}

/**
 * Coupon entry that previews a discount via POST /coupons/validate. Lifts the
 * applied coupon up so the parent can pass `couponCode` to the order endpoint.
 */
export function CouponField({
  subtotalCents,
  applied,
  onApply,
  onClear,
  disabled,
}: {
  subtotalCents: number;
  applied: AppliedCoupon | null;
  onApply: (coupon: AppliedCoupon) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = async () => {
    const trimmed = code.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const { data } = await api.post<{ code: string; discountCents: number }>('/coupons/validate', {
        code: trimmed,
        subtotalCents,
      });
      onApply({ code: data.code, discountCents: data.discountCents });
      toast.success(`Coupon applied — you save ${formatMoney(data.discountCents)}`);
      setCode('');
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'That coupon could not be applied';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
          <Check className="h-4 w-4" />
          {applied.code} — {formatMoney(applied.discountCents)} off
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          aria-label="Remove coupon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="coupon-code" className="label-base flex items-center gap-1.5">
        <Tag className="h-4 w-4 text-slate-400" /> Have a coupon?
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          name="coupon-code"
          placeholder="Enter code"
          value={code}
          disabled={disabled || loading}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void validate();
            }
          }}
        />
        <Button type="button" variant="outline" loading={loading} disabled={disabled || !code.trim()} onClick={() => void validate()}>
          Apply
        </Button>
      </div>
    </div>
  );
}
