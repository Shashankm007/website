'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Heart, ImageOff, ShoppingCart } from 'lucide-react';
import type { ProductCard as ProductCardType } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-store';
import { useWishlist } from '@/lib/wishlist-store';
import { cn, formatMoney } from '@/lib/utils';
import { Rating } from '@/components/ui/Rating';
import { Badge } from '@/components/ui/Badge';

export function ProductCard({ product }: { product: ProductCardType }) {
  const add = useCart((s) => s.add);
  const { user } = useAuth();
  const wished = useWishlist((s) => s.ids.includes(product.id));
  const toggle = useWishlist((s) => s.toggle);
  const [wishBusy, setWishBusy] = useState(false);

  // Photos the card can cycle through (falls back to the single primary image).
  const images = useMemo(
    () => (product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []),
    [product.images, product.imageUrl],
  );
  const [photo, setPhoto] = useState(0);
  const activeIdx = images.length ? photo % images.length : 0;
  const cyclePhoto = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length < 2) return;
    setPhoto((p) => (p + delta + images.length) % images.length);
  };

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to save items to your wishlist');
      return;
    }
    if (wishBusy) return;
    setWishBusy(true);
    const wasWished = wished;
    try {
      await toggle(product.id);
      toast.success(wasWished ? 'Removed from wishlist' : `Saved ${product.name} to wishlist`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update wishlist');
    } finally {
      setWishBusy(false);
    }
  };

  const quickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
        {images.length > 0 ? (
          // All photos are mounted (stacked) so the browser preloads them;
          // switching just crossfades opacity — no fetch delay, smooth change.
          images.map((src, i) => (
            <Image
              key={`${src}-${i}`}
              src={src}
              alt={product.name}
              fill
              sizes="(max-width:768px) 50vw, 25vw"
              className={cn(
                'object-cover transition duration-500 group-hover:scale-105',
                i === activeIdx ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))
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

        {/* Photo cycling: arrows (always on touch, on-hover on desktop) + dots */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => cyclePhoto(e, -1)}
              aria-label="Previous photo"
              className="absolute left-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-700 opacity-100 shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => cyclePhoto(e, 1)}
              aria-label="Next photo"
              className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-700 opacity-100 shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPhoto(i);
                  }}
                  aria-label={`View photo ${i + 1}`}
                  aria-current={i === activeIdx}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === activeIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/90',
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-1 font-medium text-slate-900">{product.name}</h3>
        <Rating value={product.ratingAvg} count={product.ratingCount} />
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-900">{formatMoney(product.priceCents)}</span>
            {onSale && <span className="text-xs text-slate-400 line-through">{formatMoney(product.compareAtCents!)}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleWishlist}
              disabled={wishBusy}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:opacity-60',
                wished
                  ? 'border-rose-200 bg-rose-50 text-rose-600'
                  : 'border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600',
              )}
              aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={wished}
            >
              <Heart className={cn('h-4 w-4', wished && 'fill-rose-600')} />
            </button>
            <button
              onClick={quickAdd}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition hover:bg-brand-600 hover:text-white"
              aria-label="Add to cart"
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
