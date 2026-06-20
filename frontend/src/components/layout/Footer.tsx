import Link from 'next/link';

const columns = [
  {
    title: 'Shop',
    links: [
      { href: '/products', label: 'All products' },
      { href: '/products?categorySlug=home-decor', label: 'Home & Decor' },
      { href: '/products?categorySlug=desk-accessories', label: 'Desk Accessories' },
      { href: '/products?categorySlug=custom', label: 'Custom Prints' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/account', label: 'My account' },
      { href: '/account/orders', label: 'Order history' },
      { href: '/wishlist', label: 'Wishlist' },
      { href: '/cart', label: 'Cart' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/shipping', label: 'Shipping & Returns' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="HashTag Creations" className="h-7 w-7" />
            HashTag Creations
          </Link>
          <p className="mt-3 text-sm text-slate-500">
            Premium 3D-printed products and made-to-order custom prints, shipped worldwide.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-brand-700">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 py-6">
        <p className="container text-center text-xs text-slate-400">
          © {new Date().getFullYear()} HashTag Creations. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
