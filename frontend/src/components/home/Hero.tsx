import Link from 'next/link';
import { ArrowRight, Sparkles, Upload } from 'lucide-react';

/**
 * Landing hero. Server-rendered (no interactivity) — bold headline, subcopy and
 * the two primary CTAs on a subtle brand gradient.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-accent-500/5" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 -z-10 h-72 w-72 rounded-full bg-accent-500/10 blur-3xl"
      />

      <div className="container flex flex-col items-center gap-6 py-20 text-center md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-4 py-1.5 text-sm font-medium text-brand-700 shadow-card backdrop-blur">
          <Sparkles className="h-4 w-4" />
          Precision 3D printing, made for you
        </span>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          Premium &amp; custom{' '}
          <span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">
            3D-printed products
          </span>{' '}
          built to last.
        </h1>

        <p className="max-w-2xl text-lg text-slate-600">
          Shop a curated catalog of meticulously printed home decor, desk accessories, and toys — or
          upload your own STL and we&apos;ll forge it made-to-order, just for you.
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/products"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-600 px-7 text-base font-medium text-white shadow-card transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            Shop all products
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/products?categorySlug=custom"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-7 text-base font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          >
            <Upload className="h-5 w-5" />
            Start a custom print
          </Link>
        </div>
      </div>
    </section>
  );
}
