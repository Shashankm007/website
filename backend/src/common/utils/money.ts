/** Money helpers — all internal amounts are integer minor units (paise for INR). */

export const DEFAULT_CURRENCY = 'INR';

export function formatMoney(minor: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((minor ?? 0) / 100);
}

/** Adds a `price` formatted string next to any `*Cents` integer fields for API output. */
export function withFormattedPrices<T extends Record<string, any>>(
  obj: T,
  currency = DEFAULT_CURRENCY,
): T & { price?: string } {
  if (typeof obj?.priceCents === 'number') {
    return { ...obj, price: formatMoney(obj.priceCents, obj.currency ?? currency) };
  }
  return obj;
}
