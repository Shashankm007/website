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
import { useAuth } from '@/lib/auth-context';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Mirror the backend password rule: ≥8 chars incl. upper, lower, and a digit.
const schema = z
  .object({
    name: z.string().min(1, 'Name is required').max(120, 'Name is too long'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email').max(255),
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

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await registerUser({ name: values.name, email: values.email, password: values.password });
      setRegisteredEmail(values.email);
      toast.success('Account created — check your email to verify.');
    } catch (e) {
      const message =
        e instanceof ApiRequestError ? e.message : 'Unable to create your account. Please try again.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!registeredEmail) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: registeredEmail });
      toast.success('Verification email sent.');
    } catch (e) {
      const message =
        e instanceof ApiRequestError ? e.message : 'Could not resend the email. Please try again.';
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  if (registeredEmail) {
    return (
      <AuthCard
        title="Verify your email"
        subtitle={
          <>
            We sent a verification link to{' '}
            <span className="font-medium text-slate-700">{registeredEmail}</span>. Click the link to
            activate your account.
          </>
        }
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MailCheck className="h-7 w-7" />
          </div>
          <p className="text-sm text-slate-500">
            Didn&apos;t get the email? Check your spam folder or resend it below.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            loading={resending}
            onClick={onResend}
          >
            Resend verification email
          </Button>
          <Link href="/login" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Join HashTag Creations to shop and track your custom prints">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Name"
          type="text"
          autoComplete="name"
          placeholder="Jane Maker"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
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
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
