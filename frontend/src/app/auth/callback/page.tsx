'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-store';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner } from '@/components/ui/Feedback';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setSessionToken } = useAuth();
  const mergeOnLogin = useCart((s) => s.mergeOnLogin);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      // The backend redirects here with the access token in the URL fragment,
      // e.g. /auth/callback#accessToken=<jwt>. The fragment never reaches a server.
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const token = new URLSearchParams(hash).get('accessToken');

      if (!token) {
        setFailed(true);
        return;
      }

      try {
        await setSessionToken(token);
        // Drop the token from the URL so it isn't left in history.
        window.history.replaceState(null, '', window.location.pathname);
        await mergeOnLogin();
        router.replace('/account');
      } catch {
        toast.error('Could not complete sign in. Please try again.');
        setFailed(true);
      }
    })();
  }, [router, setSessionToken, mergeOnLogin]);

  if (failed) {
    return (
      <AuthCard title="Sign in failed" subtitle="We couldn't complete your Google sign in.">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <XCircle className="h-7 w-7" />
          </div>
          <p className="text-sm text-slate-500">
            The sign-in link was missing or expired. Please try signing in again.
          </p>
          <Link href="/login" className="w-full">
            <Button className="w-full" size="lg">
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Signing you in" subtitle="Completing your Google sign in…">
      <CenteredSpinner label="Just a moment…" />
    </AuthCard>
  );
}
