import { Truck, ShieldCheck, Hammer, Globe2 } from 'lucide-react';

const props = [
  {
    icon: Truck,
    title: 'Free shipping over ₹999',
    description: 'Fast, tracked delivery on every qualifying order.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Razorpay checkout',
    description: 'Encrypted payments you can trust, end to end.',
  },
  {
    icon: Hammer,
    title: 'Made-to-order',
    description: 'Printed on demand to exacting tolerances.',
  },
  {
    icon: Globe2,
    title: 'Worldwide shipping',
    description: 'We forge and ship to customers across the globe.',
  },
];

/** Trust / value-proposition row with icons. */
export function ValueProps() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {props.map(({ icon: Icon, title, description }) => (
        <div key={title} className="card flex items-start gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
