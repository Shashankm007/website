'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { DiscountType } from '@/types';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

/** Full coupon row returned by the admin list, used for editing. */
export interface AdminCoupon {
  id: string;
  code: string;
  description?: string | null;
  type: DiscountType;
  value: number;
  minSubtotalCents?: number | null;
  maxRedemptions?: number | null;
  perUserLimit?: number | null;
  redemptions?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  active: boolean;
}

const schema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(40),
  description: z.string().max(255).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.coerce.number({ invalid_type_error: 'Enter a value' }).min(0, 'Must be ≥ 0'),
  minSubtotal: z.string().optional(),
  maxRedemptions: z.string().optional(),
  perUserLimit: z.string().optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
  active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const toDatetimeLocal = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const intOrUndefined = (v?: string): number | undefined => {
  if (!v || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : Math.round(n);
};

interface CouponFormProps {
  coupon?: AdminCoupon;
  onSaved: () => void;
  onCancel: () => void;
}

export function CouponForm({ coupon, onSaved, onCancel }: CouponFormProps) {
  const isEdit = !!coupon;
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: coupon?.code ?? '',
      description: coupon?.description ?? '',
      type: coupon?.type ?? 'PERCENTAGE',
      // FIXED values are stored as cents → show dollars; PERCENTAGE values are whole percents.
      value: coupon ? (coupon.type === 'FIXED' ? coupon.value / 100 : coupon.value) : 0,
      minSubtotal: coupon?.minSubtotalCents != null ? (coupon.minSubtotalCents / 100).toFixed(2) : '',
      maxRedemptions: coupon?.maxRedemptions != null ? String(coupon.maxRedemptions) : '',
      perUserLimit: coupon?.perUserLimit != null ? String(coupon.perUserLimit) : '',
      startsAt: toDatetimeLocal(coupon?.startsAt),
      expiresAt: toDatetimeLocal(coupon?.expiresAt),
      active: coupon?.active ?? true,
    },
  });

  const type = watch('type');

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      code: values.code.trim().toUpperCase(),
      description: values.description?.trim() || undefined,
      type: values.type,
      // Percentage stays whole; fixed is converted dollars → cents.
      value: values.type === 'FIXED' ? Math.round(values.value * 100) : Math.round(values.value),
      minSubtotalCents:
        values.minSubtotal && values.minSubtotal.trim() !== '' ? Math.round(Number(values.minSubtotal) * 100) : undefined,
      maxRedemptions: intOrUndefined(values.maxRedemptions),
      perUserLimit: intOrUndefined(values.perUserLimit),
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      active: values.active,
    };
    try {
      if (isEdit) {
        await api.patch(`/admin/coupons/${coupon!.id}`, payload);
        toast.success('Coupon updated');
      } else {
        await api.post('/admin/coupons', payload);
        toast.success('Coupon created');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not save coupon');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Code" placeholder="SUMMER20" className="uppercase" error={errors.code?.message} {...register('code')} />
        <Select label="Type" {...register('type')}>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </Select>
        <Input
          label={type === 'FIXED' ? 'Amount (₹)' : 'Percent off (%)'}
          type="number"
          step={type === 'FIXED' ? '0.01' : '1'}
          min={0}
          error={errors.value?.message}
          {...register('value')}
        />
        <Input label="Minimum subtotal (₹)" type="number" step="0.01" min={0} placeholder="0.00" {...register('minSubtotal')} />
        <Input label="Max redemptions" type="number" min={1} placeholder="Unlimited" {...register('maxRedemptions')} />
        <Input label="Per-user limit" type="number" min={1} placeholder="Unlimited" {...register('perUserLimit')} />
        <Input label="Starts at" type="datetime-local" {...register('startsAt')} />
        <Input label="Expires at" type="datetime-local" {...register('expiresAt')} />
      </div>
      <Input label="Description" placeholder="20% off summer collection" {...register('description')} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" {...register('active')} />
        Active
      </label>
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? 'Save changes' : 'Create coupon'}
        </Button>
      </div>
    </form>
  );
}
