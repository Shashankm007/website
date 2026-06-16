import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Category, ProductCard as ProductCardType } from '@/types';
import { serverApi } from '@/lib/api';
import { ProductCard } from '@/components/product/ProductCard';
import { EmptyState } from '@/components/ui/Feedback';
import { Hero } from '@/components/home/Hero';
import { ProductCarousel } from '@/components/home/ProductCarousel';
import { CategoryShowcase } from '@/components/home/CategoryShowcase';
import { CustomPrintPromo } from '@/components/home/CustomPrintPromo';
import { ValueProps } from '@/components/home/ValueProps';

export const metadata: Metadata = {
  title: 'Premium & Custom 3D-Printed Products',
  description:
    'HashTag Creations crafts premium 3D-printed home decor, desk accessories, and toys — or upload your own STL for fully custom, made-to-order prints. Free shipping over ₹999.',
  alternates: { canonical: '/' },
};

/**
 * Curated "star" products for the landing page (managed in Admin → Star products).
 * The endpoint returns the admin-ordered list, falling back to featured/newest.
 */
async function getFeaturedProducts(): Promise<ProductCardType[]> {
  const { data } = await serverApi.get<ProductCardType[]>('/products/featured', 60);
  return data;
}

export default async function HomePage() {
  // Fetch catalog data in parallel; degrade gracefully if either call fails.
  const [products, categories] = await Promise.all([
    getFeaturedProducts().catch(() => [] as ProductCardType[]),
    serverApi
      .get<Category[]>('/categories', 300)
      .then((r) => r.data)
      .catch(() => [] as Category[]),
  ]);

  // Top-level categories only (no parent).
  const topCategories = categories.filter((c) => !c.parentId).slice(0, 8);

  return (
    <div className="flex flex-col gap-16 pb-16 md:gap-20 md:pb-20">
      <Hero />

      {/* Star products carousel — reuses the featured/newest products already fetched above */}
      {products.length > 0 && <ProductCarousel products={products} />}

      {/* Featured products */}
      <section className="container">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Featured products</h2>
            <p className="mt-1 text-slate-500">Our best-loved prints, ready to ship.</p>
          </div>
          <Link
            href="/products"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No products yet"
            description="Our catalog is being forged. Check back soon for new prints."
            action={
              <Link
                href="/products"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Browse catalog
              </Link>
            }
          />
        )}
      </section>

      {/* Shop by category */}
      {topCategories.length > 0 && (
        <section className="container">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Shop by category</h2>
              <p className="mt-1 text-slate-500">Find your next print by collection.</p>
            </div>
            <Link
              href="/products"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              All categories
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <CategoryShowcase categories={topCategories} />
        </section>
      )}

      {/* Custom-print promo band */}
      <CustomPrintPromo />

      {/* Value props */}
      <section className="container">
        <ValueProps />
      </section>
    </div>
  );
}
