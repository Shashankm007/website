'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Menu } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <RequireAuth adminOnly>
      <div className="flex min-h-screen bg-slate-50">
        <AdminSidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold text-slate-700">Admin console</p>
            <Link
              href="/"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              View store
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </header>

          <main className="container-page min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
