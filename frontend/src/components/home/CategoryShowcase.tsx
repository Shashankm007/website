import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Boxes } from 'lucide-react';
import type { Category } from '@/types';

/**
 * "Shop by category" grid. Renders the supplied top-level categories as
 * image/title cards linking into the catalog filtered by slug.
 */
export function CategoryShowcase({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/products?categorySlug=${category.slug}`}
          className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-card transition hover:shadow-card-hover"
        >
          {category.imageUrl ? (
            <Image
              src={category.imageUrl}
              alt={category.name}
              fill
              sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300">
              <Boxes className="h-10 w-10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-4">
            <span className="text-lg font-semibold text-white drop-shadow">{category.name}</span>
            <ArrowRight className="h-5 w-5 shrink-0 text-white opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </Link>
      ))}
    </div>
  );
}
