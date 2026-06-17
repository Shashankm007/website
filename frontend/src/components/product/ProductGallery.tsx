'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Box, ChevronLeft, ChevronRight, ImageOff, Play } from 'lucide-react';
import type { MediaItem } from '@/types';
import { cn } from '@/lib/utils';
import { CenteredSpinner } from '@/components/ui/Feedback';

// The 3D viewer is browser-only (WebGL); never render it on the server.
const ModelViewer = dynamic(() => import('./ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-slate-50">
      <CenteredSpinner label="Loading 3D viewer…" />
    </div>
  ),
});

type View = { kind: 'media'; index: number } | { kind: 'model' };

export function ProductGallery({ media, productName }: { media: MediaItem[]; productName: string }) {
  // Images and videos share the thumbnail strip + main stage, ordered by position.
  const visuals = useMemo(
    () =>
      [...media]
        .filter((m) => m.type === 'IMAGE' || m.type === 'VIDEO')
        .sort((a, b) => a.position - b.position),
    [media],
  );
  const model = useMemo(() => media.find((m) => m.type === 'MODEL_3D') ?? null, [media]);

  const [view, setView] = useState<View>(
    visuals.length ? { kind: 'media', index: 0 } : model ? { kind: 'model' } : { kind: 'media', index: 0 },
  );

  const activeMedia = view.kind === 'media' ? visuals[view.index] : undefined;

  // Cycle through the image/video visuals on the main stage.
  const go = (delta: number) => {
    if (!visuals.length) return;
    setView((v) => {
      const current = v.kind === 'media' ? v.index : 0;
      return { kind: 'media', index: (current + delta + visuals.length) % visuals.length };
    });
  };

  return (
    <div className="space-y-3">
      {/* Main stage */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {/* Image visuals stacked as crossfade layers — all mounted so the
            browser preloads them; switching just animates opacity. */}
        {visuals.map((item, i) =>
          item.type === 'IMAGE' ? (
            <Image
              key={item.id}
              src={item.url}
              alt={item.alt ?? productName}
              fill
              priority={i === 0}
              sizes="(max-width:1024px) 100vw, 50vw"
              className={cn(
                'object-cover transition-opacity duration-500',
                view.kind === 'media' && view.index === i ? 'opacity-100' : 'opacity-0',
              )}
            />
          ) : null,
        )}

        {/* Active video (rendered only while it's the selected visual) */}
        {view.kind === 'media' && activeMedia?.type === 'VIDEO' && (
          <video
            key={activeMedia.id}
            src={activeMedia.url}
            controls
            playsInline
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        )}

        {/* 3D model */}
        {view.kind === 'model' && model && <ModelViewer url={model.url} />}

        {/* Empty state */}
        {view.kind === 'media' && visuals.length === 0 && (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageOff className="h-12 w-12" />
          </div>
        )}

        {/* Prev / next arrows for cycling photos */}
        {view.kind === 'media' && visuals.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-card backdrop-blur transition hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-card backdrop-blur transition hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-slate-900/60 px-2 py-0.5 text-xs font-medium text-white">
              {view.index + 1}/{visuals.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {(visuals.length > 1 || model) && (
        <div className="flex flex-wrap gap-2">
          {visuals.map((item, i) => {
            const selected = view.kind === 'media' && view.index === i;
            const isVideo = item.type === 'VIDEO';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView({ kind: 'media', index: i })}
                aria-label={`View ${isVideo ? 'video' : 'image'} ${i + 1}`}
                aria-pressed={selected}
                className={cn(
                  'relative h-16 w-16 overflow-hidden rounded-lg border-2 bg-slate-100 transition sm:h-20 sm:w-20',
                  selected ? 'border-brand-600 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300',
                )}
              >
                {isVideo ? (
                  <video src={item.url} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Image src={item.url} alt={item.alt ?? `${productName} ${i + 1}`} fill sizes="80px" className="object-cover" />
                )}
                {isVideo && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Play className="h-5 w-5 fill-white text-white" />
                  </span>
                )}
              </button>
            );
          })}

          {model && (
            <button
              type="button"
              onClick={() => setView({ kind: 'model' })}
              aria-label="View 3D model"
              aria-pressed={view.kind === 'model'}
              className={cn(
                'flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 text-[10px] font-medium transition sm:h-20 sm:w-20',
                view.kind === 'model'
                  ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              <Box className="h-5 w-5" />
              3D
            </button>
          )}
        </div>
      )}
    </div>
  );
}
