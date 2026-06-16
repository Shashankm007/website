'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Box, ImageOff, Play } from 'lucide-react';
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

  return (
    <div className="space-y-3">
      {/* Main stage */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {view.kind === 'model' && model ? (
          <ModelViewer url={model.url} />
        ) : activeMedia ? (
          activeMedia.type === 'VIDEO' ? (
            <video
              src={activeMedia.url}
              controls
              playsInline
              className="absolute inset-0 h-full w-full bg-black object-contain"
            />
          ) : (
            <Image
              src={activeMedia.url}
              alt={activeMedia.alt ?? productName}
              fill
              priority
              sizes="(max-width:1024px) 100vw, 50vw"
              className="object-cover"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageOff className="h-12 w-12" />
          </div>
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
