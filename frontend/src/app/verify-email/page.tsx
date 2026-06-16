'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ApiRequestError } from '@/lib/api';
import { api } from '@/lib/client-api';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner } from '@/components/ui/Feedback';

type Status = 'verifying' | 'success' | 'error';

function VerifyEmail() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState('This verification link is invalid or expired.');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setStatus('error');
      setErrorMessage('This verification link is missing its token.');
      return;
    }

    (async () => {
      try {
        await api.post('/auth/verify-email', { token });
        setStatus('success');
      } catch (e) {
        setErrorMessage(
          e instanceof ApiRequestError
            ? e.message
            : 'This verification link is invalid or expired.',
        );
        setStatus('error');
      }
    })();
  }, [token]);

  if (status === 'verifying') {
    return (
      <AuthCard title="Verifying your email" subtitle="Hang tight while we confirm your account.">
        <CenteredSpinner label="Verifying…" />
      </AuthCard>
    );
  }

  if (status === 'success') {
    return (
      <AuthCard title="Email verified" subtitle="Your account is now active.">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-sm text-slate-500">
            Thanks for confirming your email. You can now sign in and start shopping.
          </p>
          <Link href="/login" className="w-full">
            <Button className="w-full" size="lg">
              Continue to sign in
            </Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Verification failed" subtitle="We couldn't verify your email.">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <XCircle className="h-7 w-7" />
        </div>
        <p className="text-sm text-slate-500">{errorMessage}</p>
        <Link href="/login" className="w-full">
          <Button variant="outline" className="w-full" size="lg">
            Back to sign in
          </Button>
        </Link>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading…" />}>
      <VerifyEmail />
    </Suspense>
  );
}
