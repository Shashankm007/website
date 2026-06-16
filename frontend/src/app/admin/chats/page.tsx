'use client';

import { useState } from 'react';
import {
  Bot,
  MessageSquare,
  Send,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminChatDetail, AdminChatListItem, ChatRole, ChatStatus } from '@/types';
import { useApi, useApiList } from '@/lib/use-api';
import { ApiRequestError, qs } from '@/lib/api';
import { api } from '@/lib/client-api';
import { cn, formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import { CenteredSpinner, EmptyState } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/admin/PageHeader';

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<ChatStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  HANDLED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-200 text-slate-700',
};

const STATUS_OPTIONS: { value: ChatStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'HANDLED', label: 'Handled' },
  { value: 'CLOSED', label: 'Closed' },
];

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function StatusBadge({ status }: { status: ChatStatus }) {
  return <Badge className={STATUS_BADGE[status]}>{titleCase(status)}</Badge>;
}

function visitorLabel(c: { visitorName?: string | null; user?: { email: string } | null }): string {
  return c.visitorName || c.user?.email || 'Guest';
}

export default function AdminChatsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ChatStatus | ''>('');
  const [needsHuman, setNeedsHuman] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = qs({
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
    needsHuman: needsHuman ? true : undefined,
  });
  const { data, isLoading, mutate: mutateList } = useApiList<AdminChatListItem[]>(`/admin/chats${query}`);

  const chats = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const total = data?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support chat"
        description={
          total ? `${total} conversation${total === 1 ? '' : 's'}` : 'Read logged conversations and handle them'
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-[12rem]">
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as ChatStatus | '');
            }}
          >
            <option value="">All conversations</option>
            <option value="OPEN">Open</option>
            <option value="HANDLED">Handled</option>
            <option value="CLOSED">Closed</option>
          </Select>
        </div>
        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={needsHuman}
            onChange={(e) => {
              setPage(1);
              setNeedsHuman(e.target.checked);
            }}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
          />
          Needs human only
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Conversation list */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="card p-10">
              <CenteredSpinner label="Loading conversations…" />
            </div>
          ) : chats.length === 0 ? (
            <div className="card p-6">
              <EmptyState
                icon={<MessageSquare className="h-10 w-10" />}
                title="No conversations"
                description={
                  status || needsHuman
                    ? 'Try adjusting your filters.'
                    : 'Customer chats will appear here once people start them.'
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {chats.map((c) => {
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'card w-full p-4 text-left transition hover:shadow-card-hover',
                        active && 'ring-2 ring-brand-500',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-medium text-slate-900">{visitorLabel(c)}</p>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          <StatusBadge status={c.status} />
                          {c.needsHuman && (
                            <Badge className="bg-rose-100 text-rose-800">Needs reply</Badge>
                          )}
                        </div>
                      </div>
                      {c.lastMessage && (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                          {c.lastMessage.role === 'USER' ? '' : `${titleCase(c.lastMessage.role)}: `}
                          {c.lastMessage.content}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span>{formatDateTime(c.lastMessageAt)}</span>
                        <span className="tabular-nums">
                          {c._count.messages} message{c._count.messages === 1 ? '' : 's'}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>

        {/* Detail panel */}
        <div>
          {selectedId ? (
            <ChatDetailPanel chatId={selectedId} onChanged={() => mutateList()} />
          ) : (
            <div className="card hidden p-6 lg:block">
              <EmptyState
                icon={<MessageSquare className="h-10 w-10" />}
                title="Select a conversation"
                description="Pick a conversation from the list to read the full thread and reply."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ROLE_META: Record<
  ChatRole,
  { label: string; icon: React.ReactNode; align: 'left' | 'right'; bubble: string }
> = {
  USER: {
    label: 'Visitor',
    icon: <UserIcon className="h-3.5 w-3.5" />,
    align: 'right',
    bubble: 'bg-brand-600 text-white',
  },
  BOT: {
    label: 'Bot',
    icon: <Bot className="h-3.5 w-3.5" />,
    align: 'left',
    bubble: 'bg-slate-100 text-slate-800',
  },
  ADMIN: {
    label: 'Admin',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    align: 'left',
    bubble: 'bg-amber-100 text-amber-900',
  },
};

function ChatDetailPanel({ chatId, onChanged }: { chatId: string; onChanged: () => void }) {
  const { data: chat, isLoading, error, mutate } = useApi<AdminChatDetail>(`/admin/chats/${chatId}`);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  async function changeStatus(next: ChatStatus) {
    setSavingStatus(true);
    try {
      await api.patch(`/admin/chats/${chatId}`, { status: next });
      toast.success(`Marked as ${next.toLowerCase()}`);
      await Promise.all([mutate(), onChanged()]);
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : 'Could not update the conversation';
      toast.error(message);
    } finally {
      setSavingStatus(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const message = reply.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      await api.post(`/admin/chats/${chatId}/reply`, { message });
      toast.success('Reply logged');
      setReply('');
      await Promise.all([mutate(), onChanged()]);
    } catch (err) {
      const m = err instanceof ApiRequestError ? err.message : 'Could not log the reply';
      toast.error(m);
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card p-10">
        <CenteredSpinner label="Loading conversation…" />
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={<MessageSquare className="h-10 w-10" />}
          title="Could not load conversation"
          description="Please pick another conversation or try again."
        />
      </div>
    );
  }

  return (
    <div className="card flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{visitorLabel(chat)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Started {formatDateTime(chat.createdAt)}</span>
            {chat.needsHuman && <Badge className="bg-rose-100 text-rose-800">Needs reply</Badge>}
          </div>
        </div>
        <div className="w-full sm:w-44">
          <Select
            label="Status"
            value={chat.status}
            disabled={savingStatus}
            onChange={(e) => changeStatus(e.target.value as ChatStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 lg:max-h-[55vh]">
        {chat.messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No messages yet.</p>
        ) : (
          chat.messages.map((m) => {
            const meta = ROLE_META[m.role];
            return (
              <div
                key={m.id}
                className={cn('flex flex-col gap-1', meta.align === 'right' ? 'items-end' : 'items-start')}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  {meta.icon}
                  <span>{meta.label}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{formatDateTime(m.createdAt)}</span>
                </div>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                    meta.bubble,
                  )}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply box */}
      <form onSubmit={sendReply} className="space-y-2 border-t border-slate-200 p-4">
        <Textarea
          label="Reply"
          placeholder="Type a reply to log on the record…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="min-h-[72px]"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Replies are logged for the record only — reach out to the customer manually via WhatsApp or email.
          </p>
          <Button type="submit" loading={sending} disabled={!reply.trim()} className="sm:flex-shrink-0">
            <Send className="h-4 w-4" /> Log reply
          </Button>
        </div>
      </form>
    </div>
  );
}
