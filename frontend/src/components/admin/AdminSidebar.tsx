'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  FolderTree,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  ShoppingCart,
  Star,
  Ticket,
  Users,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/admin/products', label: 'Products', icon: <Package className="h-4 w-4" /> },
  { href: '/admin/star-products', label: 'Star products', icon: <Star className="h-4 w-4" /> },
  { href: '/admin/orders', label: 'Orders', icon: <ShoppingCart className="h-4 w-4" /> },
  { href: '/admin/inventory', label: 'Inventory', icon: <Warehouse className="h-4 w-4" /> },
  { href: '/admin/coupons', label: 'Coupons', icon: <Ticket className="h-4 w-4" /> },
  { href: '/admin/categories', label: 'Categories', icon: <FolderTree className="h-4 w-4" /> },
  { href: '/admin/users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { href: '/admin/chats', label: 'Support chat', icon: <MessageSquare className="h-4 w-4" /> },
  { href: '/admin/analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  { href: '/admin/settings/banner', label: 'Banner', icon: <Megaphone className="h-4 w-4" /> },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin navigation. Rendered as a fixed left rail on desktop and as a slide-out
 * drawer on mobile (controlled by the layout via `open` / `onNavigate`).
 */
export function AdminSidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? '/admin';

  const nav = (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span className={cn(active ? 'text-white' : 'text-slate-400')}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <Link href="/admin" className="flex items-center gap-2 px-5 py-5 font-bold text-slate-900">
            <Boxes className="h-6 w-6 text-brand-600" />
            <span className="text-lg">HashTag Creations</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Admin
            </span>
          </Link>
          <div className="flex-1 overflow-y-auto px-3 pb-6">{nav}</div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <div
          className={cn('absolute inset-0 bg-slate-900/40 transition-opacity', open ? 'opacity-100' : 'opacity-0')}
          onClick={onNavigate}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col border-r border-slate-200 bg-white shadow-card-hover transition-transform',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2 px-5 py-5 font-bold text-slate-900">
            <Boxes className="h-6 w-6 text-brand-600" />
            <span className="text-lg">HashTag Creations</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Admin
            </span>
          </Link>
          <div className="flex-1 overflow-y-auto px-3 pb-6">{nav}</div>
        </aside>
      </div>
    </>
  );
}
