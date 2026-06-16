'use client';

import { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  MapPin,
  Search,
  ShieldCheck,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUserDetail, AdminUserListItem, Role, UserStatus } from '@/types';
import { useApi, useApiList } from '@/lib/use-api';
import { ApiRequestError, qs } from '@/lib/api';
import { api } from '@/lib/client-api';
import { formatDate, formatMoney, orderStatusBadge } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

const PAGE_SIZE = 20;

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-indigo-100 text-indigo-800',
  CUSTOMER: 'bg-slate-100 text-slate-700',
};

const STATUS_BADGE: Record<UserStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  BLOCKED: 'bg-rose-100 text-rose-800',
};

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function RoleBadge({ role }: { role: Role }) {
  return <Badge className={ROLE_BADGE[role]}>{titleCase(role)}</Badge>;
}

function StatusBadge({ status }: { status: UserStatus }) {
  return <Badge className={STATUS_BADGE[status]}>{titleCase(status)}</Badge>;
}

function VerifiedMark({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center text-emerald-600" title="Email verified" aria-label="Verified">
      <Check className="h-4 w-4" />
    </span>
  ) : (
    <span className="inline-flex items-center text-slate-300" title="Email not verified" aria-label="Not verified">
      <X className="h-4 w-4" />
    </span>
  );
}

