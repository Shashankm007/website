import type { ApiError, ApiSuccess, PaginationMeta } from '@/types';

/**
 * Base URLs.
 * - Browser code uses NEXT_PUBLIC_API_URL (must be reachable from the user's machine).
 * - Server components/route handlers prefer API_INTERNAL_URL (the in-cluster address)
 *   and fall back to the public URL.
 */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const INTERNAL_API_URL = process.env.API_INTERNAL_URL ?? PUBLIC_API_URL;

export function apiBase(): string {
  return typeof window === 'undefined' ? INTERNAL_API_URL : PUBLIC_API_URL;
}

/** Error thrown for any non-2xx / unsuccessful API response. */
export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface ApiResult<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface RequestOptions extends RequestInit {
  /** Next.js fetch caching (server components). */
  next?: { revalidate?: number; tags?: string[] };
}

/**
 * Low-level request. Prefixes /api/v1, parses the standard envelope, and throws
 * ApiRequestError on failure. Used by both the server helpers and the client.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const url = `${apiBase()}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  // 204 No Content
  if (res.status === 204) return { data: undefined as T };

  let json: ApiSuccess<T> | ApiError;
  try {
    json = await res.json();
  } catch {
    throw new ApiRequestError('INTERNAL_ERROR', `Unexpected non-JSON response (${res.status})`, res.status);
  }

  if (!res.ok || json.success === false) {
    const err = json as ApiError;
    throw new ApiRequestError(
      err.error?.code ?? 'ERROR',
      err.error?.message ?? res.statusText,
      err.error?.statusCode ?? res.status,
      err.error?.details,
    );
  }

  const ok = json as ApiSuccess<T>;
  return { data: ok.data, meta: ok.meta };
}

/**
 * Server-side helpers for public catalog data (no auth). Use inside Server Components.
 * Pass `revalidate` to control ISR caching.
 */
export const serverApi = {
  async get<T>(path: string, revalidate = 60): Promise<ApiResult<T>> {
    return apiRequest<T>(path, { method: 'GET', next: { revalidate } });
  },
  /** Like get() but returns just the data, or null on 404. */
  async getOrNull<T>(path: string, revalidate = 60): Promise<T | null> {
    try {
      const { data } = await this.get<T>(path, revalidate);
      return data;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) return null;
      throw e;
    }
  },
};

/** Build a query string from a record, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
