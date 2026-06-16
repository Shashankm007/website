'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ChatSendResponse } from '@/types';
import { whatsappLink } from './WhatsAppButton';

type WidgetRole = 'USER' | 'BOT';

interface WidgetMessage {
  role: WidgetRole;
  content: string;
  /** Set on a BOT reply that asked to escalate to a human. */
  needsHuman?: boolean;
}

interface StoredChat {
  conversationId: string | null;
  messages: WidgetMessage[];
}

const STORAGE_KEY = 'hashtag_chat';
const GREETING =
  "Hi! I'm the HashTag assistant. Ask me about products, orders, shipping or custom prints — how can I help?";

function loadStored(): StoredChat {
  if (typeof window === 'undefined') return { conversationId: null, messages: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversationId: null, messages: [] };
    const parsed = JSON.parse(raw) as StoredChat;
    return {
      conversationId: parsed.conversationId ?? null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return { conversationId: null, messages: [] };
  }
}

/**
 * Floating chat launcher (above the WhatsApp button) that opens an in-page
 * support chat backed by POST /chat/message. State persists in localStorage.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const stored = loadStored();
    setConversationId(stored.conversationId);
    setMessages(stored.messages);
    setHydrated(true);
  }, []);

  // Persist whenever conversation state changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    const payload: StoredChat = { conversationId, messages };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [conversationId, messages, hydrated]);

  // Show the greeting the first time the panel opens with no history.
  useEffect(() => {
    if (open && hydrated && messages.length === 0) {
      setMessages([{ role: 'BOT', content: GREETING }]);
    }
  }, [open, hydrated, messages.length]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'USER', content: message }]);
    setSending(true);
    try {
      const { data } = await apiRequest<ChatSendResponse>('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ conversationId, message }),
        headers: { 'Content-Type': 'application/json' },
      });
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: 'BOT', content: data.reply, needsHuman: data.needsHuman },
      ]);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'Something went wrong sending your message.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'BOT',
          content:
            "Sorry, I couldn't reach the server. You can reach us on WhatsApp instead.",
          needsHuman: true,
        },
      ]);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void send();
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-card-hover transition hover:scale-110 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          <MessageCircle className="h-7 w-7" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex max-h-[70vh] w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card-hover">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 bg-brand-600 px-4 py-3 text-white">
            <span className="text-base font-semibold">Ask HashTag 🤖</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 px-4 py-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col',
                  m.role === 'USER' ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-card',
                    m.role === 'USER'
                      ? 'rounded-br-sm bg-brand-600 text-white'
                      : 'rounded-bl-sm bg-slate-100 text-slate-800',
                  )}
                >
                  {m.content}
                </div>
                {m.role === 'BOT' && m.needsHuman && (
                  <a
                    href={whatsappLink('Hi, I need help from a person.')}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#1ebe5d]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat on WhatsApp
                  </a>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-3 shadow-card">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                </div>
              </div>
            )}
          </div>

          {/* Input row */}
          <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your message…"
              aria-label="Message"
              className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || input.trim().length === 0}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
