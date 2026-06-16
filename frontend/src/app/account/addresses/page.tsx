'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Check, MapPin, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import type { Address } from '@/types';
import { api } from '@/lib/client-api';
import { useApi } from '@/lib/use-api';
import { ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';

const addressSchema = z.object({
  type: z.enum(['SHIPPING', 'BILLING']),
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  line1: z.string().trim().min(1, 'Street address is required').max(160),
  line2: z.string().trim().max(160).optional().or(z.literal('')),
  city: z.string().trim().min(1, 'City is required').max(80),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z.string().trim().min(2, 'Country is required').max(60),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[\d+().\s-]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  isDefault: z.boolean().optional(),
});

type AddressForm = z.infer<typeof addressSchema>;

const EMPTY: AddressForm = {
  type: 'SHIPPING',
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'United States',
  phone: '',
  isDefault: false,
};

export default function AddressesPage() {
  const { data: addresses, isLoading, mutate } = useApi<Address[]>('/users/me/addresses');
  const [editing, setEditing] = useState<Address | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (address: Address) => {
    setEditing(address);
    setFormOpen(true);
  };

  const setDefault = async (id: string) => {
    setBusyId(id);
    try {
      await api.post(`/users/me/addresses/${id}/default`);
      await mutate();
      toast.success('Default address updated');
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not set default address');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this address?')) return;
    setBusyId(id);
    try {
      await api.del(`/users/me/addresses/${id}`);
      await mutate();
      toast.success('Address deleted');
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not delete address');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Addresses</h2>
          <p className="mt-1 text-sm text-slate-500">Manage your shipping and billing addresses.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add address
        </Button>
      </div>

      {isLoading ? (
        <CenteredSpinner label="Loading addresses…" />
      ) : !addresses || addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-10 w-10" />}
          title="No addresses yet"
          description="Add an address to speed up checkout."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add address
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="card flex flex-col p-5">
              <div className="mb-3 flex items-center gap-2">
                <Badge className="bg-slate-100 text-slate-700">
                  {address.type === 'BILLING' ? 'Billing' : 'Shipping'}
                </Badge>
                {address.isDefault && (
                  <Badge className="bg-brand-50 text-brand-700">
                    <Star className="mr-1 h-3 w-3 fill-brand-500 text-brand-500" /> Default
                  </Badge>
                )}
              </div>

              <address className="not-italic text-sm leading-relaxed text-slate-700">
                <span className="block font-medium text-slate-900">{address.fullName}</span>
                <span className="block">{address.line1}</span>
                {address.line2 && <span className="block">{address.line2}</span>}
                <span className="block">
                  {address.city}
                  {address.state ? `, ${address.state}` : ''} {address.postalCode}
                </span>
                <span className="block">{address.country}</span>
                {address.phone && <span className="block text-slate-500">{address.phone}</span>}
              </address>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                {!address.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefault(address.id)}
                    loading={busyId === address.id}
                  >
                    <Check className="h-4 w-4" /> Set default
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => openEdit(address)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => remove(address.id)}
                  loading={busyId === address.id}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <AddressFormDialog
          address={editing}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await mutate();
          }}
        />
      )}
    </div>
  );
}

function AddressFormDialog({
  address,
  onClose,
  onSaved,
}: {
  address: Address | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = Boolean(address);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? {
          type: address.type,
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2 ?? '',
          city: address.city,
          state: address.state ?? '',
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone ?? '',
          isDefault: address.isDefault,
        }
      : EMPTY,
  });

  // Lock background scroll while the dialog is open.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      type: values.type,
      fullName: values.fullName.trim(),
      line1: values.line1.trim(),
      line2: values.line2?.trim() ? values.line2.trim() : null,
      city: values.city.trim(),
      state: values.state?.trim() ? values.state.trim() : null,
      postalCode: values.postalCode.trim(),
      country: values.country.trim(),
      phone: values.phone?.trim() ? values.phone.trim() : null,
      isDefault: Boolean(values.isDefault),
    };
    try {
      if (isEdit && address) {
        await api.patch(`/users/me/addresses/${address.id}`, payload);
        toast.success('Address updated');
      } else {
        await api.post('/users/me/addresses', payload);
        toast.success('Address added');
      }
      await onSaved();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not save address');
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit address' : 'Add address'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card max-h-[92vh] w-full overflow-y-auto rounded-b-none rounded-t-2xl p-6 sm:max-w-lg sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Edit address' : 'Add address'}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Select label="Address type" {...register('type')}>
            <option value="SHIPPING">Shipping</option>
            <option value="BILLING">Billing</option>
          </Select>

          <Input label="Full name" error={errors.fullName?.message} {...register('fullName')} />
          <Input label="Street address" error={errors.line1?.message} {...register('line1')} />
          <Input label="Apartment, suite, etc. (optional)" error={errors.line2?.message} {...register('line2')} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" error={errors.city?.message} {...register('city')} />
            <Input label="State / Province" error={errors.state?.message} {...register('state')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Postal code" error={errors.postalCode?.message} {...register('postalCode')} />
            <Input label="Country" error={errors.country?.message} {...register('country')} />
          </div>

          <Input label="Phone (optional)" type="tel" error={errors.phone?.message} {...register('phone')} />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
              {...register('isDefault')}
            />
            Set as default address
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEdit ? 'Save changes' : 'Add address'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
