'use client';

import { PageHeader } from '@/components/admin/PageHeader';
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New product" description="Add a product to your catalog." />
      <ProductForm />
    </div>
  );
}
