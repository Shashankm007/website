'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { Heart, Trash2 } from 'lucide-react';
import type { ProductCard as ProductCardType } from '@/types';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ProductCard } from '@/components/product/ProductCard';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';

// A wishlist row may embed the product summary under `product` or be a flat
// product. We normalize to the ProductCard shape ProductCard expects.
interface WishlistEntry {
  id?: string;
  productId?: string;
  product?: Partial<ProductCardType> & { id: string };
  [key: string]: unknown;
}

function toProductCard(entry: WishlistEntry): { productId: string; product: ProductCardType } | null {
  const p = (entry.product ?? (entry as unknown as Partial<ProductCardType>)) as Partial<ProductCardType> & {
    id?: string;
  };
  const productId = entry.productId ?? p.id;
  if (!productId || !p.slug || !p.name) return null;

  return {
    productId,
    product: {
      id: productId,
      name: p.name,
      slug: p.slug,
      priceCents: p.priceCents ?? 0,
      price: p.price ?? '',
      compareAtCents: p.compareAtCents ?? null,
      imageUrl: p.imageUrl ?? null,
      ratingAvg: p.ratingAvg ?? 0,
      ratingCount: p.ratingCount ?? 0,
      fulfillment: p.fulfillment ?? 'STOCKED',
      inStock: p.inStock ?? true,
    },
  };
}

function WishlistContent() {
  const { data, isLoading, mutate } = useApi<WishlistEntry[]>('/wishlist');

  const items = (data ?? []).map(toProductCard).filter((x): x is { productId: string; product: ProductCardType } => x !== null);

  const remove = async (productId: string) => {
    try {
      // Optimistically drop the item, then revalidate.
      await mutate(
        (current) => (current ?? []).filter((e) => (e.productId ?? e.product?.id) !== productId),
        { revalidate: false },
      );
      await api.del(`/wishlist/${productId}`);
      await mutate();
      toast.success('Removed from wishlist');
    } catch (err) {
      await mutate();
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not remove item');
    }
  };

  if (isLoading) return <CenteredSpinner label="Loading your wishlist…" />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-10 w-10" />}
        title="Your wishlist is empty"
        description="Save products you love to find them again later."
        action={
          <Link
            href="/products"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Browse products
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map(({ productId, product }) => (
        <div key={productId} className="relative">
          <ProductCard product={product} />
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 h-9 w-9 bg-white/90 text-rose-600 shadow-card hover:bg-white hover:text-rose-700"
            aria-label={`Remove ${product.name} from wishlist`}
            onClick={() => remove(productId)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function WishlistPage() {
  return (
    <RequireAuth>
      <div className="container-page">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Wishlist</h1>
        <WishlistContent />
      </div>
    </RequireAuth>
  );
}
