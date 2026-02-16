/**
 * Single source of truth for API base URL.
 * Set VITE_API_BASE_URL in .env.local (e.g. http://localhost:5190 for mock-api).
 * In dev, falls back to http://localhost:5190 if env is missing.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv && typeof fromEnv === 'string') return fromEnv.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:5190';
  return '';
}

const TOKEN_KEY = 'courier-access-token';

export function getToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(token: string | null): void {
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
}

function isJsonBody(body: unknown): body is object {
  return typeof body === 'object' && body !== null && !(body instanceof FormData) && !(body instanceof Blob);
}

export type ApiFetchInit = Omit<RequestInit, 'body'> & { body?: unknown };

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const token = getToken();
  const { body, ...rest } = init ?? {};
  let fetchBody: BodyInit | undefined;
  let needsJsonContentType = false;
  if (body !== undefined && body !== null) {
    if (typeof body === 'string') {
      fetchBody = body;
      needsJsonContentType = true;
    } else if (isJsonBody(body)) {
      fetchBody = JSON.stringify(body);
      needsJsonContentType = true;
    } else {
      fetchBody = body as BodyInit;
    }
  }
  const headers: Record<string, string> = {
    ...(rest.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (needsJsonContentType) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    body: fetchBody,
    headers,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string; details?: unknown };
    const e = new Error(err.error ?? `Request failed: ${res.status}`) as Error & { status?: number; code?: string; details?: unknown };
    e.status = res.status;
    e.code = err.code;
    e.details = err.details;
    throw e;
  }
  return res.json();
}
