'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';

const schema = z.object({
  delta: z.coerce.number({ invalid_type_error: 'Enter a number' }).int('Whole units only').refine((n) => n !== 0, 'Cannot be zero'),
  reason: z.enum(['RESTOCK', 'ADJUSTMENT', 'RETURN']),
  note: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

interface AdjustStockModalProps {
  productId: string;
  productName: string;
  currentQuantity: number;
  onClose: () => void;
  onAdjusted: () => void;
}

export function AdjustStockModal({ productId, productName, currentQuantity, onClose, onAdjusted }: AdjustStockModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { delta: 0, reason: 'RESTOCK', note: '' },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const delta = Number(watch('delta')) || 0;
  const projected = currentQuantity + delta;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post(`/admin/inventory/${productId}/adjust`, {
        delta: values.delta,
        reason: values.reason,
        note: values.note?.trim() || undefined,
      });
      toast.success('Stock adjusted');
      onAdjusted();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not adjust stock');
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Adjust stock</h2>
            <p className="text-sm text-slate-500">{productName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Quantity change (delta)"
            type="number"
            placeholder="e.g. 25 or -3"
            error={errors.delta?.message}
            {...register('delta')}
          />
          <Select label="Reason" {...register('reason')}>
            <option value="RESTOCK">Restock</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="RETURN">Return</option>
          </Select>
          <Textarea label="Note (optional)" rows={2} placeholder="Received PO #4821" {...register('note')} />

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Current: <span className="font-medium text-slate-900">{currentQuantity}</span> → New:{' '}
            <span className={projected < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-slate-900'}>{projected}</span>
          </p>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Apply
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
