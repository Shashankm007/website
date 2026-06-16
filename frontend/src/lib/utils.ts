import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format integer minor units (paise) as INR currency, e.g. ₹1,299.00. */
export function formatMoney(minor: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((minor ?? 0) / 100);
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Human label + tailwind classes for an order status badge. */
export function orderStatusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
    PAID: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800' },
    PRINTING: { label: 'Printing', className: 'bg-blue-100 text-blue-800' },
    SHIPPED: { label: 'Shipped', className: 'bg-indigo-100 text-indigo-800' },
    DELIVERED: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
    CANCELLED: { label: 'Cancelled', className: 'bg-rose-100 text-rose-800' },
    REFUNDED: { label: 'Refunded', className: 'bg-slate-200 text-slate-700' },
  };
  return map[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };
}
