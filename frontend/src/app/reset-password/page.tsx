'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ApiRequestError } from '@/lib/api';
import { api } from '@/lib/client-api';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';

// Mirror the backend password rule: ≥8 chars incl. upper, lower, and a digit.
const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a number'),
    confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof schema>;

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    if (!token) return;
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      toast.success('Password updated. Please sign in.');
      router.replace('/login');
    } catch (e) {
      const message =
        e instanceof ApiRequestError ? e.message : 'Could not reset your password. Please try again.';
      toast.error(message);
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Invalid reset link" subtitle="This link is missing or has expired.">
        <EmptyState
          title="Reset link not valid"
          description="Request a new password reset link to continue."
          action={
            <Link href="/forgot-password">
              <Button>Request a new link</Button>
            </Link>
          }
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a strong password for your account.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading…" />}>
      <ResetForm />
    </Suspense>
  );
}
