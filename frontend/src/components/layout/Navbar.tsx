'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Heart, LayoutDashboard, LogOut, Menu, Search, ShoppingCart, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-store';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/products', label: 'Shop' },
  { href: '/products?categorySlug=custom', label: 'Custom Prints' },
  { href: '/products?sort=popular', label: 'Bestsellers' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const itemCount = useCart((s) => s.cart?.itemCount ?? 0);
  const openCart = useCart((s) => s.setOpen);
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/products?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="HashTag Creations" className="h-8 w-8" />
          <span className="text-lg">HashTag Creations</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link key={l.label} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              {l.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={onSearch} className="ml-auto hidden flex-1 max-w-sm items-center md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="input-base pl-9"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href="/wishlist" className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 sm:inline-flex" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
          </Link>

          <button onClick={() => openCart(true)} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </button>

          {user ? (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Account">
                <UserIcon className="h-5 w-5" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-hover"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-medium">{user.name ?? 'Account'}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <MenuItem href="/account" icon={<UserIcon className="h-4 w-4" />} label="My account" />
                  <MenuItem href="/account/orders" icon={<ShoppingCart className="h-4 w-4" />} label="Orders" />
                  {user.role === 'ADMIN' && (
                    <MenuItem href="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Admin dashboard" />
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
              Sign in
            </Link>
          )}

          <button onClick={() => setMobileOpen((v) => !v)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <form onSubmit={onSearch} className="mb-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="input-base" />
          </form>
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

function MenuItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50')}>
      {icon}
      {label}
    </Link>
  );
}
