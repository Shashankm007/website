'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Heart, Minus, Plus, Ruler, ShoppingCart } from 'lucide-react';
import type { CustomUpload, ProductDetail } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-store';
import { useWishlist } from '@/lib/wishlist-store';
import { cn, formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { CustomerUpload } from './CustomerUpload';

const MAX_QTY = 99;

/** True for a well-formed MakerWorld model URL. */
function isValidMakerworld(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'makerworld.com' || host.endsWith('.makerworld.com');
  } catch {
    return false;
  }
}

export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const { user } = useAuth();
  const add = useCart((s) => s.add);

  // Selected option value id per option name.
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const opt of product.options) {
      if (opt.values.length) initial[opt.name] = opt.values[0].id;
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [customText, setCustomText] = useState('');
  const [upload, setUpload] = useState<CustomUpload | null>(null);
  const [modelLink, setModelLink] = useState('');
  const [customMethod, setCustomMethod] = useState<'upload' | 'link'>('upload');
  const [adding, setAdding] = useState(false);
  const wishlisted = useWishlist((s) => s.ids.includes(product.id));
  const toggleWish = useWishlist((s) => s.toggle);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  const needsUpload = product.customizationType !== 'NONE';
  // STL custom prints can be provided as an upload OR a MakerWorld model link.
  const isStl = product.customizationType === 'STL_UPLOAD';
  const linkValid = isValidMakerworld(modelLink);
  const customReady = !needsUpload || (isStl && customMethod === 'link' ? linkValid : !!upload);

  // Price = base + sum of selected option value deltas.
  const unitPriceCents = useMemo(() => {
    let total = product.priceCents;
    for (const opt of product.options) {
      const valId = selected[opt.name];
      const val = opt.values.find((v) => v.id === valId);
      if (val) total += val.priceDeltaCents;
    }
    return total;
  }, [product, selected]);

  const onSale = product.compareAtCents != null && product.compareAtCents > product.priceCents;
  const discountPct =
    onSale && product.compareAtCents
      ? Math.round(((product.compareAtCents - product.priceCents) / product.compareAtCents) * 100)
      : 0;
  const soldOut = product.fulfillment === 'STOCKED' && !product.inStock;

  // Map selected value ids -> human values for the cart payload.
  const optionsPayload = useMemo(() => {
    const out: Record<string, string> = {};
    for (const opt of product.options) {
      const val = opt.values.find((v) => v.id === selected[opt.name]);
      if (val) out[opt.name] = val.value;
    }
    return out;
  }, [product.options, selected]);

  const usingLink = isStl && customMethod === 'link';

  const addToCart = async () => {
    if (soldOut) return;
    if (needsUpload && !customReady) {
      toast.error(usingLink ? 'Please paste a valid MakerWorld model link.' : 'Please upload your file to continue.');
      return;
    }
    setAdding(true);
    try {
      await add({
        productId: product.id,
        quantity,
        options: Object.keys(optionsPayload).length ? optionsPayload : undefined,
        customText: customText.trim() || undefined,
        customUploadId: usingLink ? undefined : upload?.id,
        modelLink: usingLink ? modelLink.trim() : undefined,
      });
      toast.success(`Added ${product.name} to cart`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add to cart');
    } finally {
      setAdding(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) {
      toast.error('Please sign in to save items to your wishlist.', {
        action: { label: 'Sign in', onClick: () => (window.location.href = '/login') },
      });
      return;
    }
    setWishlistBusy(true);
    const wasWishlisted = wishlisted;
    try {
      await toggleWish(product.id);
      toast.success(wasWishlisted ? 'Removed from your wishlist' : 'Saved to your wishlist');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update wishlist');
    } finally {
      setWishlistBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{product.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Rating value={product.ratingAvg} count={product.ratingCount} />
          <span className="text-xs text-slate-400">SKU: {product.sku}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-bold text-slate-900">{formatMoney(unitPriceCents, product.currency)}</span>
        {onSale && (
          <>
            <span className="text-lg text-slate-400 line-through">{formatMoney(product.compareAtCents!, product.currency)}</span>
            <Badge className="bg-rose-600 text-white">{discountPct}% OFF</Badge>
          </>
        )}
      </div>

      {/* Availability */}
      <div className="flex flex-wrap items-center gap-2">
        {product.fulfillment === 'MADE_TO_ORDER' ? (
          <Badge className="bg-accent-500 text-white">Made to order</Badge>
        ) : product.inStock ? (
          <Badge className="bg-emerald-100 text-emerald-800">In stock</Badge>
        ) : (
          <Badge className="bg-slate-700 text-white">Out of stock</Badge>
        )}
        {onSale && <Badge className="bg-rose-600 text-white">Sale</Badge>}
      </div>

      {product.shortDescription && <p className="text-sm text-slate-600">{product.shortDescription}</p>}

      {/* Options */}
      {product.options.map((opt) => {
        const isColor = opt.name.toLowerCase() === 'color';
        const selectedVal = opt.values.find((v) => v.id === selected[opt.name]);
        return (
          <div key={opt.id} className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              {opt.name}
              {selected[opt.name] && (
                <span className="ml-2 font-normal text-slate-500">{selectedVal?.value}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {opt.values.map((val) => {
                const isSelected = selected[opt.name] === val.id;
                if (isColor && val.hex) {
                  return (
                    <button
                      key={val.id}
                      type="button"
                      title={`${val.value}${val.priceDeltaCents ? ` (+${formatMoney(val.priceDeltaCents, product.currency)})` : ''}`}
                      aria-label={val.value}
                      aria-pressed={isSelected}
                      onClick={() => setSelected((s) => ({ ...s, [opt.name]: val.id }))}
                      className={cn(
                        'h-9 w-9 rounded-full border-2 transition',
                        isSelected ? 'border-brand-600 ring-2 ring-brand-200' : 'border-slate-200 hover:border-slate-400',
                      )}
                      style={{ backgroundColor: val.hex }}
                    />
                  );
                }
                return (
                  <button
                    key={val.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected((s) => ({ ...s, [opt.name]: val.id }))}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm transition',
                      isSelected
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
                    )}
                  >
                    {val.value}
                    {val.priceDeltaCents > 0 && (
                      <span className="ml-1 text-xs text-slate-400">+{formatMoney(val.priceDeltaCents, product.currency)}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedVal?.dimension && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <Ruler className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <span>
                  <span className="font-medium text-slate-700">Dimensions:</span> {selectedVal.dimension}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Engraving — only for products the admin enabled it on */}
      {product.allowEngraving && (
        <Input
          label="Engraving text (optional)"
          placeholder="Add a custom message…"
          maxLength={120}
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
        />
      )}

      {/* Customer customization: file upload (STL/photo) or a MakerWorld link */}
      {needsUpload && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            {isStl ? 'Your 3D model' : 'Upload your photo'}
            <span className="ml-1 text-rose-600">*</span>
          </p>

          {isStl && (
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setCustomMethod('upload')}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium transition',
                  customMethod === 'upload' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Upload STL
              </button>
              <button
                type="button"
                onClick={() => setCustomMethod('link')}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium transition',
                  customMethod === 'link' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                MakerWorld link
              </button>
            </div>
          )}

          {isStl && customMethod === 'link' ? (
            <div className="space-y-1">
              <Input
                type="url"
                inputMode="url"
                placeholder="https://makerworld.com/en/models/…"
                value={modelLink}
                onChange={(e) => setModelLink(e.target.value)}
                error={modelLink && !linkValid ? 'Enter a valid MakerWorld model link' : undefined}
              />
              <p className="text-xs text-slate-400">Paste a MakerWorld model link and we’ll print it for you.</p>
            </div>
          ) : (
            <CustomerUpload
              kind={product.customizationType as 'STL_UPLOAD' | 'PHOTO_UPLOAD'}
              value={upload}
              onChange={setUpload}
            />
          )}
        </div>
      )}

      {/* Quantity */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Quantity</p>
        <div className="inline-flex items-center rounded-lg border border-slate-300">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="flex h-10 w-10 items-center justify-center text-slate-600 disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-sm font-medium tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
            disabled={quantity >= MAX_QTY}
            className="flex h-10 w-10 items-center justify-center text-slate-600 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {needsUpload && !customReady && !soldOut && (
        <p className="text-xs text-slate-500">
          {usingLink ? 'Paste a MakerWorld model link to continue' : 'Please upload your file to continue'}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="flex-1"
          onClick={addToCart}
          loading={adding}
          disabled={soldOut || (needsUpload && !customReady)}
        >
          <ShoppingCart className="h-5 w-5" />
          {soldOut ? 'Out of stock' : 'Add to cart'}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={toggleWishlist}
          loading={wishlistBusy}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={cn('h-5 w-5', wishlisted && 'fill-rose-500 text-rose-500')} />
          <span className="sm:hidden">{wishlisted ? 'Saved' : 'Save'}</span>
        </Button>
      </div>

      {!user && (
        <p className="text-xs text-slate-500">
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>{' '}
          to save items to your wishlist.
        </p>
      )}
    </div>
  );
}
