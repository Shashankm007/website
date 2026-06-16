'use client';

import { ApiRequestError, ApiResult, apiRequest, RequestOptions } from './api';

/**
 * Browser API client. Holds the short-lived access token in memory (NOT
 * localStorage — avoids XSS token theft). The refresh token lives in an
 * httpOnly cookie; on a 401 we transparently refresh once and retry.
 */
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = apiRequest<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => {
        accessToken = r.data.accessToken;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function authedRequest<T>(path: string, options: RequestOptions = {}, retry = true): Promise<ApiResult<T>> {
  try {
    return await apiRequest<T>(path, {
      ...options,
      credentials: 'include',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 401 && retry) {
      const fresh = await refreshAccessToken();
      if (fresh) return authedRequest<T>(path, options, false);
    }
    throw e;
  }
}

type Body = unknown;

/** Convenience client used throughout client components. */
export const api = {
  get: <T>(path: string, options?: RequestOptions) => authedRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: Body, options?: RequestOptions) =>
    authedRequest<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: Body, options?: RequestOptions) =>
    authedRequest<T>(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: Body, options?: RequestOptions) =>
    authedRequest<T>(path, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string, options?: RequestOptions) => authedRequest<T>(path, { ...options, method: 'DELETE' }),
  refresh: refreshAccessToken,
};
