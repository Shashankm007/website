import Link from 'next/link';
import { ArrowRight, FileUp, Layers, Wand2 } from 'lucide-react';

const highlights = [
  { icon: FileUp, label: 'Upload your STL or OBJ file' },
  { icon: Layers, label: 'Choose material, color & finish' },
  { icon: Wand2, label: 'Made-to-order, printed just for you' },
];

/** Full-width promo band steering customers to the custom-print flow. */
export function CustomPrintPromo() {
  return (
    <section className="container">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-8 shadow-card md:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-brand-400/30 blur-3xl"
        />

        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
              <Wand2 className="h-3.5 w-3.5" />
              Custom prints
            </span>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              Have a design in mind? We&apos;ll print it.
            </h2>
            <p className="mt-3 max-w-md text-brand-100">
              From prototypes to one-of-a-kind gifts, upload your own model and bring it to life with
              studio-grade, made-to-order 3D printing.
            </p>
            <Link
              href="/products?categorySlug=custom"
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-7 text-base font-medium text-brand-700 shadow-card transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Start a custom print
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <ul className="space-y-3">
            {highlights.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-white backdrop-blur"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
