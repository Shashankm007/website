'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';
import type { ShippingSettings } from '@/types';
import { useApi } from '@/lib/use-api';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';

interface FormState {
  flatRupees: string;
  freeShippingEnabled: boolean;
  freeThresholdRupees: string;
}

const toRupees = (cents: number) => (cents / 100).toFixed(2);
const toCents = (rupees: string) => Math.max(0, Math.round((Number(rupees) || 0) * 100));

export default function AdminShippingPage() {
  const { data, error, isLoading, mutate } = useApi<ShippingSettings>('/settings/shipping');
  const [form, setForm] = useState<FormState>({ flatRupees: '', freeShippingEnabled: true, freeThresholdRupees: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      flatRupees: toRupees(data.flatCents),
      freeShippingEnabled: data.freeShippingEnabled,
      freeThresholdRupees: toRupees(data.freeThresholdCents),
    });
  }, [data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const flatCents = toCents(form.flatRupees);
  const freeThresholdCents = toCents(form.freeThresholdRupees);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put<ShippingSettings>('/admin/settings/shipping', {
        flatCents,
        freeShippingEnabled: form.freeShippingEnabled,
        freeThresholdCents,
      });
      await mutate(res.data, { revalidate: false });
      toast.success('Shipping settings saved');
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not save shipping settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <CenteredSpinner label="Loading shipping settings…" />;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Shipping" description="Configure the shipping fee and free-shipping threshold." />
        <EmptyState
          icon={<Truck className="h-10 w-10" />}
          title="Couldn’t load shipping settings"
          description={error instanceof ApiRequestError ? error.message : 'Something went wrong. Please try again.'}
          action={<Button onClick={() => mutate()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipping"
        description="Set the flat shipping fee and an optional free-shipping threshold. Applied to every new order."
      />

      <form onSubmit={onSubmit} className="card max-w-xl space-y-5 p-6">
        <Input
          label="Flat shipping fee (₹)"
          type="number"
          step="0.01"
          min={0}
          placeholder="79.00"
          value={form.flatRupees}
          onChange={(e) => set('flatRupees', e.target.value)}
        />
        <p className="-mt-3 text-xs text-slate-400">Set to 0 for always-free shipping.</p>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
            checked={form.freeShippingEnabled}
            onChange={(e) => set('freeShippingEnabled', e.target.checked)}
          />
          Offer free shipping above a threshold
        </label>

        <Input
          label="Free-shipping threshold (₹)"
          type="number"
          step="0.01"
          min={0}
          placeholder="999.00"
          value={form.freeThresholdRupees}
          disabled={!form.freeShippingEnabled}
          onChange={(e) => set('freeThresholdRupees', e.target.value)}
        />

        {/* Live summary of the resulting rule */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
          {flatCents === 0 ? (
            <>Shipping is <strong>free on every order</strong>.</>
          ) : form.freeShippingEnabled ? (
            <>
              Orders are charged <strong>{formatMoney(flatCents)}</strong> shipping, and ship{' '}
              <strong>free over {formatMoney(freeThresholdCents)}</strong> (after discount).
            </>
          ) : (
            <>Every order is charged a flat <strong>{formatMoney(flatCents)}</strong> shipping fee.</>
          )}
        </div>

        <div className="flex items-center justify-end pt-1">
          <Button type="submit" loading={saving}>
            Save shipping
          </Button>
        </div>
      </form>
    </div>
  );
}
