'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

/**
 * Builds a new URLSearchParams from the current ones, applying patches.
 * Empty / null values delete the key. Always resets to page 1 unless `page`
 * itself is being patched.
 */
function patchedQuery(current: URLSearchParams, patch: Record<string, string | number | null>): string {
  const sp = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') sp.delete(key);
    else sp.set(key, String(value));
  }
  if (!('page' in patch)) sp.delete('page');
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get('sort') ?? 'newest';

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      router.push(`${pathname}${patchedQuery(searchParams, { sort: e.target.value })}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <Select
      aria-label="Sort products"
      value={current}
      onChange={onChange}
      className="w-full sm:w-52"
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function ListingPagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onPageChange = useCallback(
    (next: number) => {
      router.push(`${pathname}${patchedQuery(searchParams, { page: next })}`, { scroll: false });
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [router, pathname, searchParams],
  );

  return <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />;
}
