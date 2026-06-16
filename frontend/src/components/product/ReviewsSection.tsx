'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageSquare, ShieldCheck, Star } from 'lucide-react';
import type { Review, ReviewEligibility } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/client-api';
import { ApiRequestError } from '@/lib/api';
import { useApi, useApiList } from '@/lib/use-api';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Rating } from '@/components/ui/Rating';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';

const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Please pick a rating').max(5),
  title: z.string().trim().max(120).optional().or(z.literal('')),
  body: z.string().trim().min(10, 'Tell us a little more (10+ characters)').max(2000),
});
type ReviewForm = z.infer<typeof reviewSchema>;

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= (hover || value);
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(i)}
            className="p-0.5"
          >
            <Star className={cn('h-7 w-7 transition', active ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200')} />
          </button>
        );
      })}
    </div>
  );
}

export function ReviewsSection({ productId, productRatingAvg, productRatingCount }: { productId: string; productRatingAvg: number; productRatingCount: number }) {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useApiList<Review[]>(`/products/${productId}/reviews`);

  // Only verified buyers may review — fetch eligibility when signed in.
  const {
    data: eligibility,
    isLoading: eligibilityLoading,
    mutate: mutateEligibility,
  } = useApi<ReviewEligibility>(user ? `/reviews/eligibility/${productId}` : null);

  const reviews = data?.data ?? [];
  // Prefer the paginated total, then the loaded count, then the product aggregate.
  const total = data?.meta?.total ?? (data ? reviews.length : productRatingCount);

  // Prefer the live average from the loaded reviews; fall back to the product aggregate.
  const average = useMemo(() => {
    if (reviews.length) return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return productRatingAvg;
  }, [reviews, productRatingAvg]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, title: '', body: '' },
  });

  const rating = watch('rating');

  const onSubmit = async (values: ReviewForm) => {
    try {
      await api.post('/reviews', {
        productId,
        rating: values.rating,
        title: values.title?.trim() || undefined,
        body: values.body.trim(),
      });
      toast.success('Thanks for your review!');
      reset({ rating: 0, title: '', body: '' });
      await Promise.all([mutate(), mutateEligibility()]);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 403 || err.status === 409)) {
        toast.error(err.message || 'You are not able to review this product.');
        // Re-sync eligibility so the form reflects the server's decision.
        await mutateEligibility();
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not submit your review');
      }
    }
  };

  return (
    <section id="reviews" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Customer reviews</h2>
        <div className="flex items-center gap-3">
          <Rating value={average} size={18} />
          <span className="text-sm text-slate-600">
            {average ? average.toFixed(1) : '—'} · {total} {total === 1 ? 'review' : 'reviews'}
          </span>
        </div>
      </div>

      {/* Write a review — gated to verified buyers */}
      {!user ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-slate-600">Sign in to write a review — only verified buyers can review.</p>
          <Link href="/login">
            <Button variant="outline">Sign in to write a review</Button>
          </Link>
        </div>
      ) : eligibilityLoading || !eligibility ? null : eligibility.alreadyReviewed ? (
        <div className="card flex items-center gap-2 p-5 text-sm text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          You&apos;ve already reviewed this product.
        </div>
      ) : eligibility.canReview ? (
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-5">
          <h3 className="font-medium text-slate-900">Write a review</h3>
          <div>
            <span className="label-base">Your rating</span>
            <StarInput value={rating} onChange={(v) => setValue('rating', v, { shouldValidate: true })} />
            {errors.rating && <p className="mt-1 text-xs text-rose-600">{errors.rating.message}</p>}
          </div>
          <Input label="Title (optional)" placeholder="Sum it up in a few words" error={errors.title?.message} {...register('title')} />
          <Textarea label="Your review" placeholder="What did you like or dislike?" error={errors.body?.message} {...register('body')} />
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              Submit review
            </Button>
          </div>
        </form>
      ) : !eligibility.hasPurchased ? (
        <div className="card flex items-start gap-2 p-5 text-sm text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>Only verified buyers can review this product. You can leave a review once your order has been delivered.</span>
        </div>
      ) : null}

      {/* Review list */}
      {isLoading ? (
        <CenteredSpinner label="Loading reviews…" />
      ) : error ? (
        <EmptyState title="Couldn't load reviews" description="Please try again in a moment." icon={<MessageSquare className="h-10 w-10" />} />
      ) : reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Be the first to share your thoughts on this product."
          icon={<MessageSquare className="h-10 w-10" />}
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{review.user?.name ?? 'Anonymous'}</span>
                  {review.verified && (
                    <Badge className="bg-emerald-100 text-emerald-800">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      Verified purchase
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
              </div>
              <div className="mt-1">
                <Rating value={review.rating} />
              </div>
              {review.title && <h4 className="mt-2 font-medium text-slate-900">{review.title}</h4>}
              {review.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{review.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
