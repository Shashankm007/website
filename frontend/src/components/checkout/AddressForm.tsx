'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input, Select } from '@/components/ui/Input';

/** Indian States & Union Territories for the shipping address state field. */
const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman & Nicobar Islands',
  'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi',
  'Jammu & Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

/** Inline shipping address values (mirrors backend InlineAddressDto). */
export const addressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(120),
  line1: z.string().min(1, 'Address is required').max(200),
  line2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(120),
  state: z.string().min(1, 'State is required').max(120),
  postalCode: z
    .string()
    .min(1, 'PIN code is required')
    .regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
  country: z
    .string()
    .min(2, 'Use a 2-letter country code')
    .max(2, 'Use a 2-letter country code')
    .transform((v) => v.toUpperCase())
    .default('IN'),
  phone: z
    .string()
    .regex(/^(\+?91[-\s]?)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number')
    .optional()
    .or(z.literal('')),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

/** Map an India-Post state name to one of our select options (tolerant of &/and + spacing). */
function matchState(apiState?: string): string | undefined {
  if (!apiState) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
  const target = norm(apiState);
  return INDIAN_STATES.find((s) => norm(s) === target);
}

/**
 * Controlled-by-id new shipping address form. Exposes its valid values via
 * `onValid` whenever the form is dirty + valid so the parent can submit later.
 * The `formId` lets a parent button trigger submit via the native form.
 */
export function AddressForm({
  formId,
  onSubmit,
  defaultValues,
}: {
  formId: string;
  onSubmit: (values: AddressFormValues) => void;
  defaultValues?: Partial<AddressFormValues>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { country: 'IN', ...defaultValues },
  });

  // Auto-fill city + state from the PIN code via India Post's free public API.
  const postalCode = watch('postalCode');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'error' | 'ok'>('idle');
  // Seed with any prefilled PIN so we don't clobber an address being edited on mount.
  const lastLookup = useRef<string>(defaultValues?.postalCode ?? '');

  useEffect(() => {
    const pin = (postalCode ?? '').trim();
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setPinStatus('idle');
      return;
    }
    if (lastLookup.current === pin) return; // already resolved this PIN
    lastLookup.current = pin;

    let cancelled = false;
    setPinStatus('loading');
    (async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const json = (await res.json()) as Array<{
          Status?: string;
          PostOffice?: Array<{ District?: string; State?: string }> | null;
        }>;
        const po = json?.[0]?.Status === 'Success' ? json[0].PostOffice?.[0] : null;
        if (cancelled) return;
        if (!po) {
          setPinStatus('error');
          return;
        }
        if (po.District) setValue('city', po.District, { shouldValidate: true, shouldDirty: true });
        const matched = matchState(po.State);
        if (matched) setValue('state', matched, { shouldValidate: true, shouldDirty: true });
        setPinStatus('ok');
      } catch {
        if (!cancelled) setPinStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postalCode, setValue]);

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Input label="Full name" placeholder="Jane Maker" error={errors.fullName?.message} {...register('fullName')} />
      </div>
      <div className="sm:col-span-2">
        <Input label="Address line 1" placeholder="12, MG Road" error={errors.line1?.message} {...register('line1')} />
      </div>
      <div className="sm:col-span-2">
        <Input label="Address line 2 (optional)" placeholder="Apt 4B" error={errors.line2?.message} {...register('line2')} />
      </div>
      <Input label="City" placeholder="Mumbai" error={errors.city?.message} {...register('city')} />
      <div className="w-full">
        <Select label="State" {...register('state')}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {errors.state?.message && <p className="mt-1 text-xs text-rose-600">{errors.state.message}</p>}
      </div>
      <div className="w-full">
        <Input
          label="PIN code"
          placeholder="560001"
          inputMode="numeric"
          maxLength={6}
          error={errors.postalCode?.message}
          {...register('postalCode')}
        />
        {pinStatus === 'loading' && <p className="mt-1 text-xs text-slate-400">Looking up city & state…</p>}
        {pinStatus === 'ok' && <p className="mt-1 text-xs text-emerald-600">Valid PIN code.</p>}
        {pinStatus === 'error' && (
          <p className="mt-1 text-xs text-amber-600">Couldn’t find that PIN — enter city/state manually.</p>
        )}
      </div>
      <div className="w-full">
        <Select label="Country" {...register('country')}>
          <option value="IN">India</option>
        </Select>
        {errors.country?.message && <p className="mt-1 text-xs text-rose-600">{errors.country.message}</p>}
      </div>
      <div className="sm:col-span-2">
        <Input label="Phone" placeholder="+91 98765 43210" error={errors.phone?.message} {...register('phone')} />
      </div>
    </form>
  );
}
