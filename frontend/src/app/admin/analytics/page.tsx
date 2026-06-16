'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useApi } from '@/lib/use-api';
import { qs, ApiRequestError } from '@/lib/api';
import { formatMoney, formatDate, orderStatusBadge, cn } from '@/lib/utils';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/admin/PageHeader';

type Range = '7d' | '30d' | '90d';

interface SalesPoint {
  date: string;
  revenueCents: number;
  orders: number;
}
interface StatusPoint {
  status: string;
  count: number;
}
interface UsersPoint {
  date: string;
  count: number;
}
interface AdminAnalytics {
  salesByDay: SalesPoint[];
  ordersByStatus: StatusPoint[];
  newUsersByDay: UsersPoint[];
}

const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#10b981',
  PRINTING: '#3b82f6',
  SHIPPED: '#6366f1',
  DELIVERED: '#22c55e',
  CANCELLED: '#f43f5e',
  REFUNDED: '#94a3b8',
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

function ChartCard({
  title,
  subtitle,
  isEmpty,
  children,
}: {
  title: string;
  subtitle?: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {isEmpty ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
          No data for this range.
        </div>
      ) : (
        <div className="h-[280px] w-full">{children}</div>
      )}
    </section>
  );
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Range>('30d');
  const { data, error, isLoading } = useApi<AdminAnalytics>(`/admin/analytics${qs({ range })}`);

  useEffect(() => {
    if (error) {
      const msg = error instanceof ApiRequestError ? error.message : 'Failed to load analytics';
      toast.error(msg);
    }
  }, [error]);

  const salesData = useMemo(
    () =>
      (data?.salesByDay ?? []).map((p) => ({
        ...p,
        revenue: p.revenueCents / 100,
      })),
    [data],
  );

  const statusData = useMemo(
    () =>
      (data?.ordersByStatus ?? []).map((p) => ({
        ...p,
        label: orderStatusBadge(p.status).label,
      })),
    [data],
  );

  const usersData = data?.newUsersByDay ?? [];

  const rangeSelector = (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => setRange(r.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition',
            range === r.value ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
          )}
          aria-pressed={range === r.value}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (isLoading && !data) {
    return (
      <div>
        <PageHeader title="Analytics" description="Sales, orders, and customer trends." action={rangeSelector} />
        <CenteredSpinner label="Loading analytics…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Analytics" description="Sales, orders, and customer trends." action={rangeSelector} />
        <EmptyState
          title="Could not load analytics"
          description="There was a problem fetching the data. Try changing the range or refreshing."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Analytics" description="Sales, orders, and customer trends." action={rangeSelector} />

      <div className="grid grid-cols-1 gap-6">
        <ChartCard title="Sales by day" subtitle="Revenue across the selected period" isEmpty={salesData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v: number) => formatMoney(v * 100)}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label))}
                formatter={(value: number) => [formatMoney(Math.round(value * 100)), 'Revenue']}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#revGradient)"
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartCard title="Orders by status" subtitle="Distribution in the selected period" isEmpty={statusData.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Orders']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Orders">
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="New users by day" subtitle="Sign-ups across the selected period" isEmpty={usersData.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usersData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value: number) => [value, 'New users']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="New users"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
