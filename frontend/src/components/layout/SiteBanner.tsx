'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Banner, BannerVariant } from '@/types';

const variantStyles: Record<BannerVariant, string> = {
  info: 'bg-brand-600 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-slate-900',
  sale: 'bg-rose-600 text-white',
};

const dismissKey = (updatedAt: string | null) => `hashtag_banner_dismissed:${updatedAt ?? ''}`;

export function SiteBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await apiRequest<Banner>('/settings/banner');
        if (!active) return;
        setBanner(data);
        if (data.dismissible) {
          try {
            setDismissed(localStorage.getItem(dismissKey(data.updatedAt)) === '1');
          } catch {
            // ignore storage access errors
          }
        }
      } catch {
        // public banner is best-effort; render nothing on failure
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!banner || !banner.enabled || !banner.message.trim() || dismissed) return null;

  const onDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(banner.updatedAt), '1');
    } catch {
      // ignore storage access errors
    }
  };

  const isInternal = !!banner.linkUrl && banner.linkUrl.startsWith('/');
  const showLink = !!banner.linkUrl && !!banner.linkLabel;

  const linkClassName = 'font-semibold underline underline-offset-2 hover:opacity-90';
  const linkLabel = banner.linkLabel ?? '';

  return (
    <div className={cn('w-full', variantStyles[banner.variant])}>
      <div className="container flex items-center justify-center gap-3 py-2 text-sm">
        <p className="text-center font-medium">
          {banner.message}
          {showLink && (
            <span className="ml-2 inline-block">
              {isInternal ? (
                <Link href={banner.linkUrl as string} className={linkClassName}>
                  {linkLabel}
                </Link>
              ) : (
                <a
                  href={banner.linkUrl as string}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClassName}
                >
                  {linkLabel}
                </a>
              )}
            </span>
          )}
        </p>
        {banner.dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss announcement"
            className="ml-auto shrink-0 rounded-full p-1 opacity-80 transition hover:bg-black/10 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
