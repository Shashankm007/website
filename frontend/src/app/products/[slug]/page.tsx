import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { ProductDetail } from '@/types';
import { serverApi } from '@/lib/api';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductPurchasePanel } from '@/components/product/ProductPurchasePanel';
import { ReviewsSection } from '@/components/product/ReviewsSection';

interface PageProps {
  params: { slug: string };
}

async function getProduct(slug: string): Promise<ProductDetail | null> {
  return serverApi.getOrNull<ProductDetail>(`/products/${slug}`, 60);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) {
    return { title: 'Product not found' };
  }

  const description =
    product.shortDescription ??
    product.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) ??
    'Premium 3D-printed product from HashTag Creations.';

  const primaryImage = product.media.find((m) => m.type === 'IMAGE')?.url ?? product.imageUrl ?? undefined;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      type: 'website',
      images: primaryImage ? [{ url: primaryImage, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const category = product.categories[0];

  return (
    <div className="container-page">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-700">
          Home
        </Link>
        {category && (
          <>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <Link href={`/products?categorySlug=${category.slug}`} className="hover:text-slate-700">
              {category.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-4 w-4 text-slate-300" />
        <span className="font-medium text-slate-700">{product.name}</span>
      </nav>

      {/* Two-column: gallery + purchase panel */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery media={product.media} productName={product.name} />
        <ProductPurchasePanel product={product} />
      </div>

      {/* Description */}
      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Description</h2>
        <div
          className={[
            'max-w-3xl space-y-4 text-sm leading-relaxed text-slate-700',
            '[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-slate-900',
            '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900',
            '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900',
            '[&_p]:leading-relaxed',
            '[&_a]:font-medium [&_a]:text-brand-600 hover:[&_a]:underline',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1',
            '[&_strong]:font-semibold [&_strong]:text-slate-900',
            '[&_img]:rounded-xl',
          ].join(' ')}
          dangerouslySetInnerHTML={{ __html: product.description }}
        />
      </section>

      {/* Related products */}
      {product.related && product.related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {product.related.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <div className="mt-12">
        <ReviewsSection
          productId={product.id}
          productRatingAvg={product.ratingAvg}
          productRatingCount={product.ratingCount}
        />
      </div>
    </div>
  );
}
