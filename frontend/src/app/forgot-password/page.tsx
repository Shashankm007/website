'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MailCheck } from 'lucide-react';
import { ApiRequestError } from '@/lib/api';
import { api } from '@/lib/client-api';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: values.email });
    } catch (e) {
      // Intentionally swallow non-success: we always show the same confirmation
      // to avoid leaking which emails are registered. Surface only hard failures.
      if (e instanceof ApiRequestError && e.code === 'RATE_LIMITED') {
        toast.error(e.message);
        setSubmitting(false);
        return;
      }
    }
    setSentTo(values.email);
    setSent(true);
    setSubmitting(false);
  };

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle={
          <>
            If an account exists for{' '}
            <span className="font-medium text-slate-700">{sentTo}</span>, we&apos;ve sent a link to
            reset your password.
          </>
        }
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MailCheck className="h-7 w-7" />
          </div>
          <p className="text-sm text-slate-500">
            The link expires shortly for your security. Check your spam folder if you don&apos;t see
            it.
          </p>
          <Link href="/login" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
