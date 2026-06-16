import Link from 'next/link';
import { Boxes } from 'lucide-react';

/**
 * Centered, branded card used by every auth page (login, register, password
 * reset, email verification, OAuth callback). Renders the HashTag Creations logo, a
 * title/subtitle, and arbitrary form children below.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 font-bold text-slate-900">
            <Boxes className="h-7 w-7 text-brand-600" />
            <span className="text-xl">HashTag Creations</span>
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
        </div>

        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
