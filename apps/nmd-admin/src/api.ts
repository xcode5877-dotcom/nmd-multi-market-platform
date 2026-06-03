import type { FeedCampaign, HomeFeedSettings } from './types/feedCampaign';
import type { HomePageBlock } from './types/homePageBlock';
import { normalizeHomePageBlocksList } from './types/homePageBlock';
import {
  firstUploadUrl,
  normalizeFeedCampaignListFromApi,
} from './lib/feedCampaignNormalize';

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

function mergeEmergencyMeta(body: string | undefined, method: string, path: string): string | undefined {
  if (!emergencyMode || !emergencyReason) return body;
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((method || 'GET').toUpperCase());
  if (!isWrite) return body;
  // Feed campaigns, banners, and other array payloads must stay arrays — never wrap as layout.
  if (path.includes('/feed-campaigns') || path.includes('/banners')) {
    return body;
  }
  try {
    const parsed: unknown = body ? JSON.parse(body) : {};
    if (Array.isArray(parsed)) {
      if (path.includes('/layout')) {
        return JSON.stringify({ layout: parsed, _meta: { emergencyReason } });
      }
      return body;
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
  const body = mergeEmergencyMeta(init?.body as string | undefined, method, path);
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
  const fileList = Array.isArray(files) ? files : [];
  if (fileList.length === 0) throw new Error('لم يُحدد ملف للرفع');
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (emergencyMode) headers['X-Emergency-Mode'] = 'true';
  const form = new FormData();
  fileList.forEach((f) => form.append('files', f));
  const url = `${MOCK_API_URL}/upload`;
  logFetchUrl(url, 'POST');
  const res = await fetch(url, { method: 'POST', headers, body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `فشل الرفع: ${res.status}`);
  }
  const json = await res.json();
  const single = firstUploadUrl(json);
  if (single) return { urls: [single] };
  const urls = Array.isArray((json as { urls?: unknown }).urls)
    ? (json as { urls: string[] }).urls.filter(Boolean)
    : [];
  return { urls };
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
    throw new Error(err.error ?? `فشل الرفع: ${res.status}`);
  }
  const json = await res.json();
  const single = firstUploadUrl(json);
  if (single) return { urls: [single], relativePath: (json as { relativePath?: string }).relativePath };
  const urls = Array.isArray((json as { urls?: unknown }).urls)
    ? (json as { urls: string[] }).urls.filter(Boolean)
    : [];
  return { urls, relativePath: (json as { relativePath?: string }).relativePath };
}

/** Upload one image; tries banner then generic upload; normalizes all response shapes. */
export async function apiUploadSingleImage(file: File): Promise<string> {
  let lastError: Error | null = null;
  for (const attempt of ['banner', 'upload'] as const) {
    try {
      const json =
        attempt === 'banner'
          ? await apiUploadBanner(file)
          : await apiUpload([file]);
      const url = firstUploadUrl(json) ?? json.urls?.[0]?.trim() ?? '';
      if (url) {
        console.log('[HOME_BUILDER_UPLOAD]', { url, via: attempt });
        return url;
      }
      lastError = new Error('لم يُرجع الخادم رابط الصورة');
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('فشل رفع الصورة');
    }
  }
  throw lastError ?? new Error('فشل رفع الصورة');
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
  payload:
    | { correctAnswer?: string; correctAnswerIds?: string[] }
    | { finalScoreA: number; finalScoreB: number }
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

// --- Global rewards & activities (platform admin + public catalog) ---
export type GlobalRewardType = 'COUPON' | 'EVENT' | 'PRIZE' | 'TOURNAMENT';

export interface GlobalRewardAdmin {
  id: string;
  titleAr: string;
  titleEn: string;
  description: string;
  imageUrl: string;
  type: GlobalRewardType;
  coinsCost: number;
  stockLimit: number;
  expiryDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  participantCount?: number;
}

/** Super Admin: full list. */
export async function listGlobalRewardsAdmin(): Promise<GlobalRewardAdmin[]> {
  return apiFetch<GlobalRewardAdmin[]>('/admin/rewards');
}

export async function createGlobalReward(body: {
  titleAr: string;
  titleEn: string;
  description?: string;
  imageUrl?: string;
  type: GlobalRewardType;
  coinsCost: number;
  stockLimit: number;
  expiryDate?: string;
  isActive?: boolean;
}): Promise<GlobalRewardAdmin> {
  return apiFetch<GlobalRewardAdmin>('/admin/rewards', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateGlobalReward(
  id: string,
  body: Partial<{
    titleAr: string;
    titleEn: string;
    description: string;
    imageUrl: string;
    type: GlobalRewardType;
    coinsCost: number;
    stockLimit: number;
    expiryDate: string | null;
    isActive: boolean;
  }>
): Promise<GlobalRewardAdmin> {
  return apiFetch<GlobalRewardAdmin>(`/admin/rewards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteGlobalReward(id: string): Promise<void> {
  return apiFetch<void>(`/admin/rewards/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Storefront placeholder: active rewards (GET /rewards, no auth). */
export async function listPublicRewards(): Promise<
  Array<{
    id: string;
    title_ar: string;
    title_en: string;
    description?: string;
    image_url?: string;
    type: string;
    coins_cost: number;
    stock_limit: number;
    expiry_date?: string;
    is_active: boolean;
    created_at: string;
  }>
> {
  const url = `${MOCK_API_URL}/rewards`;
  logFetchUrl(url, 'GET');
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`rewards: ${res.status}`);
  return res.json();
}

export type RewardRedemptionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface RewardRedemptionRow {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  rewardId: string;
  rewardTitleAr: string;
  rewardTitleEn: string;
  type: string;
  coinsSpent: number;
  redeemedAt: string;
  status: RewardRedemptionStatus;
  updatedAt?: string;
}

export async function listRewardRedemptions(rewardId?: string): Promise<RewardRedemptionRow[]> {
  const qs = rewardId ? `?rewardId=${encodeURIComponent(rewardId)}` : '';
  return apiFetch<RewardRedemptionRow[]>(`/admin/reward-redemptions${qs}`);
}

export async function updateRewardRedemptionStatus(id: string, status: RewardRedemptionStatus): Promise<RewardRedemptionRow> {
  return apiFetch<RewardRedemptionRow>(`/admin/reward-redemptions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export interface ExternalOrderAdminRow {
  id: string;
  createdAt?: string | null;
  status?: string | null;
  marketId?: string | null;
  marketName?: string | null;
  courierId?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  manualStoreName?: string | null;
  storeDisplayName?: string | null;
  externalDestination?: string | null;
  deliveryFee?: number;
  isExternal: true;
}

/** Super Admin: global external manual orders report. */
export async function listAdminExternalOrders(): Promise<ExternalOrderAdminRow[]> {
  return apiFetch<ExternalOrderAdminRow[]>('/admin/external-orders');
}

/** Download participants CSV (optional filter by reward). */
export async function downloadRewardRedemptionsCsv(rewardId?: string): Promise<void> {
  const qs = rewardId ? `?rewardId=${encodeURIComponent(rewardId)}` : '';
  const url = `${MOCK_API_URL}/admin/reward-redemptions/export.csv${qs}`;
  logFetchUrl(url, 'GET');
  const res = await fetch(url, { headers: { ...apiHeaders(), Accept: 'text/csv' } });
  if (!res.ok) throw new Error(`CSV export failed: ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = rewardId ? `participants-${rewardId.slice(0, 8)}.csv` : 'reward-participants.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/** GET home feed promo blocks for a market (persisted in market-config.json). */
export async function listMarketFeedCampaigns(marketSlug: string): Promise<FeedCampaign[]> {
  const slug = encodeURIComponent(marketSlug.trim());
  const raw = await apiFetch<unknown>(`/markets/by-slug/${slug}/feed-campaigns?all=1`);
  return normalizeFeedCampaignListFromApi(raw);
}

/** PUT home feed campaigns for a market. */
export async function saveMarketFeedCampaigns(
  marketSlug: string,
  campaigns: FeedCampaign[],
): Promise<FeedCampaign[]> {
  const slug = encodeURIComponent(marketSlug.trim());
  const payloadCount = campaigns.length;
  console.log('[HOME_BUILDER_SAVE]', { payloadCount, marketSlug: marketSlug.trim() });
  const raw = await apiFetch<unknown>(`/markets/by-slug/${slug}/feed-campaigns`, {
    method: 'PUT',
    body: JSON.stringify(campaigns),
  });
  const saved = normalizeFeedCampaignListFromApi(raw);
  console.log('[HOME_BUILDER_SAVE]', { savedCount: saved.length, payloadCount });
  if (!Array.isArray(raw) && saved.length === 0 && payloadCount > 0) {
    throw new Error('لم يتم حفظ الحملات — استجابة غير متوقعة من الخادم (ليست مصفوفة)');
  }
  if (saved.length !== payloadCount) {
    console.warn('[HOME_BUILDER_SAVE] count mismatch', { payloadCount, savedCount: saved.length });
  }
  return saved;
}

export async function getHomeFeedSettings(marketSlug: string): Promise<HomeFeedSettings> {
  const slug = encodeURIComponent(marketSlug.trim());
  return apiFetch<HomeFeedSettings>(`/markets/by-slug/${slug}/home-feed-settings`);
}

export async function saveHomeFeedSettings(
  marketSlug: string,
  settings: HomeFeedSettings,
): Promise<HomeFeedSettings> {
  const slug = encodeURIComponent(marketSlug.trim());
  return apiFetch<HomeFeedSettings>(`/markets/by-slug/${slug}/home-feed-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

/** GET ordered homepage blocks (admin — includes hidden). */
export async function listMarketHomePageBlocks(marketSlug: string): Promise<HomePageBlock[]> {
  const slug = encodeURIComponent(marketSlug.trim());
  const raw = await apiFetch<unknown>(`/markets/by-slug/${slug}/home-page-blocks?all=1`);
  return normalizeHomePageBlocksList(raw);
}

/** PUT ordered homepage blocks — enables visual builder for market. */
export async function saveMarketHomePageBlocks(
  marketSlug: string,
  blocks: HomePageBlock[],
): Promise<HomePageBlock[]> {
  const slug = encodeURIComponent(marketSlug.trim());
  const payload = blocks.map((b, i) => ({ ...b, sortOrder: i }));
  console.log('[HOME_PAGE_BUILDER_SAVE]', { marketSlug: marketSlug.trim(), blockCount: payload.length });
  const raw = await apiFetch<unknown>(`/markets/by-slug/${slug}/home-page-blocks`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const saved = normalizeHomePageBlocksList(raw);
  console.log('[HOME_PAGE_BUILDER_SAVE]', { savedCount: saved.length });
  return saved;
}
