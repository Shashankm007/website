'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import type { ProductCard } from '@/types';
import { cn, formatMoney } from '@/lib/utils';

const AUTOPLAY_MS = 4000;

/**
 * Full-width auto-advancing hero carousel for star products. Each slide links to
 * the product detail page and overlays the name, price and a "Shop now" CTA.
 * Auto-advances every ~4s, pauses on hover, supports prev/next + dot controls.
 */
export function ProductCarousel({ products }: { products: ProductCard[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = products.length;

  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);

  // Keep the active index valid if the product list shrinks.
  useEffect(() => {
    if (index > count - 1) setIndex(0);
  }, [count, index]);

  // Auto-advance, paused on hover. Re-arms whenever the active slide changes so
  // each slide gets the full interval after a manual navigation.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (paused || count <= 1) return;
    timer.current = setInterval(next, AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, count, next, index]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Star products"
      className="relative h-[320px] w-full overflow-hidden bg-slate-900 sm:h-[420px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      <div className="relative h-full w-full">
        {products.map((product, i) => {
          const onSale = !!product.compareAtCents && product.compareAtCents > product.priceCents;
          const discountPct = onSale
            ? Math.round(
                ((product.compareAtCents! - product.priceCents) / product.compareAtCents!) * 100,
              )
            : 0;
          const active = i === index;

          return (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
              aria-label={`${product.name} — ${formatMoney(product.priceCents)}`}
              className={cn(
                'group absolute inset-0 transition-opacity duration-700 ease-in-out',
                active ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
            >
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-600">
                  <ImageOff className="h-12 w-12" />
                </div>
              )}

              {/* Dark gradient for caption legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

              {/* Caption */}
              <div className="container relative flex h-full flex-col items-start justify-end gap-3 pb-14 sm:pb-16">
                {onSale && discountPct > 0 && (
                  <span className="inline-flex items-center rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-card">
                    {discountPct}% OFF
                  </span>
                )}
                <h2 className="max-w-2xl text-2xl font-bold leading-tight text-white drop-shadow sm:text-4xl">
                  {product.name}
                </h2>
                <div className="flex items-baseline gap-3">
                  <span className="text-xl font-semibold text-white sm:text-2xl">
                    {formatMoney(product.priceCents)}
                  </span>
                  {onSale && (
                    <span className="text-sm text-white/60 line-through">
                      {formatMoney(product.compareAtCents!)}
                    </span>
                  )}
                </div>
                <span className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-medium text-white shadow-card transition group-hover:bg-brand-700">
                  Shop now
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Prev / Next controls */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-900 shadow-card backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:left-5"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-900 shadow-card backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:right-5"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2">
            {products.map((product, i) => (
              <button
                key={product.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80',
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
