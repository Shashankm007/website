'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CenteredSpinner } from '@/components/ui/Feedback';

/**
 * Client-side route guard. Redirects to /login (or /403 for admin) once the
 * auth bootstrap finishes. Use to wrap account/admin pages.
 */
export function RequireAuth({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    } else if (adminOnly && user.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [user, loading, adminOnly, router]);

  if (loading || !user || (adminOnly && user.role !== 'ADMIN')) {
    return <CenteredSpinner label="Loading…" />;
  }
  return <>{children}</>;
}
