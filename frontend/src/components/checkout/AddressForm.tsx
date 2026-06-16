'use client';

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
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { country: 'IN', ...defaultValues },
  });

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
      <Input
        label="PIN code"
        placeholder="560001"
        inputMode="numeric"
        maxLength={6}
        error={errors.postalCode?.message}
        {...register('postalCode')}
      />
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
