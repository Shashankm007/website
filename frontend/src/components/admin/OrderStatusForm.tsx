'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { OrderStatus } from '@/types';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const schema = z.object({
  status: z.enum(['PENDING', 'PAID', 'PRINTING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  trackingNumber: z.string().max(120, 'Too long').optional(),
  carrier: z.string().max(120, 'Too long').optional(),
  note: z.string().max(500, 'Keep the note under 500 characters').optional(),
});

type FormValues = z.infer<typeof schema>;

interface OrderStatusFormProps {
  orderId: string;
  currentStatus: OrderStatus;
  currentTracking?: string | null;
  currentCarrier?: string | null;
  /** Called after a successful update so the parent can revalidate (e.g. SWR mutate). */
  onUpdated: () => void;
}

/**
 * Fulfilment panel: change an order's status and capture tracking / carrier / a
 * note. Patches /admin/orders/:id/status and asks the parent to revalidate.
 */
export function OrderStatusForm({
  orderId,
  currentStatus,
  currentTracking,
  currentCarrier,
  onUpdated,
}: OrderStatusFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: currentStatus,
      trackingNumber: currentTracking ?? '',
      carrier: currentCarrier ?? '',
      note: '',
    },
  });

  // Keep the form in sync when the underlying order changes (e.g. after mutate).
  useEffect(() => {
    reset({
      status: currentStatus,
      trackingNumber: currentTracking ?? '',
      carrier: currentCarrier ?? '',
      note: '',
    });
  }, [currentStatus, currentTracking, currentCarrier, reset]);

  const selectedStatus = watch('status');
  const showShipping = selectedStatus === 'SHIPPED' || selectedStatus === 'DELIVERED';

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, {
        status: values.status,
        trackingNumber: values.trackingNumber?.trim() || undefined,
        carrier: values.carrier?.trim() || undefined,
        note: values.note?.trim() || undefined,
      });
      toast.success(`Order marked ${values.status.toLowerCase()}`);
      onUpdated();
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : 'Could not update the order';
      toast.error(message);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Select label="Status" {...register('status')}>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </Select>

      {showShipping && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Tracking number"
            placeholder="1Z999AA10123456784"
            error={errors.trackingNumber?.message}
            {...register('trackingNumber')}
          />
          <Input label="Carrier" placeholder="UPS" error={errors.carrier?.message} {...register('carrier')} />
        </div>
      )}

      <Textarea
        label="Note (optional)"
        placeholder="Internal note added to the order timeline."
        error={errors.note?.message}
        {...register('note')}
      />

      <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
        Update status
      </Button>
    </form>
  );
}
