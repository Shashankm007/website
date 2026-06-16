import type { Metadata } from 'next';
import { PackageSearch } from 'lucide-react';
import type { Category, ProductCard as ProductCardType } from '@/types';
import { serverApi, qs } from '@/lib/api';
import { EmptyState } from '@/components/ui/Feedback';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductFilters } from '@/components/product/ProductFilters';
import { ListingPagination, SortSelect } from '@/components/product/ListingControls';

export const revalidate = 30;

type SearchParams = Record<string, string | string[] | undefined>;

/** Read a single string value from Next.js searchParams. */
function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Parse a positive integer, returning undefined when absent/invalid. */
function toInt(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/** Dollar string input → integer cents for the API. */
function dollarsToCents(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await serverApi.get<Category[]>('/categories', 60);
    return data ?? [];
  } catch {
    // The catalog should still render even if the category sidebar fails.
    return [];
  }
}

/** Resolve a human label for the current category filter, if any. */
function findCategory(categories: Category[], slug?: string, id?: string): Category | undefined {
  if (!slug && !id) return undefined;
  for (const category of categories) {
    if ((slug && category.slug === slug) || (id && category.id === id)) return category;
    if (category.children?.length) {
      const found = findCategory(category.children, slug, id);
      if (found) return found;
    }
  }
  return undefined;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const search = one(searchParams.search)?.trim();
  const categorySlug = one(searchParams.categorySlug);
  const categoryId = one(searchParams.categoryId);

  let title = 'Shop all products';
  if (search) {
    title = `Search results for “${search}”`;
  } else if (categorySlug || categoryId) {
    const categories = await getCategories();
    const category = findCategory(categories, categorySlug, categoryId);
    if (category) title = category.name;
  }

  return {
    title,
    description: 'Browse premium 3D-printed products — filter by category, price, availability, and tags.',
    alternates: { canonical: '/products' },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = toInt(one(searchParams.page)) ?? 1;
  const search = one(searchParams.search)?.trim();
  const categorySlug = one(searchParams.categorySlug);
  const categoryId = one(searchParams.categoryId);
  const tags = one(searchParams.tags);
  const availabilityRaw = one(searchParams.availability);
  const availability =
    availabilityRaw === 'in_stock' || availabilityRaw === 'made_to_order' || availabilityRaw === 'all'
      ? availabilityRaw
      : undefined;
  const sort = one(searchParams.sort);
  const minPrice = dollarsToCents(one(searchParams.minPrice));
  const maxPrice = dollarsToCents(one(searchParams.maxPrice));

  const query = qs({
    page,
    search,
    categorySlug,
    categoryId,
    tags,
    minPrice,
    maxPrice,
    availability,
    sort,
  });

  const categories = await getCategories();

  let products: ProductCardType[] = [];
  let total = 0;
  let totalPages = 1;
  let metaPage = page;
  let failed = false;

  try {
    const res = await serverApi.get<ProductCardType[]>(`/products${query}`, revalidate);
    products = res.data ?? [];
    total = res.meta?.total ?? products.length;
    totalPages = res.meta?.totalPages ?? 1;
    metaPage = res.meta?.page ?? page;
  } catch {
    failed = true;
  }

  const activeCategory = findCategory(categories, categorySlug, categoryId);
  const heading = search ? `Results for “${search}”` : activeCategory?.name ?? 'All products';

  return (
    <div className="container-page">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{heading}</h1>
        {activeCategory?.description && !search && (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{activeCategory.description}</p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <ProductFilters categories={categories} />

        <section>
          {/* Toolbar: result count + sort */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500" aria-live="polite">
              {failed
                ? 'Unable to load products'
                : total === 0
                  ? 'No products found'
                  : `${total.toLocaleString()} ${total === 1 ? 'product' : 'products'}`}
            </p>
            <div className="flex items-center gap-2">
              <label className="hidden whitespace-nowrap text-sm text-slate-500 sm:block">Sort by</label>
              <SortSelect />
            </div>
          </div>

          {failed ? (
            <EmptyState
              title="Something went wrong"
              description="We couldn't load products right now. Please try refreshing the page."
              icon={<PackageSearch className="h-10 w-10" />}
            />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products match your filters"
              description="Try adjusting your search, price range, or clearing filters to see more results."
              icon={<PackageSearch className="h-10 w-10" />}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <ListingPagination page={metaPage} totalPages={totalPages} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
