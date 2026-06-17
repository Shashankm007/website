'use client';

import { create } from 'zustand';
import { api } from './client-api';

interface WishlistItemResp {
  productId?: string;
  product?: { id: string };
}

interface WishlistState {
  ids: string[];
  loaded: boolean;
  /** Load the signed-in user's wishlist product ids. */
  refresh: () => Promise<void>;
  clear: () => void;
  add: (productId: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  toggle: (productId: string) => Promise<void>;
}

/**
 * Shared wishlist membership so hearts across the catalog reflect saved state.
 * Optimistic updates with revert-on-error. The server stays the source of truth.
 */
export const useWishlist = create<WishlistState>((set, get) => ({
  ids: [],
  loaded: false,

  refresh: async () => {
    try {
      const { data } = await api.get<WishlistItemResp[]>('/wishlist');
      const ids = (data ?? [])
        .map((w) => w.productId ?? w.product?.id)
        .filter((x): x is string => Boolean(x));
      set({ ids, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  clear: () => set({ ids: [], loaded: false }),

  add: async (productId) => {
    if (get().ids.includes(productId)) return;
    set((s) => ({ ids: [...s.ids, productId] }));
    try {
      await api.post(`/wishlist/${productId}`);
    } catch (e) {
      set((s) => ({ ids: s.ids.filter((x) => x !== productId) }));
      throw e;
    }
  },

  remove: async (productId) => {
    const had = get().ids.includes(productId);
    set((s) => ({ ids: s.ids.filter((x) => x !== productId) }));
    try {
      await api.del(`/wishlist/${productId}`);
    } catch (e) {
      if (had) set((s) => ({ ids: [...s.ids, productId] }));
      throw e;
    }
  },

  toggle: async (productId) => {
    return get().ids.includes(productId) ? get().remove(productId) : get().add(productId);
  },
}));
