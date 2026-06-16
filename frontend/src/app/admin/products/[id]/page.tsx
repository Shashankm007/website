'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApi } from '@/lib/use-api';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProductForm, type ProductDetailLike } from '@/components/admin/ProductForm';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: product, isLoading, error } = useApi<ProductDetailLike>(`/admin/products/${id}`);

  if (isLoading) return <CenteredSpinner label="Loading product…" />;

  if (error || !product) {
    return (
      <EmptyState
        title="Product not found"
        description="This product may have been deleted."
        action={
          <Link href="/admin/products">
            <Button variant="outline">Back to products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit: ${product.name}`} description="Update product details and availability." />
      <ProductForm product={product} />
    </div>
  );
}
