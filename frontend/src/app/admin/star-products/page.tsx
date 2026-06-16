'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ImageOff, Plus, Save, Search, Star, Trash2 } from 'lucide-react';
import type { ProductCard, ProductStatus } from '@/types';
import { useApi, useApiList } from '@/lib/use-api';
import { api } from '@/lib/client-api';
import { ApiRequestError, qs } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { CenteredSpinner } from '@/components/ui/Feedback';

interface StarItem {
  id: string;
  name: string;
  priceCents: number;
  imageUrl?: string | null;
  status: ProductStatus;
}

interface AdminProductRow {
  id: string;
  name: string;
  priceCents: number;
  status: ProductStatus;
  media?: { type: string; url: string }[];
}

const STATUS_BADGE: Record<ProductStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  ARCHIVED: 'bg-rose-100 text-rose-700',
};

function Thumb({ url, alt }: { url?: string | null; alt: string }) {
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
      {url ? (
        <Image src={url} alt={alt} fill sizes="48px" className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-300">
          <ImageOff className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

export default function StarProductsPage() {
  const { data, isLoading, mutate } = useApi<(ProductCard & { status: ProductStatus })[]>('/admin/products/star');

  const [stars, setStars] = useState<StarItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Load the saved list into editable local state.
  useEffect(() => {
    if (data) {
      setStars(data.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, imageUrl: p.imageUrl, status: p.status })));
    }
  }, [data]);

  const { data: searchData, isLoading: searching } = useApiList<AdminProductRow[]>(
    search ? `/admin/products${qs({ search, limit: 10 })}` : null,
  );

  const starIds = useMemo(() => new Set(stars.map((s) => s.id)), [stars]);
  const results = (searchData?.data ?? []).filter((p) => !starIds.has(p.id));

  const add = (p: AdminProductRow) => {
    const imageUrl = p.media?.find((m) => m.type === 'IMAGE')?.url ?? p.media?.[0]?.url ?? null;
    setStars((s) => [...s, { id: p.id, name: p.name, priceCents: p.priceCents, imageUrl, status: p.status }]);
  };
  const remove = (id: string) => setStars((s) => s.filter((p) => p.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stars.length) return;
    const next = [...stars];
    [next[i], next[j]] = [next[j], next[i]];
    setStars(next);
  };

  const dirty = useMemo(() => {
    const saved = (data ?? []).map((p) => p.id).join(',');
    return saved !== stars.map((s) => s.id).join(',');
  }, [data, stars]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/products/star', { productIds: stars.map((s) => s.id) });
      toast.success('Star products updated');
      await mutate();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Star products"
        description="Curate and order the products shown in the landing-page carousel."
        action={
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Current star list (ordered) */}
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
            <Star className="h-5 w-5 text-amber-500" /> On the landing page ({stars.length})
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Order = carousel order (top is the first slide). Only <span className="font-medium">Active</span> products
            appear on the storefront.
          </p>

          {isLoading ? (
            <CenteredSpinner label="Loading…" />
          ) : stars.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              No star products yet. Add some from the right — until then the carousel falls back to your newest products.
            </p>
          ) : (
            <ul className="space-y-2">
              {stars.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                  <span className="w-5 text-center text-xs font-semibold text-slate-400">{i + 1}</span>
                  <Thumb url={p.imageUrl} alt={p.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{formatMoney(p.priceCents)}</p>
                  </div>
                  <Badge className={STATUS_BADGE[p.status]}>{p.status}</Badge>
                  <div className="flex items-center">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === stars.length - 1}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Add products */}
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Add a product</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
            }}
            className="relative mb-4"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search products by name or SKU…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>

          {!search ? (
            <p className="text-sm text-slate-400">Search above to find products to feature.</p>
          ) : searching ? (
            <CenteredSpinner label="Searching…" />
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-400">No matching products (or all already added).</p>
          ) : (
            <ul className="space-y-2">
              {results.map((p) => {
                const imageUrl = p.media?.find((m) => m.type === 'IMAGE')?.url ?? p.media?.[0]?.url ?? null;
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                    <Thumb url={imageUrl} alt={p.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{formatMoney(p.priceCents)}</p>
                    </div>
                    <Badge className={STATUS_BADGE[p.status]}>{p.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => add(p)}>
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
