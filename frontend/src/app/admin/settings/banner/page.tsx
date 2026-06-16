'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone } from 'lucide-react';
import type { Banner, BannerVariant } from '@/types';
import { useApi } from '@/lib/use-api';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';

const MESSAGE_MAX = 240;

const VARIANT_OPTIONS: { value: BannerVariant; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'sale', label: 'Sale' },
];

/** Background/text classes for each variant — kept in sync with the storefront banner. */
const VARIANT_STYLES: Record<BannerVariant, string> = {
  info: 'bg-brand-600 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-slate-900',
  sale: 'bg-rose-600 text-white',
};

interface FormState {
  enabled: boolean;
  message: string;
  linkUrl: string;
  linkLabel: string;
  variant: BannerVariant;
  dismissible: boolean;
}

const EMPTY_FORM: FormState = {
  enabled: false,
  message: '',
  linkUrl: '',
  linkLabel: '',
  variant: 'info',
  dismissible: true,
};

export default function AdminBannerPage() {
  const { data, error, isLoading, mutate } = useApi<Banner>('/settings/banner');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Prefill the form once the current config loads.
  useEffect(() => {
    if (!data) return;
    setForm({
      enabled: data.enabled,
      message: data.message ?? '',
      linkUrl: data.linkUrl ?? '',
      linkLabel: data.linkLabel ?? '',
      variant: data.variant,
      dismissible: data.dismissible,
    });
  }, [data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const trimmedMessage = form.message.trim();
  const messageError =
    trimmedMessage.length === 0
      ? 'Message is required'
      : form.message.length > MESSAGE_MAX
        ? `Message must be ${MESSAGE_MAX} characters or fewer`
        : undefined;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (messageError) {
      toast.error(messageError);
      return;
    }
    setSaving(true);
    try {
      const res = await api.put<Banner>('/admin/settings/banner', {
        enabled: form.enabled,
        message: trimmedMessage,
        linkUrl: form.linkUrl.trim() || undefined,
        linkLabel: form.linkLabel.trim() || undefined,
        variant: form.variant,
        dismissible: form.dismissible,
      });
      await mutate(res.data, { revalidate: false });
      toast.success('Banner saved');
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not save banner');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <CenteredSpinner label="Loading banner settings…" />;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Announcement banner" description="Control the site-wide announcement banner." />
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="Couldn’t load the banner"
          description={error instanceof ApiRequestError ? error.message : 'Something went wrong. Please try again.'}
          action={<Button onClick={() => mutate()}>Retry</Button>}
        />
      </div>
    );
  }

  const previewLabel = form.linkLabel.trim() || 'Learn more';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcement banner"
        description="Control the site-wide announcement banner shown across the storefront."
      />

      {/* Live preview */}
      <div>
        <p className="label-base">Preview</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {trimmedMessage ? (
            <div className={cn('flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium', VARIANT_STYLES[form.variant])}>
              <span>{trimmedMessage}</span>
              {form.linkUrl.trim() && (
                <span className="font-semibold underline underline-offset-2">{previewLabel}</span>
              )}
              {form.dismissible && (
                <span className="ml-1 text-xs opacity-70" aria-hidden>
                  ✕
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center bg-slate-50 px-4 py-2.5 text-sm text-slate-400">
              Add a message to preview the banner
            </div>
          )}
        </div>
        {!form.enabled && (
          <p className="mt-1 text-xs text-slate-500">Banner is currently disabled and will not appear on the storefront.</p>
        )}
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
            checked={form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          Enabled
        </label>

        <div>
          <Textarea
            label="Message"
            placeholder="Free shipping on orders over ₹999!"
            maxLength={MESSAGE_MAX}
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
            error={form.message.length > MESSAGE_MAX ? messageError : undefined}
          />
          <p className={cn('mt-1 text-xs', form.message.length > MESSAGE_MAX ? 'text-rose-600' : 'text-slate-400')}>
            {form.message.length}/{MESSAGE_MAX}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Link URL (optional)"
            placeholder="/sale"
            value={form.linkUrl}
            onChange={(e) => set('linkUrl', e.target.value)}
          />
          <Input
            label="Link label (optional)"
            placeholder="Shop the sale"
            value={form.linkLabel}
            onChange={(e) => set('linkLabel', e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Variant"
            value={form.variant}
            onChange={(e) => set('variant', e.target.value as BannerVariant)}
          >
            {VARIANT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <label className="mt-7 flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.dismissible}
              onChange={(e) => set('dismissible', e.target.checked)}
            />
            Dismissible
          </label>
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" loading={saving} disabled={!!messageError}>
            Save banner
          </Button>
        </div>
      </form>
    </div>
  );
}
