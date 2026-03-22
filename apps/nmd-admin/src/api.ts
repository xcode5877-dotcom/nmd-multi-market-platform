const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
export const TOKEN_KEY = 'nmd-access-token';

function logFetchUrl(url: string, method: string): void {
  if (import.meta.env?.DEV && typeof console !== 'undefined') {
    console.log('[API] Fetch:', method, url);
  }
}

/** List categories from the central source (GET /categories). Used for tenant category select. */
export async function listCategories(): Promise<Array<{ id: string; title: string; nameAr?: string; icon?: string; sortOrder?: number; legacyCode?: string }>> {
  const url = `${MOCK_API_URL}/categories`;
  logFetchUrl(url, 'GET');
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`Categories: ${res.status}`);
  const raw = await res.json();
  return Array.isArray(raw) ? raw : [];
}

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
  const h: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  };
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
    const parsed: unknown = body ? JSON.parse(body) : {};
    if (Array.isArray(parsed)) {
      return JSON.stringify({ layout: parsed, _meta: { emergencyReason } });
    }
    const obj: Record<string, unknown> =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const existingMeta = obj._meta && typeof obj._meta === 'object' && obj._meta !== null && !Array.isArray(obj._meta) ? (obj._meta as Record<string, unknown>) : {};
    const merged = { ...obj, _meta: { ...existingMeta, emergencyReason } };
    return JSON.stringify(merged);
  } catch {
    return body;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';
  const url = `${MOCK_API_URL}${path}`;
  logFetchUrl(url, method);
  const body = mergeEmergencyMeta(init?.body as string | undefined, method);
  const initHeaders = init?.headers != null && typeof init.headers === 'object' && !Array.isArray(init.headers) && !(init.headers instanceof Headers)
    ? (init.headers as Record<string, string>)
    : {};
  const res = await fetch(url, {
    ...init,
    method,
    body,
    headers: { ...apiHeaders(), ...initHeaders },
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
      const baseMsg = err.error ?? `API error: ${res.status}`;
      const statusHint = res.status === 401 ? ' (غير مصرح — سجّل الدخول)' : res.status === 403 ? ' (ممنوع — صلاحيات غير كافية)' : res.status === 404 ? ' (غير موجود)' : '';
      throw new Error(`${baseMsg}${statusHint}`);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(`API error: ${res.status}`);
    }
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Upload one or more images (multipart, field "files"). Returns { urls }. Used for market image, store logo, etc. */
export async function apiUpload(files: File[]): Promise<{ urls: string[] }> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (emergencyMode) headers['X-Emergency-Mode'] = 'true';
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const url = `${MOCK_API_URL}/upload`;
  logFetchUrl(url, 'POST');
  const res = await fetch(url, { method: 'POST', headers, body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Upload failed: ${res.status}`);
  }
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
  const url = `${MOCK_API_URL}/upload/banner`;
  logFetchUrl(url, 'POST');
  const res = await fetch(url, {
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

// --- Contests (platform admin) ---
export type ContestType = 'QUESTION' | 'PREDICTION';
export interface ContestOption {
  id: string;
  label: string;
}
export interface Contest {
  id: string;
  title: string;
  description?: string | null;
  type: ContestType;
  options: ContestOption[];
  correctAnswer?: string | null;
  isActive: boolean;
  rewardCode?: string | null;
  bannerImageUrl?: string | null;
  teamAName?: string | null;
  teamBName?: string | null;
  isPrediction?: boolean;
  finalScoreA?: number | null;
  finalScoreB?: number | null;
  expiresAt?: string | null;
  createdAt: string;
}

export async function listContests(): Promise<Contest[]> {
  return apiFetch<Contest[]>('/contests');
}

export async function createContest(body: {
  title: string;
  description?: string;
  type: ContestType;
  options?: ContestOption[];
  correctAnswer?: string;
  rewardCode?: string;
  bannerImageUrl?: string;
  expiresAt?: string;
  isPrediction?: boolean;
  teamAName?: string;
  teamBName?: string;
}): Promise<Contest> {
  return apiFetch<Contest>('/contests', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateContest(
  id: string,
  body: Partial<{ title: string; description: string; options: ContestOption[]; correctAnswer: string; isActive: boolean; rewardCode: string; bannerImageUrl: string; expiresAt: string; isPrediction: boolean; teamAName: string; teamBName: string; finalScoreA: number; finalScoreB: number }>
): Promise<Contest> {
  return apiFetch<Contest>(`/contests/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function deleteContest(id: string): Promise<void> {
  return apiFetch<void>(`/contests/${id}`, { method: 'DELETE' });
}

export async function setContestResult(
  id: string,
  payload: { correctAnswer?: string } | { finalScoreA: number; finalScoreB: number }
): Promise<{ correctAnswer: string; winnersCount: number; finalScoreA?: number; finalScoreB?: number }> {
  return apiFetch(`/contests/${id}/result`, { method: 'POST', body: JSON.stringify(payload) });
}

export interface ContestParticipationRow {
  id: string;
  customerId: string;
  customerPhone?: string;
  customerName?: string;
  userAnswer: string;
  scoreA?: number;
  scoreB?: number;
  isWinner: boolean;
  createdAt: string;
}

export async function getContestParticipations(id: string): Promise<{
  contest: { id: string; title: string; type: string; correctAnswer?: string | null; isPrediction?: boolean; finalScoreA?: number; finalScoreB?: number };
  participations: ContestParticipationRow[];
}> {
  return apiFetch(`/contests/${id}/participations`);
}

