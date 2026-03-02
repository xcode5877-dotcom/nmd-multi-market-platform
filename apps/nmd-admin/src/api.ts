const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const TOKEN_KEY = 'nmd-access-token';

let emergencyMode = false;
let emergencyReason = '';

export function setEmergencyHeaders(enabled: boolean, reason: string) {
  emergencyMode = enabled && !!reason.trim();
  emergencyReason = reason.trim();
  if (typeof window !== 'undefined') {
    (window as { __NMD_EMERGENCY_HEADERS__?: Record<string, string> }).__NMD_EMERGENCY_HEADERS__ = emergencyMode ? { 'X-Emergency-Mode': 'true' } : {};
    (window as { __NMD_EMERGENCY_REASON__?: string }).__NMD_EMERGENCY_REASON__ = emergencyMode ? emergencyReason : '';
  }
}

export function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (emergencyMode) h['X-Emergency-Mode'] = 'true';
  return h;
}

function mergeEmergencyMeta(body: string | undefined, method: string): string | undefined {
  if (!emergencyMode || !emergencyReason) return body;
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((method || 'GET').toUpperCase());
  if (!isWrite) return body;
  try {
    const parsed = body ? JSON.parse(body) : {};
    const merged = { ...parsed, _meta: { ...parsed._meta, emergencyReason } };
    return JSON.stringify(merged);
  } catch {
    return body;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';
  const body = mergeEmergencyMeta(init?.body as string | undefined, method);
  const res = await fetch(`${MOCK_API_URL}${path}`, {
    ...init,
    method,
    body,
    headers: { ...apiHeaders(), ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    try {
      const err = await res.json() as { error?: string; code?: string };
      if (err.code === 'EMERGENCY_MODE_REQUIRED') {
        throw new Error('فعّل وضع الطوارئ مع سبب للتعديل');
      }
      if (err.code === 'EMERGENCY_REASON_REQUIRED') {
        throw new Error('السبب مطلوب في وضع الطوارئ');
      }
      throw new Error(err.error ?? `API error: ${res.status}`);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(`API error: ${res.status}`);
    }
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Upload a banner image (multipart). Returns { urls: [fullUrl], relativePath }. */
export async function apiUploadBanner(file: File): Promise<{ urls: string[]; relativePath?: string }> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (emergencyMode) headers['X-Emergency-Mode'] = 'true';
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${MOCK_API_URL}/upload/banner`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

