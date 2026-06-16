'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { BadgeCheck, MailWarning } from 'lucide-react';
import type { Address, User } from '@/types';
import { api } from '@/lib/client-api';
import { useApi } from '@/lib/use-api';
import { useAuth } from '@/lib/auth-context';
import { ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CenteredSpinner } from '@/components/ui/Feedback';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  phone: z
    .string()
    .trim()
    .max(32, 'Phone number is too long')
    .regex(/^[\d+().\s-]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;
type Profile = User & { addresses?: Address[] };

export default function ProfilePage() {
  const { data: profile, isLoading, mutate } = useApi<Profile>('/users/me');
  const { refreshUser } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', phone: '' },
  });

  // Sync the form once profile data arrives.
  useEffect(() => {
    if (profile) {
      reset({ name: profile.name ?? '', phone: profile.phone ?? '' });
    }
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { data } = await api.patch<Profile>('/users/me', {
        name: values.name.trim(),
        phone: values.phone?.trim() ? values.phone.trim() : null,
      });
      await mutate(data, { revalidate: false });
      await refreshUser();
      reset({ name: data.name ?? '', phone: data.phone ?? '' });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not update profile');
    }
  });

  if (isLoading || !profile) return <CenteredSpinner label="Loading your profile…" />;

  const verified = Boolean(profile.emailVerified);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Profile details</h2>
        <p className="mt-1 text-sm text-slate-500">Update your personal information.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div>
            <label className="label-base">Email</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input className="input-base sm:max-w-md" value={profile.email} readOnly disabled />
              {verified ? (
                <Badge className="bg-emerald-100 text-emerald-800">
                  <BadgeCheck className="mr-1 h-3.5 w-3.5" /> Verified
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800">
                  <MailWarning className="mr-1 h-3.5 w-3.5" /> Unverified
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">Your email address can&apos;t be changed.</p>
          </div>

          <Input label="Full name" placeholder="Jane Doe" error={errors.name?.message} {...register('name')} />

          <Input
            label="Phone"
            type="tel"
            placeholder="+1 (555) 123-4567"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
