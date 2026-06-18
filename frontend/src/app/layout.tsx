import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { SiteBanner } from '@/components/layout/SiteBanner';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Static tab title on every page: `template` has no %s, so any per-page
  // title still resolves to the brand name.
  title: {
    default: 'HashTag Creations',
    template: 'HashTag Creations',
  },
  description:
    'Shop premium 3D-printed home decor, desk accessories, toys, and fully custom prints. Upload your own STL for made-to-order printing.',
  openGraph: {
    title: 'HashTag Creations — Custom 3D Printed Products',
    description: 'Premium 3D-printed products and custom prints.',
    url: siteUrl,
    siteName: 'HashTag Creations',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <Providers>
          <SiteBanner />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </Providers>
      </body>
    </html>
  );
}
