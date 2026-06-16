'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, MapPin, Package, User } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/account', label: 'Profile', icon: User, exact: true },
  { href: '/account/orders', label: 'Orders', icon: Package, exact: false },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin, exact: false },
  { href: '/wishlist', label: 'Wishlist', icon: Heart, exact: true },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <RequireAuth>
      <div className="container-page">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">My account</h1>
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-64 lg:shrink-0">
            <nav
              className="card flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible"
              aria-label="Account navigation"
            >
              {NAV.map(({ href, label, icon: Icon, exact }) => {
                const active = isActive(href, exact);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                      active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </RequireAuth>
  );
}
