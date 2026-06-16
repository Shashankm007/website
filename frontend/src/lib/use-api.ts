'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import type { PaginationMeta } from '@/types';
import { api } from './client-api';

/** SWR hook returning just the data payload (authed client + auto-refresh). */
export function useApi<T>(path: string | null, config?: SWRConfiguration) {
  return useSWR<T>(path, async (p: string) => (await api.get<T>(p)).data, config);
}

/** SWR hook for paginated endpoints — returns { data, meta }. */
export function useApiList<T>(path: string | null, config?: SWRConfiguration) {
  return useSWR<{ data: T; meta?: PaginationMeta }>(
    path,
    async (p: string) => {
      const res = await api.get<T>(p);
      return { data: res.data, meta: res.meta };
    },
    config,
  );
}
