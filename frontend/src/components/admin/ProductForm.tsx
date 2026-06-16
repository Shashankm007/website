'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { Category, CustomizationType, FulfillmentType, ProductStatus } from '@/types';
import { api } from '@/lib/client-api';
import { useApi } from '@/lib/use-api';
import { ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { MediaUploader, type MediaEntry } from './MediaUploader';

/** Detail shape returned by GET /admin/products/:id, used to prefill the edit form. */
export interface ProductDetailLike {
  id: string;
  name: string;
  description: string;
  shortDescription?: string | null;
  sku: string;
  priceCents: number;
  compareAtCents?: number | null;
  customizationType?: CustomizationType;
  status: ProductStatus;
  fulfillment: FulfillmentType;
  featured?: boolean;
  weightGrams?: number | null;
  categories?: ({ id: string } | { category: { id: string } })[];
  tags?: (string | { name?: string; tag?: { name: string } })[];
  media?: { type: string; url: string; objectKey?: string | null }[];
  options?: { name: string; values: { value: string; priceDeltaCents?: number; hex?: string | null }[] }[];
  inventory?: { quantity?: number; lowStockThreshold?: number } | null;
}

const optionValueSchema = z.object({
  value: z.string().trim().min(1, 'Required'),
  priceDelta: z.string().optional(),
  hex: z.string().optional(),
});
const optionSchema = z.object({
  name: z.string().trim().min(1, 'Option name required'),
  values: z.array(optionValueSchema).min(1, 'Add at least one value'),
});

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(255),
    description: z.string().trim().min(1, 'Description is required'),
    shortDescription: z.string().max(512).optional(),
    sku: z.string().trim().min(1, 'SKU is required').max(120),
    price: z.coerce.number({ invalid_type_error: 'Enter a price' }).min(0, 'Must be ≥ 0'),
    compareAt: z.string().optional(),
    customizationType: z.enum(['NONE', 'STL_UPLOAD', 'PHOTO_UPLOAD']),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    fulfillment: z.enum(['STOCKED', 'MADE_TO_ORDER']),
    featured: z.boolean(),
    weightGrams: z.string().optional(),
    categoryIds: z.array(z.string()),
    tags: z.string().optional(),
    initialStock: z.string().optional(),
    lowStockThreshold: z.string().optional(),
    options: z.array(optionSchema),
  })
  .superRefine((val, ctx) => {
    if (val.compareAt && val.compareAt.trim() !== '') {
      const n = Number(val.compareAt);
      if (Number.isNaN(n) || n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid amount', path: ['compareAt'] });
      } else if (n * 100 <= val.price * 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Should exceed the price', path: ['compareAt'] });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

const dollarsToCents = (v: string | undefined): number | undefined => {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : Math.round(n * 100);
};
const intOrUndefined = (v: string | undefined): number | undefined => {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : Math.round(n);
};
const centsToDollars = (cents?: number | null): string => (cents != null ? (cents / 100).toFixed(2) : '');

function buildDefaults(product?: ProductDetailLike, prefillMedia: MediaEntry[] = []): FormValues {
  const categoryIds = (product?.categories ?? []).map((c) =>
    'category' in c ? c.category.id : (c as { id: string }).id,
  );
  const tags = (product?.tags ?? [])
    .map((t) => (typeof t === 'string' ? t : t.tag?.name ?? t.name ?? ''))
    .filter(Boolean)
    .join(', ');
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    shortDescription: product?.shortDescription ?? '',
    sku: product?.sku ?? '',
    price: product ? product.priceCents / 100 : 0,
    compareAt: centsToDollars(product?.compareAtCents),
    customizationType: product?.customizationType ?? 'NONE',
    status: product?.status ?? 'DRAFT',
    fulfillment: product?.fulfillment ?? 'STOCKED',
    featured: product?.featured ?? false,
    weightGrams: product?.weightGrams != null ? String(product.weightGrams) : '',
    categoryIds,
    tags,
    initialStock: product?.inventory?.quantity != null ? String(product.inventory.quantity) : '',
    lowStockThreshold: product?.inventory?.lowStockThreshold != null ? String(product.inventory.lowStockThreshold) : '',
    options: (product?.options ?? []).map((o) => ({
      name: o.name,
      values: o.values.map((v) => ({
        value: v.value,
        priceDelta: centsToDollars(v.priceDeltaCents),
        hex: v.hex ?? '',
      })),
    })),
  };
}

interface ProductFormProps {
  /** When provided, the form is in edit mode and prefilled from this product. */
  product?: ProductDetailLike;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const isEdit = !!product;
  const { data: categories } = useApi<Category[]>('/categories');

  const initialMedia: MediaEntry[] = useMemo(
    () =>
      (product?.media ?? [])
        .filter((m) => m.type === 'IMAGE' || m.type === 'VIDEO')
        .map((m) => ({ type: m.type as 'IMAGE' | 'VIDEO', url: m.url, objectKey: m.objectKey ?? undefined })),
    [product],
  );
  const [media, setMedia] = useState<MediaEntry[]>(initialMedia);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(product, initialMedia),
  });

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({ control, name: 'options' });
  const fulfillment = watch('fulfillment');

  // Live discount derived from MRP (compare-at) vs. selling price.
  const priceVal = watch('price');
  const compareAtVal = watch('compareAt');
  const sellingPrice = Number(priceVal);
  const mrpPrice = Number(compareAtVal);
  const discountPct =
    Number.isFinite(mrpPrice) &&
    Number.isFinite(sellingPrice) &&
    mrpPrice > 0 &&
    mrpPrice > sellingPrice
      ? Math.round(((mrpPrice - sellingPrice) / mrpPrice) * 100)
      : null;

  // Helper: setting a discount % derives the selling price from the MRP.
  const applyDiscountPct = (raw: string) => {
    const pct = Number(raw);
    if (!Number.isFinite(mrpPrice) || mrpPrice <= 0 || !Number.isFinite(pct) || pct < 0 || pct > 100) return;
    const next = Math.round(mrpPrice * (1 - pct / 100) * 100) / 100;
    setValue('price', next, { shouldValidate: true, shouldDirty: true });
  };

  // Flatten the category tree for the multi-select.
  const flatCategories = useMemo(() => flatten(categories ?? []), [categories]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      shortDescription: values.shortDescription?.trim() || undefined,
      sku: values.sku.trim(),
      priceCents: Math.round(values.price * 100),
      compareAtCents: dollarsToCents(values.compareAt),
      customizationType: values.customizationType,
      status: values.status,
      fulfillment: values.fulfillment,
      featured: values.featured,
      weightGrams: intOrUndefined(values.weightGrams),
      categoryIds: values.categoryIds,
      tags: (values.tags ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      media: media.map((m, i) => ({ type: m.type, url: m.url, objectKey: m.objectKey, position: i })),
      options: values.options.map((o) => ({
        name: o.name.trim(),
        values: o.values.map((v) => ({
          value: v.value.trim(),
          priceDeltaCents: dollarsToCents(v.priceDelta) ?? 0,
          hex: v.hex?.trim() || undefined,
        })),
      })),
      ...(values.fulfillment === 'STOCKED'
        ? {
            initialStock: intOrUndefined(values.initialStock),
            lowStockThreshold: intOrUndefined(values.lowStockThreshold),
          }
        : {}),
    };

    try {
      if (isEdit) {
        await api.patch(`/admin/products/${product!.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/admin/products', payload);
        toast.success('Product created');
      }
      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Could not save product';
      toast.error(message);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Basics */}
      <section className="card space-y-4 p-6">
        <h2 className="text-base font-semibold text-slate-900">Basics</h2>
        <Input label="Name" placeholder="Articulated Dragon" error={errors.name?.message} {...register('name')} />
        <Input
          label="Short description"
          placeholder="One-line summary shown in listings"
          error={errors.shortDescription?.message}
          {...register('shortDescription')}
        />
        <Textarea
          label="Description"
          rows={6}
          placeholder="Full product description (markdown allowed)"
          error={errors.description?.message}
          {...register('description')}
        />
      </section>

      {/* Pricing & catalog */}
      <section className="card space-y-4 p-6">
        <h2 className="text-base font-semibold text-slate-900">Pricing & catalog</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="SKU" placeholder="F3D-DRG-001" error={errors.sku?.message} {...register('sku')} />
          <Input
            label="Weight (grams)"
            type="number"
            min={0}
            placeholder="120"
            error={errors.weightGrams?.message}
            {...register('weightGrams')}
          />
          <Input
            label="MRP / original price (₹)"
            type="number"
            step="0.01"
            min={0}
            placeholder="34.99"
            error={errors.compareAt?.message}
            {...register('compareAt')}
          />
          <Input
            label="Price (₹)"
            type="number"
            step="0.01"
            min={0}
            placeholder="24.99"
            error={errors.price?.message}
            {...register('price')}
          />
          <Select label="Status" {...register('status')}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Select label="Fulfillment" {...register('fulfillment')}>
            <option value="STOCKED">Stocked</option>
            <option value="MADE_TO_ORDER">Made to order</option>
          </Select>
          <Select label="Customization" {...register('customizationType')}>
            <option value="NONE">None</option>
            <option value="STL_UPLOAD">Customer uploads STL</option>
            <option value="PHOTO_UPLOAD">Customer uploads photo / lithophane</option>
          </Select>
        </div>

        {/* Discount helpers */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <span className="label-base">Discount % (helper)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="1"
              placeholder="e.g. 20"
              className="input-base"
              onChange={(e) => applyDiscountPct(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Sets price from MRP.</p>
          </div>
          {discountPct != null && (
            <span className="mb-6 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {discountPct}% OFF
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" {...register('featured')} />
          Featured product
        </label>
      </section>

      {/* Stock (STOCKED only) */}
      {fulfillment === 'STOCKED' && (
        <section className="card space-y-4 p-6">
          <h2 className="text-base font-semibold text-slate-900">Inventory</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={isEdit ? 'Stock quantity' : 'Initial stock'}
              type="number"
              min={0}
              placeholder="50"
              {...register('initialStock')}
            />
            <Input
              label="Low-stock threshold"
              type="number"
              min={0}
              placeholder="5"
              {...register('lowStockThreshold')}
            />
          </div>
        </section>
      )}

      {/* Categories & tags */}
      <section className="card space-y-4 p-6">
        <h2 className="text-base font-semibold text-slate-900">Categories & tags</h2>
        <Controller
          control={control}
          name="categoryIds"
          render={({ field }) => (
            <div>
              <span className="label-base">Categories</span>
              {flatCategories.length === 0 ? (
                <p className="text-sm text-slate-400">No categories yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {flatCategories.map((c) => {
                    const checked = field.value.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand-600"
                          checked={checked}
                          onChange={(e) =>
                            field.onChange(
                              e.target.checked ? [...field.value, c.id] : field.value.filter((id) => id !== c.id),
                            )
                          }
                        />
                        <span style={{ paddingLeft: c.depth * 12 }}>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        />
        <Input label="Tags (comma-separated)" placeholder="dragon, articulated, fidget" {...register('tags')} />
      </section>

      {/* Media */}
      <section className="card space-y-4 p-6">
        <h2 className="text-base font-semibold text-slate-900">Media</h2>
        <MediaUploader value={media} onChange={setMedia} />
      </section>

      {/* Options builder */}
      <section className="card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Options</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => appendOption({ name: '', values: [{ value: '', priceDelta: '', hex: '' }] })}>
            <Plus className="h-4 w-4" />
            Add option
          </Button>
        </div>
        {optionFields.length === 0 ? (
          <p className="text-sm text-slate-400">No options. Add one for materials, colors, or sizes.</p>
        ) : (
          <div className="space-y-4">
            {optionFields.map((opt, oi) => (
              <OptionEditor
                key={opt.id}
                control={control}
                register={register}
                index={oi}
                onRemove={() => removeOption(oi)}
                errors={errors}
              />
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/products')}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}

/* ---- option sub-editor --------------------------------------------------- */

function OptionEditor({
  control,
  register,
  index,
  onRemove,
  errors,
}: {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  index: number;
  onRemove: () => void;
  errors: FieldErrors<FormValues>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `options.${index}.values` });
  const optionErr = errors.options?.[index];

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-end gap-3">
        <Input
          label="Option name"
          placeholder="Material"
          error={optionErr?.name?.message}
          {...register(`options.${index}.name`)}
        />
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove option">
          <Trash2 className="h-4 w-4 text-rose-500" />
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {fields.map((val, vi) => (
          <div key={val.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr,140px,110px,auto]">
            <Input
              label={vi === 0 ? 'Value' : undefined}
              placeholder="PLA"
              error={optionErr?.values?.[vi]?.value?.message}
              {...register(`options.${index}.values.${vi}.value`)}
            />
            <Input
              label={vi === 0 ? 'Price delta (₹)' : undefined}
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register(`options.${index}.values.${vi}.priceDelta`)}
            />
            <Input
              label={vi === 0 ? 'Hex' : undefined}
              placeholder="#1f2937"
              {...register(`options.${index}.values.${vi}.hex`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => (fields.length > 1 ? remove(vi) : undefined)}
              disabled={fields.length <= 1}
              aria-label="Remove value"
            >
              <Trash2 className="h-4 w-4 text-slate-400" />
            </Button>
          </div>
        ))}
        {typeof optionErr?.values?.message === 'string' && (
          <p className="text-xs text-rose-600">{optionErr?.values?.message}</p>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ value: '', priceDelta: '', hex: '' })}>
          <Plus className="h-3.5 w-3.5" />
          Add value
        </Button>
      </div>
    </div>
  );
}

/* ---- helpers ------------------------------------------------------------- */

interface FlatCategory {
  id: string;
  name: string;
  depth: number;
}
function flatten(tree: Category[], depth = 0, acc: FlatCategory[] = []): FlatCategory[] {
  for (const c of tree) {
    acc.push({ id: c.id, name: c.name, depth });
    if (c.children?.length) flatten(c.children, depth + 1, acc);
  }
  return acc;
}
