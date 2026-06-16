'use client';

import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ImageOff, ShoppingCart } from 'lucide-react';
import type { ProductCard as ProductCardType } from '@/types';
import { useCart } from '@/lib/cart-store';
import { formatMoney } from '@/lib/utils';
import { Rating } from '@/components/ui/Rating';
import { Badge } from '@/components/ui/Badge';

export function ProductCard({ product }: { product: ProductCardType }) {
  const add = useCart((s) => s.add);

  const quickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    // Products with options should be configured on the detail page.
    try {
      await add({ productId: product.id, quantity: 1 });
      toast.success(`Added ${product.name} to cart`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add to cart');
    }
  };

  const onSale = !!product.compareAtCents && product.compareAtCents > product.priceCents;
  const discountPct = onSale
    ? Math.round(((product.compareAtCents! - product.priceCents) / product.compareAtCents!) * 100)
    : 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group card overflow-hidden transition hover:shadow-card-hover"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width:768px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.fulfillment === 'MADE_TO_ORDER' && <Badge className="bg-accent-500 text-white">Made to order</Badge>}
          {onSale && discountPct > 0 && <Badge className="bg-rose-600 text-white">{discountPct}% OFF</Badge>}
          {!product.inStock && product.fulfillment === 'STOCKED' && (
            <Badge className="bg-slate-700 text-white">Out of stock</Badge>
          )}
        </div>
      </div>

      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-1 font-medium text-slate-900">{product.name}</h3>
        <Rating value={product.ratingAvg} count={product.ratingCount} />
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-900">{formatMoney(product.priceCents)}</span>
            {onSale && <span className="text-xs text-slate-400 line-through">{formatMoney(product.compareAtCents!)}</span>}
          </div>
          <button
            onClick={quickAdd}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition hover:bg-brand-600 hover:text-white"
            aria-label="Add to cart"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}