type PendingAction =
  | { kind: 'status'; user: AdminUserListItem; next: UserStatus }
  | { kind: 'role'; user: AdminUserListItem; next: Role };

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    role: role || undefined,
    status: status || undefined,
  });
  const { data, isLoading, mutate } = useApiList<AdminUserListItem[]>(`/admin/users${query}`);

  const users = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const total = data?.meta?.total ?? 0;

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function confirmAction() {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.kind === 'status') {
        await api.patch(`/admin/users/${pending.user.id}/status`, { status: pending.next });
        toast.success(pending.next === 'BLOCKED' ? 'User blocked' : 'User unblocked');
      } else {
        await api.patch(`/admin/users/${pending.user.id}/role`, { role: pending.next });
        toast.success(`Role changed to ${pending.next.toLowerCase()}`);
      }
      await mutate();
      setPending(null);
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : 'Could not update the user';
      toast.error(message);
    } finally {
      setWorking(false);
    }
  }

  const confirmCopy = pending
    ? pending.kind === 'status'
      ? {
          title: pending.next === 'BLOCKED' ? 'Block this user?' : 'Unblock this user?',
          description:
            pending.next === 'BLOCKED'
              ? `${pending.user.email} will be signed out and unable to log in until unblocked.`
              : `${pending.user.email} will regain access to their account.`,
          confirmLabel: pending.next === 'BLOCKED' ? 'Block user' : 'Unblock user',
          danger: pending.next === 'BLOCKED',
        }
      : {
          title: 'Change this user’s role?',
          description: `${pending.user.email} will become ${
            pending.next === 'ADMIN' ? 'an administrator with full access' : 'a regular customer'
          }.`,
          confirmLabel: `Make ${pending.next.toLowerCase()}`,
          danger: pending.next === 'ADMIN',
        }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={total ? `${total} user${total === 1 ? '' : 's'}` : 'Manage customer and admin accounts'}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form onSubmit={applySearch} className="flex w-full items-end gap-2 sm:max-w-sm">
          <Input
            label="Search"
            placeholder="Name or email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Search users">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <div className="w-full sm:max-w-[10rem]">
          <Select
            label="Role"
            value={role}
            onChange={(e) => {
              setPage(1);
              setRole(e.target.value as Role | '');
            }}
          >
            <option value="">All roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>
        <div className="w-full sm:max-w-[10rem]">
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as UserStatus | '');
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="BLOCKED">Blocked</option>
          </Select>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <div className="card p-10">
            <CenteredSpinner label="Loading users…" />
          </div>
        ) : users.length === 0 ? (
          <div className="card p-6">
            <EmptyState
              icon={<UsersIcon className="h-10 w-10" />}
              title="No users found"
              description={
                search || role || status
                  ? 'Try adjusting your search or filters.'
                  : 'Registered users will appear here.'
              }
            />
          </div>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setDetailId(u.id)}
              className="card w-full p-4 text-left transition hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{u.name || 'Unnamed'}</p>
                  <p className="truncate text-sm text-slate-500">{u.email}</p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <RoleBadge role={u.role} />
                  <StatusBadge status={u.status} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="text-slate-700">{u.phone || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Verified</dt>
                  <dd>
                    <VerifiedMark verified={Boolean(u.emailVerified)} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Orders</dt>
                  <dd className="text-slate-700">{u.orderCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Spent</dt>
                  <dd className="text-slate-700">{formatMoney(u.totalSpentCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Joined</dt>
                  <dd className="text-slate-700">{formatDate(u.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Last login</dt>
                  <dd className="text-slate-700">{u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}</dd>
                </div>
              </dl>
            </button>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <DataTable<AdminUserListItem>
          loading={isLoading}
          rows={users}
          rowKey={(u) => u.id}
          empty={
            <EmptyState
              icon={<UsersIcon className="h-10 w-10" />}
              title="No users found"
              description={
                search || role || status
                  ? 'Try adjusting your search or filters.'
                  : 'Registered users will appear here.'
              }
            />
          }
          columns={[
            {
              key: 'customer',
              header: 'Customer',
              render: (u) => (
                <button
                  type="button"
                  onClick={() => setDetailId(u.id)}
                  className="group block max-w-[16rem] text-left"
                >
                  <span className="block truncate font-medium text-slate-900 group-hover:text-brand-700">
                    {u.name || 'Unnamed'}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{u.email}</span>
                </button>
              ),
            },
            {
              key: 'phone',
              header: 'Phone',
              render: (u) => <span className="whitespace-nowrap text-slate-600">{u.phone || '—'}</span>,
            },
            {
              key: 'role',
              header: 'Role',
              render: (u) => <RoleBadge role={u.role} />,
            },
            {
              key: 'status',
              header: 'Status',
              render: (u) => <StatusBadge status={u.status} />,
            },
            {
              key: 'verified',
              header: 'Verified',
              className: 'text-center',
              render: (u) => <VerifiedMark verified={Boolean(u.emailVerified)} />,
            },
            {
              key: 'orders',
              header: 'Orders',
              className: 'text-right',
              render: (u) => <span className="tabular-nums text-slate-700">{u.orderCount}</span>,
            },
            {
              key: 'spent',
              header: 'Total spent',
              className: 'text-right',
              render: (u) => (
                <span className="whitespace-nowrap tabular-nums text-slate-700">{formatMoney(u.totalSpentCents)}</span>
              ),
            },
            {
              key: 'createdAt',
              header: 'Joined',
              render: (u) => <span className="whitespace-nowrap text-slate-600">{formatDate(u.createdAt)}</span>,
            },
            {
              key: 'lastLoginAt',
              header: 'Last login',
              render: (u) => (
                <span className="whitespace-nowrap text-slate-600">
                  {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'text-right',
              render: (u) => (
                <div className="flex items-center justify-end gap-2">
                  {u.role === 'ADMIN' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPending({ kind: 'role', user: u, next: 'CUSTOMER' })}
                    >
                      Make customer
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPending({ kind: 'role', user: u, next: 'ADMIN' })}
                    >
                      <ShieldCheck className="h-4 w-4" /> Make admin
                    </Button>
                  )}
                  {u.status === 'BLOCKED' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPending({ kind: 'status', user: u, next: 'ACTIVE' })}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Unblock
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setPending({ kind: 'status', user: u, next: 'BLOCKED' })}
                    >
                      <Ban className="h-4 w-4" /> Block
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {detailId && <UserDetailDrawer userId={detailId} onClose={() => setDetailId(null)} />}

      {pending && confirmCopy && (
        <ConfirmDialog
          open
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          danger={confirmCopy.danger}
          loading={working}
          onConfirm={confirmAction}
          onCancel={() => (working ? undefined : setPending(null))}
        />
      )}
    </div>
  );
}

function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: user, isLoading, error } = useApi<AdminUserDetail>(`/admin/users/${userId}`);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="User details" className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">User details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <CenteredSpinner label="Loading details…" />
          ) : error || !user ? (
            <EmptyState
              icon={<UsersIcon className="h-10 w-10" />}
              title="Could not load user"
              description="Please close and try again."
            />
          ) : (
            <div className="space-y-6">
              {/* Identity */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900">{user.name || 'Unnamed'}</p>
                    <p className="truncate text-sm text-slate-500">{user.email}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <RoleBadge role={user.role} />
                    <StatusBadge status={user.status} />
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="text-slate-800">{user.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Email verified</dt>
                    <dd className="flex items-center gap-1 text-slate-800">
                      <VerifiedMark verified={Boolean(user.emailVerified)} />
                      <span>{user.emailVerified ? 'Yes' : 'No'}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Orders</dt>
                    <dd className="text-slate-800">{user.orderCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Total spent</dt>
                    <dd className="text-slate-800">{formatMoney(user.totalSpentCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Joined</dt>
                    <dd className="text-slate-800">{formatDate(user.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Last login</dt>
                    <dd className="text-slate-800">{user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}</dd>
                  </div>
                </dl>
              </div>

              {/* Addresses */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Addresses</h3>
                {user.addresses.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved addresses.</p>
                ) : (
                  <ul className="space-y-2">
                    {user.addresses.map((a) => (
                      <li key={a.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0 text-slate-400" />
                          <span className="font-medium text-slate-800">{a.fullName}</span>
                          <Badge className="bg-slate-100 text-slate-600">{titleCase(a.type)}</Badge>
                          {a.isDefault && <Badge className="bg-indigo-100 text-indigo-800">Default</Badge>}
                        </div>
                        <p className="mt-1 text-slate-600">
                          {a.line1}
                          {a.line2 ? `, ${a.line2}` : ''}, {a.city}
                          {a.state ? `, ${a.state}` : ''} {a.postalCode}, {a.country}
                        </p>
                        {a.phone && <p className="text-slate-500">{a.phone}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Recent orders */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Recent orders</h3>
                {user.orders.length === 0 ? (
                  <p className="text-sm text-slate-500">No orders yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                    {user.orders.map((o) => {
                      const badge = orderStatusBadge(o.status);
                      return (
                        <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{o.orderNumber}</p>
                            <p className="text-xs text-slate-500">{formatDate(o.createdAt)}</p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-3">
                            <Badge className={badge.className}>{badge.label}</Badge>
                            <span className="tabular-nums text-slate-800">{formatMoney(o.totalCents)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
