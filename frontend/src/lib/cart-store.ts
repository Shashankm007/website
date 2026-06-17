'use client';

import { create } from 'zustand';
import type { CartView } from '@/types';
import { api } from './client-api';

const CART_TOKEN_KEY = 'forge3d_cart_token';

function readToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(CART_TOKEN_KEY) ?? undefined;
}
function writeToken(token?: string) {
  if (typeof window === 'undefined' || !token) return;
  localStorage.setItem(CART_TOKEN_KEY, token);
}
function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(CART_TOKEN_KEY);
}

/** Header carrying the guest cart token (ignored by the API when authenticated). */
function cartHeaders(): Record<string, string> {
  const t = readToken();
  return t ? { 'x-cart-token': t } : {};
}

export interface AddItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  options?: Record<string, string>;
  customText?: string;
  customUploadId?: string;
  modelLink?: string;
}

interface CartState {
  cart: CartView | null;
  loading: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  add: (input: AddItemInput) => Promise<void>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  mergeOnLogin: () => Promise<void>;
}

export const useCart = create<CartState>((set, get) => ({
  cart: null,
  loading: false,
  open: false,
  setOpen: (open) => set({ open }),

  refresh: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get<CartView>('/cart', { headers: cartHeaders() });
      if (data?.token) writeToken(data.token);
      set({ cart: data });
    } catch {
      set({ cart: null });
    } finally {
      set({ loading: false });
    }
  },

  add: async (input) => {
    const { data } = await api.post<CartView>('/cart/items', input, { headers: cartHeaders() });
    if (data?.token) writeToken(data.token);
    set({ cart: data, open: true });
  },

  update: async (itemId, quantity) => {
    const { data } = await api.patch<CartView>(`/cart/items/${itemId}`, { quantity }, { headers: cartHeaders() });
    set({ cart: data });
  },

  remove: async (itemId) => {
    const { data } = await api.del<CartView>(`/cart/items/${itemId}`, { headers: cartHeaders() });
    set({ cart: data });
  },

  clear: async () => {
    await api.del('/cart', { headers: cartHeaders() });
    set({ cart: null });
  },

  // On login, fold the guest cart into the user's cart then drop the guest token.
  mergeOnLogin: async () => {
    const token = readToken();
    if (token) {
      try {
        await api.post('/cart/merge', { guestToken: token });
      } catch {
        /* ignore */
      }
      clearToken();
    }
    await get().refresh();
  },
}));
