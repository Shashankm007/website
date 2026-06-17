'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { Category } from '@/types';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ImageUploadField } from '@/components/admin/ImageUploadField';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().trim().optional(),
  parentId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface CategoryFormProps {
  /** Category being edited; omit to create a new one. */
  category?: Category;
  /** Flat list of categories that can be a parent (the edited node + its descendants are excluded). */
  parentOptions: { id: string; name: string; depth: number }[];
  onSaved: () => void;
  onCancel: () => void;
}

export function CategoryForm({ category, parentOptions, onSaved, onCancel }: CategoryFormProps) {
  const isEdit = !!category;
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      imageUrl: category?.imageUrl ?? '',
      parentId: category?.parentId ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      imageUrl: values.imageUrl?.trim() || undefined,
      parentId: values.parentId ? values.parentId : undefined,
    };
    try {
      if (isEdit) {
        await api.patch(`/admin/categories/${category!.id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/admin/categories', payload);
        toast.success('Category created');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not save category');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input label="Name" placeholder="Tabletop Miniatures" error={errors.name?.message} {...register('name')} />
      <Select label="Parent category" {...register('parentId')}>
        <option value="">— None (root) —</option>
        {parentOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {' '.repeat(c.depth * 2)}
            {c.name}
          </option>
        ))}
      </Select>
      <ImageUploadField
        label="Category tile image"
        value={watch('imageUrl')}
        onChange={(url) => setValue('imageUrl', url, { shouldDirty: true })}
      />
      <Textarea label="Description" rows={3} placeholder="Optional description" {...register('description')} />
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  );
}
