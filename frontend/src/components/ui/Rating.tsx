import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Read-only star rating display. */
export function Rating({ value, count, size = 16 }: { value: number; count?: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={cn(i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200')}
          />
        ))}
      </div>
      {typeof count === 'number' && <span className="text-xs text-slate-500">({count})</span>}
    </div>
  );
}
