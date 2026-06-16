'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import type { Category } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Availability = 'all' | 'in_stock' | 'made_to_order';

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'all', label: 'All products' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'made_to_order', label: 'Made to order' },
];

interface FilterState {
  categorySlug: string;
  minPrice: string;
  maxPrice: string;
  availability: Availability;
  tags: string;
}

/** Flatten a (possibly nested) category tree into a single ordered list with depth. */
function flattenCategories(categories: Category[], depth = 0): { category: Category; depth: number }[] {
  const out: { category: Category; depth: number }[] = [];
  for (const category of categories) {
    out.push({ category, depth });
    if (category.children?.length) out.push(...flattenCategories(category.children, depth + 1));
  }
  return out;
}

function stateFromParams(sp: URLSearchParams): FilterState {
  const availability = sp.get('availability');
  return {
    categorySlug: sp.get('categorySlug') ?? '',
    minPrice: sp.get('minPrice') ?? '',
    maxPrice: sp.get('maxPrice') ?? '',
    availability:
      availability === 'in_stock' || availability === 'made_to_order' ? (availability as Availability) : 'all',
    tags: sp.get('tags') ?? '',
  };
}

function FiltersForm({
  categories,
  onApply,
}: {
  categories: Category[];
  onApply: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flat = useMemo(() => flattenCategories(categories), [categories]);

  const [state, setState] = useState<FilterState>(() => stateFromParams(searchParams));

  // Keep local form in sync if the URL changes underneath us (e.g. back/forward).
  useEffect(() => {
    setState(stateFromParams(searchParams));
  }, [searchParams]);

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const apply = () => {
    const sp = new URLSearchParams(searchParams.toString());
    // Preserve params we don't own (search, sort) and reset to the first page.
    const next: Record<string, string> = {
      categorySlug: state.categorySlug.trim(),
      minPrice: state.minPrice.trim(),
      maxPrice: state.maxPrice.trim(),
      availability: state.availability === 'all' ? '' : state.availability,
      tags: state.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .join(','),
    };
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    // A category-driven listing uses categorySlug; drop a stale categoryId.
    sp.delete('categoryId');
    sp.delete('page');
    const query = sp.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    onApply();
  };

  const clearAll = () => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const key of ['categorySlug', 'categoryId', 'minPrice', 'maxPrice', 'availability', 'tags', 'page']) {
      sp.delete(key);
    }
    const query = sp.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    onApply();
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      {/* Categories */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Category</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="categorySlug"
            checked={state.categorySlug === ''}
            onChange={() => set('categorySlug', '')}
            className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-300"
          />
          All categories
        </label>
        {flat.map(({ category, depth }) => (
          <label
            key={category.id}
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
            style={{ paddingLeft: `${depth * 14}px` }}
          >
            <input
              type="radio"
              name="categorySlug"
              checked={state.categorySlug === category.slug}
              onChange={() => set('categorySlug', category.slug)}
              className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-300"
            />
            <span className="line-clamp-1">{category.name}</span>
          </label>
        ))}
      </fieldset>

      {/* Price */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Price (₹)</legend>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Min"
            aria-label="Minimum price"
            value={state.minPrice}
            onChange={(e) => set('minPrice', e.target.value)}
          />
          <span className="text-slate-400">–</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Max"
            aria-label="Maximum price"
            value={state.maxPrice}
            onChange={(e) => set('maxPrice', e.target.value)}
          />
        </div>
      </fieldset>

      {/* Availability */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Availability</legend>
        {AVAILABILITY_OPTIONS.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="availability"
              checked={state.availability === o.value}
              onChange={() => set('availability', o.value)}
              className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-300"
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      {/* Tags */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Tags</legend>
        <Input
          type="text"
          placeholder="e.g. minimalist, gift"
          aria-label="Tags (comma separated)"
          value={state.tags}
          onChange={(e) => set('tags', e.target.value)}
        />
        <p className="text-xs text-slate-400">Separate multiple tags with commas.</p>
      </fieldset>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">
          Apply
        </Button>
        <Button type="button" variant="outline" onClick={clearAll}>
          Clear all
        </Button>
      </div>
    </form>
  );
}

export function ProductFilters({ categories }: { categories: Category[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchParams = useSearchParams();

  const activeCount = useMemo(() => {
    let count = 0;
    for (const key of ['categorySlug', 'categoryId', 'minPrice', 'maxPrice', 'tags']) {
      if (searchParams.get(key)) count++;
    }
    const availability = searchParams.get('availability');
    if (availability && availability !== 'all') count++;
    return count;
  }, [searchParams]);

  // Prevent body scroll while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden">
        <Button variant="outline" className="w-full" onClick={() => setDrawerOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {/* Desktop sidebar */}
      <aside className="card hidden h-fit p-5 lg:block">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Filters</h2>
        <FiltersForm categories={categories} onApply={() => {}} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-slate-900/40 transition-opacity',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product filters"
          className={cn(
            'absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-white shadow-xl transition-transform',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Filters</h2>
            <Button variant="ghost" size="icon" aria-label="Close filters" onClick={() => setDrawerOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <FiltersForm categories={categories} onApply={() => setDrawerOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}
