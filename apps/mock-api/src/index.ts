import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { join, resolve, dirname, basename } from 'path';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'fs';
import sharp from 'sharp';
import type { RequestHandler } from 'express';
import {
  getAuditEvents,
  appendAuditEvent,
  appendDispatchAudit,
  getCampaigns,
  setCampaigns,
  getDeliveryJobs,
  setDeliveryJobs,
  getTemplates,
  getStaff,
  setStaff,
  getGlobalCategories,
  setGlobalCategories,
  getGlobalConfig,
  setGlobalConfig,
  getSupportConfig,
  setSupportConfig,
  getLeads,
  appendLead,
  type RegistryTenant,
  type TenantCatalog,
  type StorefrontHero,
  type StorefrontBanner,
  type DeliveryZoneRecord,
  type Market,
  type User,
  type Courier,
  type DeliveryJob,
  type GlobalCategory,
  type CategoryPolicy,
  getCategoryPolicies,
  setCategoryPolicies,
  loadFromPath,
  invalidateDataCache,
  getData,
  getPillars,
  setPillars,
  getSubCategories,
  setSubCategories,
  type Pillar,
  type SubCategory,
  getSettlementLogs,
  appendSettlementLog,
  type SettlementLogEntry,
  getOptionTemplates,
  addOptionTemplate,
} from './store.js';
import {
  parseAccountExtras,
  mergeExtrasIntoCustomer,
  luhnValid,
  inferCardBrand,
  newAddressId,
  newCardId,
  normalizeNotificationPatch,
} from './customer-account-extras.js';
import {
  getBannersForMarket,
  getLayoutForMarket,
  getFeedCampaignsForMarket,
  getFeedCampaignsForMarketAdmin,
  getFeedCampaignsConfigShape,
  getHomeFeedSettingsForMarket,
  setHomeFeedSettingsForMarket,
  setBannersForMarket,
  setLayoutForMarket,
  setFeedCampaignsForMarket,
  getModifierIconsForMarket,
  getModifierIconsForMarketAdmin,
  setModifierIconsForMarket,
  getHomePageBlocksForMarket,
  getHomePageBlocksForMarketAdmin,
  logHomePageBlocksGet,
  setHomePageBlocksForMarket,
  validateHomePageBlocks,
  normalizeMarketSlugForConfig,
  type MarketBanner,
  type MarketSection,
  type MarketFeedCampaign,
  type HomeFeedSettings,
  type HomePageBlock,
} from './market-config.js';
import {
  getOperationalStatus,
  canManageOrderItems,
  getOrderManagementBlockReason,
  isOrderManagementEditable,
  normalizeAndValidateMeasurementForWrite,
  isInvalidMeasurementConfigError,
  type ModifierIcon,
} from '@nmd/core';
import { getDispatchQueue } from './delivery-engine.js';
import { isCourierListTerminalStatus, syncAdminDeliveredOrder } from './delivery-status-sync.js';
import {
  addBonus,
  approveExpense,
  computeDriverEarningsPreview,
  computeEarningsSummary,
  endShift,
  extractOrderEarningsBase,
  EXPENSE_CATEGORIES,
  getActiveShift,
  getOrCreatePayrollConfig,
  getRecentAutoClosedShiftWarning,
  getTenantDriverCommissionOverrides,
  parseDateRange,
  postCourierEarningsIfEligible,
  rejectExpense,
  setTenantDriverCommissionOverride,
  startShift,
  updatePayrollConfig,
} from './courier-payroll.js';
import {
  computeOutstandingBalance,
  computePayrollHistoryTotals,
  computePlatformPayrollSummary,
  createPayrollSettlement,
  getDriverPayrollStatement,
  getPayrollSettlementById,
  listPayrollSettlements,
  previewPayrollSettlement,
} from './courier-payroll-settlement.js';
import { buildSettlementPayslipHtml } from './courier-payroll-payslip.js';
import {
  aggregateDriverCollections,
  computeCollectionsDashboard,
  computeDriverCollectionAmount,
  createDriverCollectionSettlement,
  enrichOrderWithDriverCollection,
  getDriverSettlementMode,
  listActiveShiftStarts,
  listCollectionSettlements,
  orderMatchesCollectionFilters,
  isDriverCollectionCountable,
} from './driver-collections.js';
import { createRepos } from './repos/index.js';
import type { OrderRecord } from './repos/types.js';
import { prisma } from './db.js';
import { createOtp, verifyOtp } from './customer-auth.js';
import { isGooglePlayReviewPhone } from './google-play-review.js';
import {
  customerPhoneLookupVariants,
  normalizeCustomerPhoneKey,
  normalizeInternationalPhoneDigits,
} from './utils/phone.js';
import { triggerStatusNotification, notifyMerchantNewOrder, notifyCustomerOrderStatusPush, sendFCMToCustomerToken, sendFCMToToken } from './services/NotificationService.js';
import {
  applySubmissionGateMetadata,
  assertGroupEditable,
  getTenantOrderSubmissionDelaySeconds,
  isAwaitingMerchantSubmission,
  isCancelledBeforeMerchantSubmission,
  isOrderVisibleToMerchant,
  normalizeOrderSubmissionDelaySeconds,
  orderSubmissionPoller,
  orderSubmissionScheduler,
  readGateFields,
  submitOrderGroupToMerchant,
  submitOrderToMerchant,
  summarizeEditingWindow,
  type MerchantSubmitDeps,
} from './order-submission-gate.js';
import { sendWhatsAppNotification } from './services/CouponService.js';
import { getVapidPublicKey, saveSubscription, saveAdminSubscription, getSubscriptionsByTenant, sendPushNotification } from './push-subscriptions.js';
import { sendFCMToToken as sendAdminFCMToToken, sendFCMMulticast, isFCMConfigured } from './firebase-admin.js';
import { awardLoyaltyCoinsIfNeeded, INITIAL_COINS } from './loyalty-coins.js';
import { findCustomerCoinRow } from './customer-coin-wallet.js';
import {
  canonicalCustomerPhone,
  ensureCustomerInPrisma as resolvePrismaCustomerId,
  pickCustomerByCanonicalPhone,
} from './customer-identity.js';
import {
  loadHypConfig,
  loadHypConfigDiagnostics,
  buildDoDealPaymentPageXml,
  requestHypHostedPage,
  parseDoDealResponse,
  normalizeHypQuery,
  verifyHypResponseMac,
} from './hyp-service.js';
import { sendOtpViaExternalWhatsAppApi } from './services/externalWhatsAppOtp.js';
import { aggregateMerchantStats, dateRangeForMerchant, orderPaymentChannel, type MerchantTimeRange } from './merchant-stats.js';
import {
  computePlatformFee,
  computeCheckoutPricingQuote,
  computeMarketplaceDisplayPricing,
  displayMarketplaceUnitPrice,
  enrichProductDisplayPricing,
  isPlatformFeeEnabled,
  roundMoney,
  ceilShekel,
  buildPlatformFeePayment,
  enrichLegacyPaymentWithSnapshot,
  type CheckoutPricingStoreInput,
  type MarketplacePricingContext,
} from './platform-fee.js';
import {
  postOrderSettlement,
  computeSettlementReport,
  recordManualSettlementPayment,
  dateRangePreset,
  isSettlementEligibleStatus,
} from './settlement.js';
import {
  computeStoreProfitBreakdown,
  computeStoreProfitReport,
  parseStoreProfitDateRange,
} from './store-profit-report.js';
import {
  BUSINESS_TIMEZONE,
  aggregateDriverCollections,
  buildFinancialSummary,
  computeAreaReport,
  computeOrderSourceReport,
  computePaymentMethodReport,
  computeShopReport,
  computeTimeseries,
  detectFinancialAnomalies,
  formatBusinessDay,
  parseFinancialReportRange,
  toCsv,
  type FinancialReportFilters,
} from './financial-reports.js';
import {
  rejectCustomerOnAdminRoutes,
  assertCatalogTenantAccess,
  sanitizeCatalogPayloadForRole,
  applyTenantPatchRoleFilter,
} from './admin-auth.js';
import { logExpressRoutes } from './utils/list-express-routes.js';
import { whatsAppFetch } from './utils/whatsapp-http.js';
import { SUPPORTED_DELIVERY_TOWNS, isSupportedDeliveryTown } from './delivery-towns.js';
import { registerContestDrawRoutes } from './contest-draws.js';
import { refreshOrderTotalsAfterItemEdit } from './order-totals.js';
import { executeManageOrderTransaction, listOrderModifications } from './order-manage-tx.js';
import {
  enrichOrdersWithCustomerTrust,
  registerCustomerTrustRoutes,
} from './customer-trust/routes.js';
import { getTrustListMeta } from './customer-trust/service.js';

const PORT = Number(process.env.PORT ?? 5190);
/** Dev-only: `GET /customer/orders` skips auth and returns fixed samples. Default off so live DB + JWT path is used. Set `MOCK_CUSTOMER_ORDERS_STATIC_BYPASS=1` to enable. */
const MOCK_CUSTOMER_ORDERS_STATIC_BYPASS =
  String(process.env.MOCK_CUSTOMER_ORDERS_STATIC_BYPASS ?? '0') === '1';
const repos = createRepos();
console.log('[ORDER_PROTECTION] Order append-only guards active (deleteMany + setAll blocked)');

const merchantSubmitDeps: MerchantSubmitDeps = {
  notifyMerchantNewOrder: (order, tenant) =>
    notifyMerchantNewOrder(
      order as {
        id?: string;
        customerName?: string;
        customerPhone?: string;
        items?: unknown[];
        total?: number;
        notes?: string;
        delivery?: unknown;
        fulfillmentType?: string;
        tenantId?: string;
        [key: string]: unknown;
      },
      tenant
    ),
  sendFCMToTenantForNewOrder: (tenantId, order) =>
    sendFCMToTenantForNewOrder(tenantId, order as { id?: string; total?: number; tenantId?: string; [key: string]: unknown }),
  emitOrderAvailableForMarket: (marketId, orderId, couriers) =>
    emitOrderAvailableForMarket(marketId, orderId, couriers),
};
orderSubmissionScheduler.configure(repos, merchantSubmitDeps);

/** When WhatsApp + SMS all fail, log OTP for manual login (debug). Uses DATA volume in Docker. */
function logOtpManualFallback(phoneDigits: string, code: string, reason: string) {
  const payload = { phone: phoneDigits, code, reason, at: new Date().toISOString() };
  console.warn('[OTP-FALLBACK] All delivery channels failed — use this code to sign in manually:', payload);
  const dataDir = dirname(process.env.DATA_FILE || join(process.cwd(), 'data', 'data.json'));
  const logPath = process.env.OTP_FALLBACK_LOG_PATH || join(dataDir, 'otp-debug.log');
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `${payload.at}\t${phoneDigits}\t${code}\t${reason}\n`, 'utf8');
    console.warn('[OTP-FALLBACK] Appended one line to', logPath);
  } catch (e) {
    console.warn('[OTP-FALLBACK] Could not write log file:', e instanceof Error ? e.message : e);
  }
}

const isStorageDb = () => (process.env.STORAGE_DRIVER ?? '').toLowerCase() === 'db';

/** Resolve customer FCM token: from latest CustomerFCMToken (DB, newest by createdAt) or customer.fcmToken (JSON). */
async function getCustomerFcmToken(customerId: string): Promise<string | null> {
  const tokens = await getCustomerFcmTokens(customerId);
  return tokens[0] ?? null;
}

/** All registered FCM tokens for a customer (newest first). */
async function getCustomerFcmTokens(customerId: string): Promise<string[]> {
  if (isStorageDb()) {
    const rows = await prisma.customerFCMToken.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { token: true },
    });
    return [...new Set(rows.map((r) => r.token.trim()).filter(Boolean))];
  }
  const customers = await repos.customers.findAll();
  const c = customers.find((x) => x.id === customerId);
  const tok = (c as { fcmToken?: string | null } | undefined)?.fcmToken;
  return tok?.trim() ? [tok.trim()] : [];
}

/** Resolve customer by id or any common phone format (054…, 972…, +972…). */
async function findCustomerByPhoneOrId(input: {
  customerId?: string;
  phone?: string;
}): Promise<{ id: string; phone: string } | null> {
  const customers = await repos.customers.findAll();
  const rawPhone = (input.phone ?? '').trim();
  if (rawPhone) {
    const key = normalizePhoneForMatch(rawPhone);
    if (!key) return null;
    return customers.find((c) => normalizePhoneForMatch(c.phone) === key) ?? null;
  }
  const rawId = (input.customerId ?? '').trim();
  if (!rawId) return null;
  const byId = customers.find((c) => c.id === rawId);
  if (byId) return { id: byId.id, phone: byId.phone };
  const digits = rawId.replace(/\D/g, '');
  if (digits.length >= 9) {
    const key = normalizePhoneForMatch(rawId);
    if (key) return customers.find((c) => normalizePhoneForMatch(c.phone) === key) ?? null;
  }
  return null;
}

/** All customer FCM tokens for broadcast. */
async function getAllCustomerFcmTokens(): Promise<string[]> {
  if (isStorageDb()) {
    const rows = await prisma.customerFCMToken.findMany({ select: { token: true } });
    return rows.map((r) => r.token);
  }
  const customers = await repos.customers.findAll();
  return customers.map((c) => (c as { fcmToken?: string | null }).fcmToken).filter(Boolean) as string[];
}

/** Customer-facing notification: look up latest FCM token for customerId and send simple title/body. */
async function sendFCMNotification(
  customerId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const token = await getCustomerFcmToken(customerId);
    if (!token) {
      console.log('[FCM] sendFCMNotification: no token for customerId', customerId);
      return;
    }
    const payload = { title, body, data };
    if (data?.type === 'coins_earned') {
      console.log('[PUSH_COINS]', {
        customerId,
        amount: data?.coinsEarned ?? data?.amount ?? null,
        payload,
      });
    }
    await sendAdminFCMToToken(token, payload, 'customer_notifications');
  } catch (e) {
    console.warn('[FCM] sendFCMNotification failed for customerId', customerId, e);
  }
}

async function runLoyaltyAwardForOrderAtIndex(
  orders: Record<string, unknown>[],
  idx: number,
  prevStatus: string | undefined
): Promise<void> {
  try {
    const o = orders[idx] as Record<string, unknown>;
    const orderId = o?.id != null ? String(o.id) : '—';
    const newStatus = String(o?.status ?? '');
    const awardedRaw = (o as { loyaltyCoinsAwarded?: unknown }).loyaltyCoinsAwarded;
    const awardedBefore =
      awardedRaw === undefined || awardedRaw === null ? '—' : String(awardedRaw);
    console.log(
      `[loyalty-debug] Order: ${orderId}, Old: ${prevStatus ?? '—'}, New: ${newStatus || '—'}, AwardedBefore: ${awardedBefore}`
    );
    const tenants = await repos.tenants.findAll();
    const result = await awardLoyaltyCoinsIfNeeded({
      prisma,
      repos,
      orders,
      orderIndex: idx,
      tenants,
    });
    if (result?.customerId && result.coinsEarned > 0) {
      await sendFCMNotification(
        result.customerId,
        'رصيد NMD',
        `حصلت على ${result.coinsEarned} عملة من اكتمال طلبك!`,
        {
          type: 'coins_earned',
          amount: String(result.coinsEarned),
          coinsEarned: String(result.coinsEarned),
          newBalance: String(result.newBalance ?? ''),
        }
      );
    }
  } catch (e) {
    console.warn('[loyalty] award failed', e);
  }
}

/** Base URL for Hyp redirect callbacks (must be reachable by the user’s browser). E.g. https://nmd.marketing/api */
function getPublicApiBaseUrl(): string {
  const u = process.env.PUBLIC_API_BASE_URL?.trim() || process.env.MOCK_API_PUBLIC_URL?.trim() || process.env.PUBLIC_URL?.trim();
  if (u) return u.replace(/\/$/, '');
  return `http://127.0.0.1:${PORT}`;
}

/**
 * After successful card capture: mark group orders COMPLETED, payment CAPTURED, run loyalty once per line.
 * (Demo behaviour: immediate completion so customer coins / UI can celebrate.)
 */
async function completeHypPaymentForGroup(
  orderGroupId: string,
  opts?: { providerRef?: string; demoMode?: boolean; cardLast4?: string; cardBrand?: string }
): Promise<void> {
  const all = (await repos.orders.findAll()) as Record<string, unknown>[];
  const now = new Date().toISOString();
  const prevById = new Map<string, string>();
  const paidGroupOrders: OrderRecord[] = [];
  for (let i = 0; i < all.length; i++) {
    const o = all[i];
    if (String((o as { orderGroupId?: string }).orderGroupId ?? '') !== orderGroupId) continue;
    const oid = String(o.id ?? '');
    prevById.set(oid, String(o.status ?? ''));
    const pay = ((o as { payment?: Record<string, unknown> }).payment ?? {}) as Record<string, unknown>;
    const updated = {
      ...o,
      status: 'PAID',
      paymentMethod: 'CARD',
      paymentStatus: 'CAPTURED',
      payment: {
        ...pay,
        method: 'CARD',
        status: 'CAPTURED',
        provider: 'HYP',
        providerRef: opts?.providerRef || (pay.providerRef as string | undefined) || '',
        cardLast4: opts?.cardLast4 || (pay.cardLast4 as string | undefined) || '',
        cardBrand: opts?.cardBrand || (pay.cardBrand as string | undefined) || '',
        paidAt: now,
        demoMode: Boolean(opts?.demoMode),
      },
    };
    all[i] = updated;
    paidGroupOrders.push(updated as OrderRecord);
  }
  if (prevById.size === 0) {
    console.warn('[Hyp] completeHypPaymentForGroup: no orders for group', orderGroupId);
    return;
  }
  await repos.orders.updateMany(paidGroupOrders);
  for (const orderId of prevById.keys()) {
    await prisma.payment.upsert({
      where: { orderId },
      create: {
        id: `pay-${orderId}`,
        orderId,
        method: 'CARD',
        status: 'CAPTURED',
        amount: Number((all.find((o) => String(o.id ?? '') === orderId) as { total?: number } | undefined)?.total ?? 0) || 0,
        currency: 'ILS',
        provider: 'HYP',
        providerRef: opts?.providerRef ?? null,
        ...(opts?.cardLast4 ? { providerRef: `${opts.providerRef ?? ''}${opts.providerRef ? '|' : ''}last4:${opts.cardLast4}` } : {}),
        createdAt: now,
        updatedAt: now,
      },
      update: {
        method: 'CARD',
        status: 'CAPTURED',
        provider: 'HYP',
        providerRef: opts?.providerRef ?? undefined,
        updatedAt: now,
      },
    });
  }
  const orders2 = (await repos.orders.findAll()) as Record<string, unknown>[];
  const loyaltyUpdated: OrderRecord[] = [];
  for (let i = 0; i < orders2.length; i++) {
    const o = orders2[i];
    const id = String(o.id ?? '');
    const prev = prevById.get(id);
    if (prev === undefined) continue;
    await runLoyaltyAwardForOrderAtIndex(orders2, i, prev);
    loyaltyUpdated.push(orders2[i] as OrderRecord);
  }
  if (loyaltyUpdated.length > 0) await repos.orders.updateMany(loyaltyUpdated);

  // After card capture: open submission gate (delay 0 submits now; delay>0 poller/send-now).
  try {
    await submitOrderGroupToMerchant(orderGroupId, repos, merchantSubmitDeps);
  } catch (e) {
    console.error('[Hyp] post-payment merchant submit failed:', e);
  }
}

/**
 * Send FCM "new order" notification to every device token linked to users who own/manage the given tenant.
 * Called immediately after saving a new order so the merchant tablet/phone gets the system notification and alarm.
 */
async function collectTenantOwnerFcmTokens(tenantId: string): Promise<string[]> {
  const tenantRow = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { marketId: true } });
  const marketId = tenantRow?.marketId ?? null;
  const ownerUsers = await prisma.user.findMany({
    where: {
      OR: [{ tenantId }, ...(marketId ? [{ role: 'MARKET_ADMIN', marketId }] : [])],
    },
    select: { id: true, fcmToken: true },
  });
  const ownerIds = [...new Set(ownerUsers.map((u) => u.id))];
  const tokensFromTable = await prisma.userFCMToken.findMany({
    where: { userId: { in: ownerIds } },
    select: { token: true },
  });
  const legacyTokens = ownerUsers.map((u) => u.fcmToken).filter(Boolean) as string[];
  return [...new Set([...tokensFromTable.map((r) => r.token), ...legacyTokens])];
}

async function sendFCMToTenantForNewOrder(
  tenantId: string,
  order: { id?: string; total?: number; tenantId?: string; [key: string]: unknown }
): Promise<void> {
  try {
    const amountStr =
      order.total != null && !Number.isNaN(Number(order.total)) ? `₪${Number(order.total).toFixed(2)}` : '—';
    const fcmTitle = 'طلب جديد وصل! 🔔';
    const fcmBody = `طلب جديد بقيمة ${amountStr}! اضغط لمراجعة التفاصيل وتحضير الطلب.`;
    const orderId = order.id ?? '';
    console.log('[FCM] sendFCMToTenantForNewOrder: tenant', tenantId, 'orderId', orderId);
    const allTokens = await collectTenantOwnerFcmTokens(tenantId);
    console.log('[FCM] Total FCM tokens to send:', allTokens.length);
    if (allTokens.length === 0) {
      console.warn('[FCM] No FCM tokens for store owners. Merchant must log in from the app and allow notifications.');
      return;
    }
    for (const token of allTokens) {
      const result = await sendFCMToToken(token, { title: fcmTitle, body: fcmBody, data: { orderId, type: 'new_order' } });
      if (result.success) console.log('[FCM] Sent to token', token.slice(0, 20) + '...');
      else console.error('[FCM] Send failed:', result.error, 'token:', token.slice(0, 20) + '...');
    }
  } catch (e) {
    console.error('[FCM] sendFCMToTenantForNewOrder failed:', e);
  }
}

/** Lightweight Super Admin edit notify — no full audit snapshot. */
async function sendFCMToTenantForOrderUpdated(
  tenantId: string,
  payload: {
    orderId: string;
    revision?: number;
    totalBefore?: number;
    totalAfter?: number;
    orderGroupId?: string;
  }
): Promise<void> {
  try {
    const allTokens = await collectTenantOwnerFcmTokens(tenantId);
    if (allTokens.length === 0) return;
    const fcmTitle = 'تم تعديل الطلب بواسطة الإدارة';
    const fcmBody =
      payload.totalAfter != null
        ? `الإجمالي الجديد ₪${Number(payload.totalAfter).toFixed(2)} — حدّث تفاصيل الطلب.`
        : 'حدّث تفاصيل الطلب لعرض التغييرات.';
    const data: Record<string, string> = {
      type: 'order_updated',
      orderId: payload.orderId,
      revision: String(payload.revision ?? ''),
      totalBefore: payload.totalBefore != null ? String(payload.totalBefore) : '',
      totalAfter: payload.totalAfter != null ? String(payload.totalAfter) : '',
      modifiedAt: new Date().toISOString(),
    };
    if (payload.orderGroupId) data.orderGroupId = payload.orderGroupId;
    for (const token of allTokens) {
      await sendFCMToToken(token, { title: fcmTitle, body: fcmBody, data });
    }
  } catch (e) {
    console.error('[FCM] sendFCMToTenantForOrderUpdated failed:', e);
  }
}

/** Wrap async route handlers so errors are forwarded to Express error handler. */
function wrapAsync(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'nmd-dev-secret-2026';
const API_KEY = String(process.env.API_KEY ?? '').trim();
/** Server-to-server (WhatsApp bot, internal jobs). Same env as POST /internal/orders/:id/status. */
const INTERNAL_API_SECRET = String(process.env.INTERNAL_API_SECRET ?? process.env.WA_INTERNAL_SECRET ?? '').trim();
console.log('[MockAPI] JWT_SECRET loaded:', JWT_SECRET ? `${JWT_SECRET.slice(0, 8)}...` : 'MISSING (using default)');
const app = express();

const DABBURIYYA_MARKET_ID = 'market-dabburiyya';
const IKSAL_MARKET_ID = 'market-iksal';
const ROOT_ADMIN_ID = 'user-root-admin';

/** Rich market rows from data.json (tenantIds, stores) are not persisted on Market in PostgreSQL — merge from DATA_FILE / repo data.json so listings match seeded JSON. */
type JsonMarketOverlay = { id?: string; slug?: string; tenantIds?: string[]; stores?: { id?: string }[] };

let dataFilePayloadCache: { path: string; mtimeMs: number; payload: { markets: JsonMarketOverlay[]; tenants: { id?: string; marketId?: string }[] } } | null = null;

function dataFilePathCandidates(): string[] {
  const list = [
    process.env.SEED_JSON_PATH,
    // Prefer monorepo root data.json in dev (often richer than apps/mock-api/data.json or an empty Docker stub).
    join(process.cwd(), '..', '..', 'data', 'data.json'),
    process.env.DATA_FILE,
    join(process.cwd(), 'data', 'data.json'),
    join(process.cwd(), 'data.json'),
  ].filter((p): p is string => Boolean(p));
  const seen = new Set<string>();
  return list.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

function parseDataFilePayload(): { markets: JsonMarketOverlay[]; tenants: { id?: string; marketId?: string }[] } | null {
  for (const p of dataFilePathCandidates()) {
    try {
      if (!existsSync(p)) continue;
      const st = statSync(p);
      if (dataFilePayloadCache && dataFilePayloadCache.path === p && dataFilePayloadCache.mtimeMs === st.mtimeMs) {
        return dataFilePayloadCache.payload;
      }
      const raw = readFileSync(p, 'utf-8');
      if (!raw.trim()) continue;
      const data = JSON.parse(raw) as { markets?: JsonMarketOverlay[]; tenants?: { id?: string; marketId?: string }[] };
      const markets = Array.isArray(data.markets) ? data.markets : [];
      const tenants = Array.isArray(data.tenants) ? data.tenants : [];
      // Skip Docker entrypoint stub `{}` so a richer file later in the list (e.g. repo data/data.json in dev) can load.
      if (markets.length === 0 && tenants.length === 0) continue;
      const payload = { markets, tenants };
      dataFilePayloadCache = { path: p, mtimeMs: st.mtimeMs, payload };
      return payload;
    } catch {
      /* try next path */
    }
  }
  return null;
}

function findJsonMarketOverlay(
  markets: JsonMarketOverlay[],
  resolvedMarketId: string,
  marketSlug: string | undefined,
  paramMarketId: string
): JsonMarketOverlay | undefined {
  const slugNorm = paramMarketId.toLowerCase().replace(/^market-/, '');
  return markets.find((om) => {
    if (om.id && om.id === resolvedMarketId) return true;
    if (marketSlug && om.slug === marketSlug) return true;
    if (om.slug && (om.slug === paramMarketId || om.slug === slugNorm)) return true;
    if (om.slug === 'dabburiyya' && (paramMarketId === 'daburiyya' || paramMarketId === 'dabburiyya')) return true;
    return false;
  });
}

function tenantIdsFromJsonMarketOverlay(om: JsonMarketOverlay | undefined): Set<string> {
  const ids = new Set<string>();
  if (!om) return ids;
  for (const id of om.tenantIds ?? []) {
    if (typeof id === 'string' && id) ids.add(id);
  }
  for (const s of om.stores ?? []) {
    const id = s?.id;
    if (typeof id === 'string' && id) ids.add(id);
  }
  return ids;
}

function tenantIdsFromJsonTenantsArray(
  tenantRows: { id?: string; marketId?: string }[],
  resolvedMarketId: string,
  marketSlug: string | undefined
): Set<string> {
  const ids = new Set<string>();
  for (const t of tenantRows) {
    const mid = (t.marketId ?? '').trim();
    const id = t.id;
    if (!id || !mid) continue;
    if (mid === resolvedMarketId) ids.add(id);
    if (marketSlug && mid === marketSlug) ids.add(id);
    if (
      marketSlug === 'dabburiyya' &&
      (mid === 'daburiyya' || mid === 'dabburiyya' || mid === 'market-daburiyya' || mid === 'market-dabburiyya')
    ) {
      ids.add(id);
    }
  }
  return ids;
}

function buildMarketTenantIdSet(
  marketRow: { tenantIds?: string[] },
  resolvedMarketId: string,
  marketSlug: string | undefined,
  paramMarketId: string
): Set<string> {
  const set = new Set<string>(marketRow.tenantIds ?? []);
  const payload = parseDataFilePayload();
  if (!payload) return set;
  const om = findJsonMarketOverlay(payload.markets, resolvedMarketId, marketSlug, paramMarketId);
  for (const id of tenantIdsFromJsonMarketOverlay(om)) set.add(id);
  for (const id of tenantIdsFromJsonTenantsArray(payload.tenants, resolvedMarketId, marketSlug)) set.add(id);
  return set;
}

/**
 * Canonical keys for matching `tenant.marketId` against a market: DB id (UUID or market-*), slug param,
 * and known typos (e.g. daburiyya ↔ dabburiyya).
 */
function buildMarketKeyAliasSet(resolvedMarketId: string, marketSlug: string | undefined, paramMarketId: string): Set<string> {
  const aliases = new Set<string>();
  const add = (v: string | undefined | null) => {
    const x = (v ?? '').trim();
    if (x) aliases.add(x);
  };
  add(resolvedMarketId);
  add(paramMarketId);
  add(marketSlug);
  const paramLower = paramMarketId.toLowerCase();
  add(paramLower);
  add(paramLower.replace(/^market-/, ''));
  const slug = (marketSlug ?? '').trim().toLowerCase();
  const rid = resolvedMarketId.toLowerCase();
  if (slug) {
    add(marketSlug);
    add(slug);
  }
  if (
    slug === 'dabburiyya' ||
    paramLower === 'dabburiyya' ||
    paramLower === 'daburiyya' ||
    rid.includes('dabburiyya') ||
    rid.includes('daburiyya')
  ) {
    add('dabburiyya');
    add('daburiyya');
    add('market-dabburiyya');
    add('market-daburiyya');
    add(DABBURIYYA_MARKET_ID);
  }
  if (slug === 'iksal' || paramLower === 'iksal' || rid.includes('iksal')) {
    add('iksal');
    add('market-iksal');
    add(IKSAL_MARKET_ID);
  }
  return aliases;
}

function tenantMarketIdMatchesAlias(mid: string, aliases: Set<string>): boolean {
  if (aliases.has(mid)) return true;
  const lower = mid.toLowerCase();
  for (const a of aliases) {
    if (!a) continue;
    if (lower === a.toLowerCase()) return true;
  }
  return false;
}

function tenantMatchesMarketMembership(
  t: { id: string; marketId?: string },
  resolvedMarketId: string,
  paramMarketId: string,
  marketSlug: string | undefined,
  marketTenantIds: Set<string>
): boolean {
  if (marketTenantIds.has(t.id)) return true;
  const mid = (t.marketId ?? '').trim();
  if (!mid) return false;
  const aliases = buildMarketKeyAliasSet(resolvedMarketId, marketSlug, paramMarketId);
  return tenantMarketIdMatchesAlias(mid, aliases);
}

/** ROOT_ADMIN and SUPER_ADMIN both have platform-wide access (e.g. delivery settings, emergency mode). */
function isPlatformAdmin(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN';
}

/** Grant coins only via platform admin JWT, API_KEY, or INTERNAL_API_SECRET — not customer sessions. */
function authorizeCoinAddRequest(req: express.Request): 'platform_admin' | 'service' | null {
  const user = req.user as { role?: string } | undefined;
  if (user && isPlatformAdmin(user.role)) return 'platform_admin';
  if (API_KEY && String(req.get('x-api-key') ?? '').trim() === API_KEY) return 'service';
  if (INTERNAL_API_SECRET && String(req.headers['x-internal-secret'] ?? '').trim() === INTERNAL_API_SECRET) {
    return 'service';
  }
  return null;
}

const BUFFALO28_TENANT_ID = '78463821-ccb7-48af-841b-84a18c42abb6';
const OBR_TENANT_ID = '3f801fb9-f6f9-4e81-b3a2-f8954498cdac';
const TOP_MARKET_TENANT_ID = '60904bcc-970a-45e3-8669-8015ee2afe64';
const FALLBACK_CUSTOMER_PHONE = '972546111668';
const FALLBACK_CUSTOMER_NAME = 'Rand';

async function seedUsersIfNeeded(): Promise<void> {
  const users = await repos.users.findAll();
  const seeds: User[] = [
    { id: ROOT_ADMIN_ID, email: 'root@nmd.com', role: 'ROOT_ADMIN', password: '123456' },
    { id: 'user-dab-admin', email: 'dab@nmd.com', role: 'MARKET_ADMIN', marketId: DABBURIYYA_MARKET_ID, password: '123456' },
    { id: 'user-iks-admin', email: 'iks@nmd.com', role: 'MARKET_ADMIN', marketId: IKSAL_MARKET_ID, password: '123456' },
    { id: 'user-buffalo-admin', email: 'buffalo@admin.com', role: 'TENANT_ADMIN', tenantId: BUFFALO28_TENANT_ID, password: '123456' },
    { id: 'user-tenant-ms-brands', email: 'ms-brands@nmd.com', role: 'TENANT_ADMIN', tenantId: '5b35539f-90e1-49cc-8c32-8d26cdce20f2', password: 'ms-brands@2026' },
    { id: 'user-tenant-obr', email: 'obr@nmd.com', role: 'TENANT_ADMIN', tenantId: OBR_TENANT_ID, password: 'obr@2026' },
    { id: 'user-tenant-top-market', email: 'top-market@nmd.com', role: 'TENANT_ADMIN', tenantId: TOP_MARKET_TENANT_ID, password: 'top-market@2026' },
    { id: 'user-tenant-lawyer-falan', email: 'lawyer@nmd.com', role: 'TENANT_ADMIN', tenantId: 'a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d', password: '123456' },
    { id: 'user-courier-dab-1', email: 'ahmed@courier.nmd.com', role: 'COURIER', marketId: DABBURIYYA_MARKET_ID, courierId: 'courier-50971b77-4811-49e8-825b-78bd84041782', password: '123456' },
    { id: 'user-courier-iksal-1', email: 'courier@iksal.nmd.com', role: 'COURIER', marketId: IKSAL_MARKET_ID, courierId: 'courier-iksal-001', password: '123456' },
  ];
  if (users.length === 0) {
    await repos.users.setAll(seeds);
    return;
  }
  // Migrate: ensure seed users exist with passwords
  let changed = false;
  const next = [...users];
  for (const seed of seeds) {
    const idx = next.findIndex((u) => u.email?.toLowerCase() === seed.email.toLowerCase() || u.id === seed.id);
    if (idx >= 0) {
      if (!next[idx].password) {
        next[idx] = { ...next[idx], ...seed };
        changed = true;
      }
    } else {
      next.push(seed);
      changed = true;
    }
  }
  if (changed) await repos.users.setAll(next);
}

async function seedMarketsIfNeeded(): Promise<void> {
  const markets = await repos.markets.findAll();
  if (markets.length > 0) return;
  const newMarkets: Market[] = [
    { id: DABBURIYYA_MARKET_ID, name: 'سوق دبورية الرقمي', slug: 'dabburiyya', isActive: true, sortOrder: 0 },
    { id: IKSAL_MARKET_ID, name: 'سوق إكسال الرقمي', slug: 'iksal', isActive: true, sortOrder: 1 },
  ];
  await repos.markets.setAll(newMarkets);
}

/** Set default marketId for tenants that have none (from market.stores or market.tenantIds). Default enabled/isListedInMarket. Persist so data.json is correct. Does not delete any users or orders (Global Identity / phone OTP preserved).
 *  SAFEGUARD: This function must NEVER remove or filter out tenants from the tenants array. Only add/update fields. Tenant deletion is only allowed via explicit DELETE /tenants/:id. */
async function seedTenantMarketIdsIfNeeded(): Promise<void> {
  const markets = (await repos.markets.findAll()) as { id: string; slug?: string; stores?: { id: string }[]; tenantIds?: string[] }[];
  const tenants = await repos.tenants.findAll();
  const payload = parseDataFilePayload();
  let changed = false;
  for (const t of tenants) {
    if (!(t as { marketId?: string }).marketId && t.id) {
      for (const m of markets) {
        const ids = new Set<string>();
        for (const x of m.tenantIds ?? []) ids.add(x);
        for (const s of m.stores ?? []) ids.add(s.id);
        if (payload) {
          const om = findJsonMarketOverlay(payload.markets, m.id, m.slug, m.slug ?? '');
          for (const x of tenantIdsFromJsonMarketOverlay(om)) ids.add(x);
          for (const x of tenantIdsFromJsonTenantsArray(payload.tenants, m.id, m.slug)) ids.add(x);
        }
        if (ids.has(t.id)) {
          (t as { marketId?: string }).marketId = m.id;
          changed = true;
          break;
        }
      }
    }
    if (t.enabled === undefined) {
      (t as { enabled?: boolean }).enabled = true;
      changed = true;
    }
    if ((t as { isListedInMarket?: boolean }).isListedInMarket === undefined) {
      (t as { isListedInMarket?: boolean }).isListedInMarket = true;
      changed = true;
    }
    const op = (t as { operationalStatus?: string }).operationalStatus;
    if (op !== 'open' && op !== 'closed' && op !== 'busy') {
      (t as { operationalStatus?: string }).operationalStatus = 'open';
      changed = true;
    }
  }
  if (changed) await repos.tenants.setAll(tenants);
}

/** No seed orders: start with empty orders. Do not push any hardcoded order when DB is empty. */
async function seedOrdersIfNeeded(): Promise<void> {
  /* intentionally no-op: orders start empty */
}

async function seedDeliveryZonesIfNeeded(): Promise<void> {
  const tenants = await repos.tenants.findAll();
  for (const t of tenants) {
    const existing = await repos.deliveryZones.getByTenant(t.id);
    if (existing.length > 0) continue;
    const zones: DeliveryZoneRecord[] = [
      { id: `dz-${t.id}-1`, tenantId: t.id, name: 'دبورية', fee: 15, isActive: true, sortOrder: 0 },
      { id: `dz-${t.id}-2`, tenantId: t.id, name: 'الشبلي / أم الغنم', fee: 25, isActive: true, sortOrder: 1 },
      { id: `dz-${t.id}-3`, tenantId: t.id, name: 'القرى الزعبية', fee: 40, isActive: true, sortOrder: 2 },
      { id: `dz-${t.id}-4`, tenantId: t.id, name: 'إكسال', fee: 35, isActive: true, sortOrder: 3 },
    ];
    await repos.deliveryZones.setAll(t.id, zones);
  }
}

/**
 * Ensure one demo customer + merchant profile exist so newly-authenticated phone users
 * always have visible data immediately (coins/profile/stats).
 */
async function seedDemoProfilesIfNeeded(): Promise<void> {
  const customers = await repos.customers.findAll();
  const normalized = normalizePhoneForCoupon(FALLBACK_CUSTOMER_PHONE) ?? FALLBACK_CUSTOMER_PHONE;
  const existingCustomer = pickCustomerByCanonicalPhone(customers, FALLBACK_CUSTOMER_PHONE);
  if (!existingCustomer) {
    await repos.customers.setAll([
      ...customers,
      {
        id: `customer-demo-${normalized}`,
        phone: normalized,
        name: FALLBACK_CUSTOMER_NAME,
        email: 'rand@nmd.customer',
        city: 'Iksal',
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  const users = await repos.users.findAll();
  const demoMerchantEmail = `${normalized}@merchant.nmd.com`;
  const hasMerchant = users.some((u) => u.email?.toLowerCase() === demoMerchantEmail.toLowerCase());
  if (!hasMerchant) {
    await repos.users.setAll([
      ...users,
      {
        id: `user-merchant-${normalized}`,
        email: demoMerchantEmail,
        role: 'TENANT_ADMIN',
        tenantId: BUFFALO28_TENANT_ID,
        password: '123456',
      },
    ]);
  }

  // DB mode: prime a visible coins balance for immediate UI confirmation.
  try {
    await prisma.customerCoin.upsert({
      where: { customerPhone: normalized },
      update: {},
      create: {
        customerPhone: normalized,
        balance: INITIAL_COINS,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch {
    // Ignore in non-DB storage or if prisma table is unavailable.
  }
}

// Persistent uploads: use UPLOADS_DIR env, or ./data/uploads so uploads survive rebuilds when data/ is a volume.
// API serves at /uploads/* (no /api prefix); Nginx strips /api and proxies /api/uploads/ → mock-api:5190/uploads/.
const UPLOADS_DIR = (() => {
  const envDir = process.env.UPLOADS_DIR;
  if (envDir) return resolve(envDir);
  // Default: data/uploads (create so uploads persist across builds; mount ./data in Docker).
  const dataUploads = join(process.cwd(), 'data', 'uploads');
  if (!existsSync(dataUploads)) mkdirSync(dataUploads, { recursive: true });
  return resolve(dataUploads);
})();
const UPLOADS_BANNERS_DIR = join(UPLOADS_DIR, 'banners');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
if (!existsSync(UPLOADS_BANNERS_DIR)) mkdirSync(UPLOADS_BANNERS_DIR, { recursive: true });
console.log('[mock-api] UPLOADS_DIR (static /uploads):', UPLOADS_DIR, 'exists:', existsSync(UPLOADS_DIR));

/** Allowed image extensions only (no Arabic or special chars in filename = safe URLs). */
const SAFE_IMAGE_EXT = /^(jpg|jpeg|png|webp|gif)$/i;
function safeImageExt(originalName: string): string {
  const ext = (originalName.match(/\.([^.]+)$/)?.[1] ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  return SAFE_IMAGE_EXT.test(ext) ? ext : 'jpg';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = safeImageExt(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

const BANNER_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_BANNER_MIMES = ['image/webp', 'image/jpeg', 'image/jpg', 'image/png'];
const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_BANNERS_DIR),
  filename: (_req, file, cb) => {
    const ext = safeImageExt(file.originalname).replace('jpeg', 'jpg');
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    cb(null, name);
  },
});
const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: BANNER_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_BANNER_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Banner: only WebP, JPG, PNG allowed'));
  },
});

const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    cb(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Emergency-Mode'],
  exposedHeaders: ['Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/** Force JSON content type for gateway /api requests (defensive for mobile clients). */
app.use((req, res, next) => {
  const original = req.originalUrl || '';
  const path = req.path || '';
  if (original.startsWith('/api/') || path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

/** Ensure all JSON responses declare UTF-8 so Arabic and other non-ASCII render correctly (no ?????). */
app.use((_req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function (body: unknown) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return origJson(body);
  };
  next();
});

/** WebP quality for all new uploads (lightweight standard). */
const UPLOAD_WEBP_QUALITY = 75;

/**
 * Convert a newly uploaded image to WebP (quality 75), max 1920px. Replaces the file and returns
 * the new filename (.webp) for use in URLs; if conversion fails, returns the original filename.
 */
async function compressNewUploadToWebP(filePath: string): Promise<string> {
  const ext = (filePath.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return basename(filePath);
  try {
    const dir = dirname(filePath);
    const base = basename(filePath, ext ? `.${ext}` : '');
    const webpPath = join(dir, `${base}.webp`);
    await sharp(filePath)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: UPLOAD_WEBP_QUALITY })
      .toFile(webpPath);
    if (webpPath !== filePath) unlinkSync(filePath);
    return basename(webpPath);
  } catch (err) {
    console.warn('[Upload] WebP convert failed (file left as-is):', err instanceof Error ? err.message : err);
    return basename(filePath);
  }
}

// Serve /uploads with maximum compression-friendly headers: long cache, immutable for versioned filenames
const UPLOADS_CACHE = 'public, max-age=31536000, immutable';
const UPLOADS_ROOT = resolve(UPLOADS_DIR);
/** Prefer these subdirs when a bare filename is requested (e.g. /uploads/x.webp → /uploads/banners/x.webp). */
const UPLOAD_FALLBACK_SUBDIRS = ['banners', 'tenants', 'markets', 'merchants'] as const;

function isSafeUploadPath(abs: string): boolean {
  return abs.startsWith(UPLOADS_ROOT) && !abs.slice(UPLOADS_ROOT.length).includes('..');
}

/**
 * If rel is a single path segment (file at "root" of /uploads) but missing, try banners/ tenants/ etc.
 * Also case-insensitive match on basename within each tried directory.
 */
function findUploadFileForRequest(rel: string): string | null {
  const normalized = rel.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..')) return null;
  const direct = resolve(join(UPLOADS_DIR, normalized));
  if (!isSafeUploadPath(direct)) return null;
  if (existsSync(direct) && statSync(direct).isFile()) return direct;

  const dir = dirname(direct);
  const base = basename(direct);
  if (existsSync(dir)) {
    const lower = base.toLowerCase();
    const found = readdirSync(dir).find((f) => f.toLowerCase() === lower);
    if (found) {
      const target = join(dir, found);
      if (statSync(target).isFile()) return target;
    }
  }

  // Bare filename: /uploads/foo.webp not found → try uploads/banners/foo.webp, uploads/tenants/foo.webp, …
  if (!normalized.includes('/')) {
    const lower = normalized.toLowerCase();
    for (const sub of UPLOAD_FALLBACK_SUBDIRS) {
      const candidate = resolve(join(UPLOADS_DIR, sub, normalized));
      if (!isSafeUploadPath(candidate)) continue;
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
      const subDir = join(UPLOADS_DIR, sub);
      if (!existsSync(subDir)) continue;
      const hit = readdirSync(subDir).find((f) => f.toLowerCase() === lower);
      if (hit) {
        const p = join(subDir, hit);
        if (statSync(p).isFile()) return p;
      }
    }
    // Any other first-level subdirectory under UPLOADS_DIR
    if (existsSync(UPLOADS_DIR)) {
      for (const ent of readdirSync(UPLOADS_DIR, { withFileTypes: true })) {
        if (!ent.isDirectory() || UPLOAD_FALLBACK_SUBDIRS.includes(ent.name as (typeof UPLOAD_FALLBACK_SUBDIRS)[number])) continue;
        const candidate = resolve(join(UPLOADS_DIR, ent.name, normalized));
        if (!isSafeUploadPath(candidate)) continue;
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
        const subDir = join(UPLOADS_DIR, ent.name);
        const hit = readdirSync(subDir).find((f) => f.toLowerCase() === lower);
        if (hit) {
          const p = join(subDir, hit);
          if (statSync(p).isFile()) return p;
        }
      }
    }
  }
  return null;
}

app.use('/uploads', cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }), (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const rel = (req.path.replace(/^\/uploads\/?/, '') || '').replace(/^\/+/, '');
  if (!rel) return next();
  const resolved = findUploadFileForRequest(rel);
  if (resolved) {
    res.setHeader('Cache-Control', UPLOADS_CACHE);
    res.sendFile(resolved, { maxAge: 31536000 }, (err) => { if (err) next(); });
    return;
  }
  next();
}, express.static(UPLOADS_DIR, { index: false, setHeaders: (res) => res.setHeader('Cache-Control', UPLOADS_CACHE) }));

app.use((req, res, next) => {
  console.log(`INCOMING REQUEST: ${req.method} ${req.url}`);
  next();
});

/** Map multer errors to clear JSON messages for clients */
function uploadErrorMessage(err: Error & { code?: string }): string {
  if (err?.code === 'LIMIT_FILE_SIZE') return 'File too large';
  if (err?.code === 'LIMIT_UNEXPECTED_FILE') return 'Unexpected file field';
  return err?.message ?? 'Upload failed';
}

/** Parse multipart for POST /upload and POST /upload/banner BEFORE auth */
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/upload/banner') {
    return bannerUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: uploadErrorMessage(err) });
      next();
    });
  }
  if (req.method === 'POST' && req.path === '/upload') {
    return upload.array('files', 20)(req, res, (err) => {
      if (err) return res.status(400).json({ error: uploadErrorMessage(err) });
      next();
    });
  }
  next();
});

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Public routes: no auth required. Storefront guests can access these without JWT. */
const PUBLIC_ROUTES: { method: string; path: RegExp }[] = [
  { method: 'GET', path: /^\/$/ },
  { method: 'POST', path: /^\/auth\/login$/ },
  { method: 'POST', path: /^\/auth\/verify-otp$/ },
  { method: 'GET', path: /^\/health$/ },
  { method: 'GET', path: /^\/app-config$/ },
  { method: 'GET', path: /^\/config\/support$/ },
  { method: 'POST', path: /^\/analytics\/support$/ },
  { method: 'GET', path: /^\/storefront\/tenants$/ },
  { method: 'GET', path: /^\/markets$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/banners$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/layout$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/feed-campaigns$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/modifier-icons$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/home-page-blocks$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/home-feed-settings$/ },
  { method: 'GET', path: /^\/markets\/[^/]+\/tenants$/ },
  { method: 'GET', path: /^\/tenants\/by-slug\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/by-id\/[^/]+$/ },
  { method: 'GET', path: /^\/catalog\/[^/]+$/ },
  { method: 'POST', path: /^\/orders$/ },
  { method: 'POST', path: /^\/customer\/pricing\/quote$/ },
  { method: 'POST', path: /^\/customer\/pricing\/line$/ },
  { method: 'POST', path: /^\/customer\/pricing\/cart$/ },
  { method: 'GET', path: /^\/customer\/auth\/check-phone$/ },
  { method: 'POST', path: /^\/customer\/auth\/start$/ },
  { method: 'POST', path: /^\/customer\/auth\/verify$/ },
  { method: 'GET', path: /^\/campaigns$/ },
  { method: 'GET', path: /^\/delivery\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/[^/]+\/delivery-zones$/ },
  { method: 'GET', path: /^\/public\/orders\/[^/]+$/ },
  { method: 'GET', path: /^\/public\/delivery-towns$/ },
  { method: 'GET', path: /^\/global-categories$/ },
  { method: 'GET', path: /^\/categories$/ },
  { method: 'GET', path: /^\/pillars$/ },
  { method: 'GET', path: /^\/sub-categories$/ },
  { method: 'POST', path: /^\/leads$/ },
  { method: 'GET', path: /^\/merchant\/dashboard$/ },
  { method: 'GET', path: /^\/merchant\/leads$/ },
  { method: 'POST', path: /^\/internal\/orders\/[^/]+\/status$/ },
  { method: 'GET', path: /^\/customer\/push-public-key$/ },
  { method: 'GET', path: /^\/merchant\/push-public-key$/ },
  { method: 'GET', path: /^\/data$/ },
  { method: 'GET', path: /^\/contest\/active$/ },
  { method: 'GET', path: /^\/lucky-wheel\/prizes$/ },
  { method: 'GET', path: /^\/rewards$/ },
  { method: 'GET', path: /^\/config\/payment-methods$/ },
  /** Hyp hosted payment return (browser redirect from CreditGuard). */
  { method: 'GET', path: /^\/payments\/hyp\/return$/ },
  /** Mock-api–served Hyp HTML (WebView cannot send Bearer on redirects; must be public). */
  { method: 'GET', path: /^\/payments\/hyp\/hosted\/[^/]+$/ },
  { method: 'GET', path: /^\/payments\/hyp\/demo$/ },
  /** Hyp server-to-server webhook (optional; configure HYP_WEBHOOK_SECRET). */
  { method: 'POST', path: /^\/payments\/hyp\/webhook$/ },
];

function isPublicRoute(method: string, path: string): boolean {
  if (MOCK_CUSTOMER_ORDERS_STATIC_BYPASS && method === 'GET' && path === '/customer/orders') return true;
  return PUBLIC_ROUTES.some((r) => r.method === method && r.path.test(path));
}

/** Parse JWT from query.token (highest), Authorization header, or req.body.access_token. Set req.user or req.customer */
app.use(async (req, _res, next) => {
  const token = (req.query.token as string) || (req.headers.authorization?.split(' ')[1]) || (req.body?.access_token);
  const isUpload = req.method === 'POST' && req.path === '/upload';
  if (isUpload) {
    console.log('[DEBUG-AUTH] Header:', req.headers.authorization, 'Query:', req.query.token, 'Body:', req.body?.access_token);
    const source = token ? (req.query.token ? 'query' : req.headers.authorization ? 'header' : 'body') : 'MISSING';
    console.log('[Auth] POST /upload - token from:', source, token ? `${token.slice(0, 20)}...` : '');
    if (!token) console.log('[Auth] Incoming Headers (full):', req.headers);
  }
  req.user = undefined;
  (req as express.Request & { customer?: { id: string; phone: string } }).customer = undefined;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role?: string };
      if (decoded.role === 'CUSTOMER') {
        const customers = await repos.customers.findAll();
        const customer = customers.find((c) => c.id === decoded.sub);
        if (customer) (req as express.Request & { customer?: { id: string; phone: string } }).customer = { id: customer.id, phone: customer.phone };
      } else {
        const users = await repos.users.findAll();
        const user = users.find((u) => u.id === decoded.sub);
        if (user) {
          req.user = { ...user, password: undefined };
          if (isUpload) console.log('[Auth] req.user set from DB:', user.id, user.role);
        } else if (decoded.role && ['ROOT_ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN', 'MARKET_ADMIN'].includes(decoded.role)) {
          req.user = { id: decoded.sub, email: `${decoded.sub}@jwt`, role: decoded.role, tenantId: (decoded as { tenantId?: string }).tenantId, marketId: (decoded as { marketId?: string }).marketId } as User;
          if (isUpload) console.log('[Auth] req.user set from JWT fallback (user not in DB):', decoded.sub, decoded.role);
        } else if (isUpload) {
          console.log('[Auth] User not found for sub:', decoded.sub, 'role:', decoded.role, '- users:', users.map((u) => u.id));
        }
      }
    } catch (err) {
      console.log('[Auth] JWT verify failed:', err instanceof Error ? err.message : err, isUpload ? '(POST /upload)' : '');
    }
  }
  (req as express.Request & { emergencyMode?: boolean; emergencyReason?: string }).emergencyMode =
    String(req.headers['x-emergency-mode'] ?? '').toLowerCase() === 'true';
  (req as express.Request & { emergencyMode?: boolean; emergencyReason?: string }).emergencyReason =
    (req.body as { _meta?: { emergencyReason?: string } })?._meta?.emergencyReason ?? '';
  next();
});

/** Dev/debug: test FCM — no auth. Public URLs: POST /api/internal/test-fcm or POST /api/orders/test-fcm. Body: { "userId": "<uuid>" } or { "tenantId": "<uuid>" }. */
async function handleTestFcm(req: express.Request, res: express.Response): Promise<void> {
  console.log('--- TEST FCM TRIGGERED ---');
  const body = req.body as { userId?: string; tenantId?: string };
  const userIdRaw = body?.userId != null && typeof body.userId === 'string' ? body.userId.trim() : null;
  const tenantIdRaw = body?.tenantId != null && typeof body.tenantId === 'string' ? body.tenantId.trim() : null;

  let ownerIds: string[];
  let label: string;

  if (tenantIdRaw) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantIdRaw }, select: { name: true, marketId: true } });
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found', tenantId: tenantIdRaw });
      return;
    }
    const marketId = tenant.marketId ?? null;
    const users = await prisma.user.findMany({
      where: { OR: [{ tenantId: tenantIdRaw }, ...(marketId ? [{ role: 'MARKET_ADMIN', marketId }] : [])] },
      select: { id: true },
    });
    ownerIds = [...new Set(users.map((u) => u.id))];
    label = `tenant ${tenantIdRaw} (${(tenant as { name?: string }).name ?? '?'})`;
  } else if (userIdRaw) {
    const user = await prisma.user.findUnique({ where: { id: userIdRaw }, select: { id: true } });
    if (!user) {
      res.status(404).json({ error: 'User not found', userId: userIdRaw });
      return;
    }
    ownerIds = [userIdRaw];
    label = `user ${userIdRaw}`;
  } else {
    res.status(400).json({
      error: 'userId or tenantId required in body',
      example: '{"userId":"bb20b202-8060-48e6-bb9f-dab5f7de84a1"} or {"tenantId":"<tenant-uuid>"}',
    });
    return;
  }

  const tokensFromTable = await prisma.userFCMToken.findMany({
    where: { userId: { in: ownerIds } },
    select: { token: true },
  });
  const legacyUsers = await prisma.user.findMany({
    where: { id: { in: ownerIds }, fcmToken: { not: null } },
    select: { fcmToken: true },
  });
  const legacyTokens = (legacyUsers.map((u) => u.fcmToken).filter(Boolean) as string[]) ?? [];
  const allTokens = [...new Set([...tokensFromTable.map((r) => r.token), ...legacyTokens])];

  console.log('[FCM] Test send for', label, 'ownerIds:', ownerIds.length, 'tokens:', allTokens.length);
  if (allTokens.length === 0) {
    console.warn('[FCM] No FCM tokens for', label);
    res.json({ ok: false, error: 'No FCM tokens for this ' + (tenantIdRaw ? 'tenant' : 'user'), ownerIds, tokens: 0 });
    return;
  }

  const results: { token: string; success: boolean; error?: string }[] = [];
  for (const token of allTokens) {
    const result = await sendFCMToToken(token, {
      title: 'اختبار تنبيه 🔔',
      body: 'Test FCM from mock-api (internal/test-fcm)',
      data: { type: 'test' },
    });
    results.push({ token: token.slice(0, 24) + '...', success: result.success, error: result.error });
    if (result.success) console.log('[FCM] Test sent successfully to', token.slice(0, 20) + '...');
    else console.error('[FCM] Test send failed:', result.error, 'token:', token.slice(0, 20) + '...');
  }
  res.json({ ok: true, label, ownerIds, sent: results.filter((r) => r.success).length, results });
}
app.post('/internal/test-fcm', wrapAsync(handleTestFcm));
app.post('/orders/test-fcm', wrapAsync(handleTestFcm));

/** For GET /courier/events only: accept token via ?token= (EventSource cannot set headers) */
app.use(async (req, res, next) => {
  if (req.method !== 'GET' || req.path !== '/courier/events') return next();
  if (req.user) return next();
  const token = req.query.token as string | undefined;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    const users = await repos.users.findAll();
    const user = users.find((u) => u.id === decoded.sub);
    if (user) req.user = { ...user, password: undefined };
  } catch {
    /* leave req.user undefined -> require-auth will 401 */
  }
  next();
});

/** Require auth for non-public routes. GET /tenants, /markets, /catalog, /campaigns, /delivery, /public are allowed without token.
 *  Customer JWT (role CUSTOMER) sets req.customer; admin JWT sets req.user. /contest/me and /contest/participate require req.customer. */
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads')) return next();
  if (req.method === 'GET' && (req.path === '/payments/hyp/demo' || req.path.startsWith('/payments/hyp/hosted/'))) {
    return next();
  }
  if (
    req.path === '/customer/auth/otp-gateway-health' ||
    req.path === '/api/internal/whatsapp/reset' ||
    req.path === '/internal/whatsapp/reset'
  ) {
    return next();
  }
  if (req.method === 'POST' && (req.path === '/internal/test-fcm' || req.path === '/orders/test-fcm')) return next();
  if (isPublicRoute(req.method, req.path)) return next();
  if (req.path.startsWith('/customer/') && !req.path.startsWith('/customer/auth/')) {
    if (!(req as express.Request & { customer?: unknown }).customer) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  }
  if (req.user) return next();
  if ((req as express.Request & { customer?: unknown }).customer) return next();
  if (req.method === 'POST' && (req.path === '/upload' || req.path === '/upload/banner')) {
    const hasAuth = !!req.get('Authorization');
    console.log('[Auth] 401 on POST', req.path, '- token', hasAuth ? 'present but invalid or user not found' : 'MISSING');
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

/** Customer sessions must not call admin APIs (catalog write, orders admin, settlement, etc.). */
app.use(rejectCustomerOnAdminRoutes);

// --- Auth (admin: email/password or OTP backdoor for Root) ---
/** Traditional admin login. Required for ROOT_ADMIN / Global Categories. Also accepts OTP backdoor: phone=999, code=1234 → root@nmd.com. */
function buildAdminAuthPayload(user: User, token: string) {
  const fallbackNameFromEmail = user.email ? user.email.split('@')[0] : '';
  const safeName = fallbackNameFromEmail.trim() || 'Rand';
  return {
    token,
    accessToken: token,
    user: {
      id: user.id,
      name: safeName,
      email: user.email,
      role: user.role,
      marketId: user.marketId,
      tenantId: user.tenantId,
      courierId: user.courierId,
      mustChangePassword: user.mustChangePassword ?? false,
    },
  };
}

app.post('/auth/login', async (req, res) => {
  const body = req.body as { email?: string; password?: string; phone?: string; code?: string };
  const users = (await repos.users.findAll());

  let user: (typeof users)[0] | undefined;

  if (body.phone != null && body.code != null) {
    const phone = String(body.phone).replace(/\D/g, '');
    const code = String(body.code).trim();
    if (phone === '999' && code === '1234') {
      user = users.find((u) => isPlatformAdmin(u.role) && u.email?.toLowerCase() === 'root@nmd.com');
      if (!user) user = users.find((u) => isPlatformAdmin(u.role));
    }
  }

  if (!user && body.email != null && body.password != null) {
    const email = String(body.email).trim();
    const password = body.password;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    // Absolute admin control: courier credentials are controlled from Courier model.
    if (user.role === 'COURIER' && user.courierId) {
      const courier = (await repos.couriers.findAll()).find((c) => c.id === user!.courierId);
      const courierPassword = courier?.password ?? user.password;
      if (!courierPassword || courierPassword !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    } else if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
  }

  if (!user) {
    if (body.phone != null && body.code != null) return res.status(401).json({ error: 'Invalid OTP backdoor (use phone=999, code=1234 for Root)' });
    return res.status(400).json({ error: 'email and password required' });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, tenantId: user.tenantId, marketId: user.marketId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json(buildAdminAuthPayload(user, token));
});

app.get('/auth/login', (_req, res) => {
  res.set('Allow', 'POST');
  res.status(405).json({ error: 'Method Not Allowed. Use POST with { email, password } or { phone, code } (backdoor: 999 / 1234 for Root).' });
});

// --- App Auth (native merchant app): dedicated path, does not touch /customer/auth (web OTP flow) ---
/** Native app login: email + password only. Returns same JWT shape as /auth/login. Use for NMD-Native-App; keeps web customer OTP flow separate. */
app.post('/app/auth/login', wrapAsync(async (req, res) => {
  const body = req.body as { email?: string; password?: string };
  const email = body.email != null ? String(body.email).trim() : '';
  const password = body.password;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const users = await repos.users.findAll();
  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign(
    { sub: user.id, role: user.role, tenantId: user.tenantId, marketId: user.marketId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json(buildAdminAuthPayload(user, token));
}));

app.get('/auth/me', wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const u = req.user as { id: string; email: string; role: string; marketId?: string; tenantId?: string; courierId?: string; mustChangePassword?: boolean };
  console.log('[Auth] GET /auth/me userId=', u.id, 'role=', u.role, 'tenantId=', u.tenantId ?? '(none)');
  let tenantSlug: string | undefined;
  if (u.tenantId) {
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === u.tenantId);
    tenantSlug = (t as { slug?: string })?.slug;
  }
  res.json({
    id: u.id,
    email: u.email,
    role: u.role,
    marketId: u.marketId,
    tenantId: u.tenantId,
    tenantSlug: tenantSlug ?? undefined,
    courierId: u.courierId,
    mustChangePassword: u.mustChangePassword ?? false,
  });
}));

/** Register FCM token for the current user (Global Identity: token is linked to userId regardless of store). Call after login from native app. Does not modify user.tenantId or any other user fields. */
const FCM_TOKENS_PER_USER_LIMIT = 10;
app.put('/users/me/fcm-token', wrapAsync(async (req, res) => {
  const raw = (req.body as { fcmToken?: string })?.fcmToken;
  const hasAuth = !!req.user;
  const authHeaderPresent = !!req.get('Authorization');
  console.log('[FCM] PUT /users/me/fcm-token received', 'body.fcmToken:', raw != null ? (typeof raw === 'string' ? raw.slice(0, 32) + '...' : '(not a string)') : '(missing)', 'Authorization header:', authHeaderPresent ? 'present' : 'MISSING', 'req.user:', hasAuth ? (req.user as { id: string }).id : 'none');
  if (!req.user) {
    console.warn('[FCM] PUT /users/me/fcm-token 401 Unauthorized (missing or invalid Bearer token)');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (raw != null && typeof raw !== 'string') return res.status(400).json({ error: 'fcmToken must be a string' });
  const token = raw && raw.trim() ? raw.trim() : null;
  const userId = (req.user as { id: string }).id;
  console.log('[FCM] Saving token for user ID:', userId);
  console.log('[FCM] Token [' + (token ? token.slice(0, 24) + '...' : 'clear') + '] received for User [' + userId + ']');
  const userWithTenant = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });
  const tenantId = userWithTenant?.tenantId ?? null;
  const tenantName =
    tenantId != null
      ? (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }))?.name ?? tenantId
      : null;
  console.log('--- SAVING FCM TOKEN FOR USER:', userId, 'tenantId:', tenantId, 'tenantName:', tenantName ?? '—', token ? `token: ${token.slice(0, 24)}...` : '(clear)');
  if (token) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { fcmToken: token } });
      const existing = await tx.userFCMToken.findUnique({ where: { token } });
      if (existing) {
        if (existing.userId !== userId) await tx.userFCMToken.update({ where: { token }, data: { userId } });
      } else {
        await tx.userFCMToken.create({ data: { userId, token } });
      }
      const count = await tx.userFCMToken.count({ where: { userId } });
      if (count > FCM_TOKENS_PER_USER_LIMIT) {
        const oldest = await tx.userFCMToken.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          take: count - FCM_TOKENS_PER_USER_LIMIT,
        });
        await tx.userFCMToken.deleteMany({ where: { id: { in: oldest.map((r) => r.id) } } });
      }
    });
    console.log('[FCM] Saved token to both User.fcmToken and UserFCMToken for user ID:', userId);
  } else {
    await prisma.user.update({ where: { id: userId }, data: { fcmToken: null } });
    await prisma.userFCMToken.deleteMany({ where: { userId } });
  }
  res.json({ ok: true });
}));

// --- Customer OTP auth: unified signup/login (name + phone for new). No POST /auth/register — admin stays on POST /auth/login. ---
app.get('/customer/auth/check-phone', async (req, res) => {
  const phone = req.query.phone as string | undefined;
  if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' });
  const key = normalizePhoneForMatch(phone);
  if (!key || key.length < 9) return res.status(400).json({ error: 'Invalid phone' });
  const customers = await repos.customers.findAll();
  const exists = customers.some((c) => normalizePhoneForMatch(c.phone) === key);
  res.json({ exists });
});

/** Mask secrets for logs / health (container env verification). */
function maskSecret(v: string | undefined, keep = 4): string {
  if (!v || v.length <= keep) return v ? '***' : '';
  return `${v.slice(0, keep)}…(${v.length} chars)`;
}

// Ops: check if WhatsApp OTP gateway is reachable + which OTP env vars are loaded (no secrets). No auth.
app.get('/customer/auth/otp-gateway-health', async (_req, res) => {
  const useLegacy =
    process.env.USE_LEGACY_WHATSAPP_GATEWAY === '1' || process.env.USE_LEGACY_WHATSAPP_GATEWAY === 'true';
  let gatewayUrl = (process.env.WHATSAPP_GATEWAY_URL || process.env.WHATSAPP_SERVICE_URL || '').trim().replace(/\/$/, '');
  if (useLegacy && !gatewayUrl) {
    gatewayUrl = 'http://whatsapp-service:3000';
  }
  const extUrl = (process.env.WHATSAPP_API_URL || '').replace(/\/$/, '');
  const otpEnv = {
    WHATSAPP_API_URL: extUrl ? `${extUrl.slice(0, 48)}${extUrl.length > 48 ? '…' : ''}` : '',
    WHATSAPP_TOKEN_set: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_TOKEN.length > 0),
    WHATSAPP_TOKEN_preview: maskSecret(process.env.WHATSAPP_TOKEN),
    WHATSAPP_GATEWAY_URL: (process.env.WHATSAPP_GATEWAY_URL || '').trim().slice(0, 48) || '',
    WHATSAPP_SERVICE_URL: (process.env.WHATSAPP_SERVICE_URL || '').trim().slice(0, 48) || '',
    effectiveGatewayUrl: gatewayUrl ? `${gatewayUrl.slice(0, 40)}${gatewayUrl.length > 40 ? '…' : ''}` : '',
    WA_API_KEY_set: !!(process.env.WA_API_KEY && process.env.WA_API_KEY.length > 0),
    WA_API_KEY_preview: maskSecret(process.env.WA_API_KEY),
    USE_LEGACY_WHATSAPP_GATEWAY: process.env.USE_LEGACY_WHATSAPP_GATEWAY || '',
    FAWAZ_PHONE_set: !!(process.env.FAWAZ_PHONE || process.env.MOCK_OTP_FIXED_PHONES),
    SMS_GATEWAY_URL_set: !!(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_URL.length > 0),
    SMS_API_KEY_set: !!(process.env.SMS_API_KEY && process.env.SMS_API_KEY.length > 0),
    TWILIO_ACCOUNT_SID_set: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.length > 0),
    TWILIO_AUTH_TOKEN_set: !!(process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN.length > 0),
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '',
    MOCK_OTP: process.env.MOCK_OTP || '',
    NODE_ENV: process.env.NODE_ENV || '',
  };
  const externalConfigured = !!(extUrl && process.env.WHATSAPP_TOKEN);
  if (!gatewayUrl && !externalConfigured) {
    return res.json({
      gatewayConfigured: false,
      gatewayReachable: false,
      ready: false,
      externalWhatsAppConfigured: false,
      otpEnv,
    });
  }
  if (externalConfigured) {
    return res.json({
      externalWhatsAppConfigured: true,
      gatewayConfigured: !!gatewayUrl,
      gatewayReachable: null,
      ready: null,
      note: 'OTP WhatsApp uses WHATSAPP_API_URL + WHATSAPP_TOKEN (UltraMsg-compatible). Legacy /health only if USE_LEGACY_WHATSAPP_GATEWAY.',
      otpEnv,
    });
  }
  try {
    const healthRes = await whatsAppFetch(`${gatewayUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      headers: process.env.WA_API_KEY ? { 'x-api-key': process.env.WA_API_KEY } : undefined,
    });
    const data = (await healthRes.json().catch(() => ({}))) as { ready?: boolean };
    res.json({
      gatewayConfigured: true,
      gatewayReachable: healthRes.ok,
      ready: healthRes.ok && data.ready === true,
      externalWhatsAppConfigured: false,
      otpEnv,
    });
  } catch (e) {
    res.json({
      gatewayConfigured: true,
      gatewayReachable: false,
      ready: false,
      externalWhatsAppConfigured: false,
      error: e instanceof Error ? e.message : 'Request failed',
      otpEnv,
    });
  }
});

app.get('/api/internal/whatsapp/reset', async (_req, res) => {
  const useLegacy =
    process.env.USE_LEGACY_WHATSAPP_GATEWAY === '1' || process.env.USE_LEGACY_WHATSAPP_GATEWAY === 'true';
  let gatewayUrl = (process.env.WHATSAPP_GATEWAY_URL || process.env.WHATSAPP_SERVICE_URL || '').trim().replace(/\/$/, '');
  if (useLegacy && !gatewayUrl) {
    gatewayUrl = 'http://whatsapp-service:3000';
  }
  const waApiKey = process.env.WA_API_KEY || '';
  if (!gatewayUrl || !waApiKey) {
    return res.status(500).json({
      success: false,
      error: 'WHATSAPP_GATEWAY_URL or WA_API_KEY is missing',
    });
  }
  try {
    const r = await whatsAppFetch(`${gatewayUrl.replace(/\/$/, '')}/internal/reset`, {
      method: 'GET',
      headers: { 'x-api-key': waApiKey },
    });
    const body = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string; message?: string };
    if (!r.ok || body.success === false) {
      return res.status(502).json({
        success: false,
        error: body.error || `Gateway reset failed (HTTP ${r.status})`,
      });
    }
    return res.json({
      success: true,
      message: body.message || 'Reset triggered. Check whatsapp-service logs for fresh QR code.',
    });
  } catch (e) {
    return res.status(502).json({
      success: false,
      error: e instanceof Error ? e.message : 'Failed to contact WhatsApp gateway',
    });
  }
});

app.get('/internal/whatsapp/reset', async (req, res) => {
  return res.redirect(307, '/api/internal/whatsapp/reset');
});

/**
 * Legacy: internal whatsapp-service (Docker) — only if USE_LEGACY_WHATSAPP_GATEWAY=1.
 */
function classifyWhatsAppOtpError(rawError: string, status?: number): string {
  const e = (rawError || '').toLowerCase();
  if (status === 503 || e.includes('client not ready') || e.includes('not ready') || e.includes('disconnected')) {
    return 'WHATSAPP_DEVICE_OFFLINE: WhatsApp is not connected. Please scan QR and keep phone online.';
  }
  if (e.includes('timeout') || e.includes('getchatbyid')) {
    return 'WHATSAPP_TIMEOUT: Gateway timed out while reaching WhatsApp. Try reset and rescan QR.';
  }
  if (e.includes('unauthorized') || status === 401) {
    return 'WHATSAPP_AUTH_ERROR: WA_API_KEY mismatch between mock-api and whatsapp-service.';
  }
  return rawError || 'WHATSAPP_SEND_FAILED';
}

async function sendOtpViaGateway(
  gatewayUrl: string,
  waApiKey: string,
  /** Digits only, country code, no + (e.g. 972501234567) — matches whatsapp-service normalizePhone */
  phoneDigits: string,
  code: string,
  retries = 0
): Promise<{ sent: boolean; status?: number; error?: string }> {
  const url = `${gatewayUrl.replace(/\/$/, '')}/send-otp`;
  const gatewayHost = gatewayUrl.replace(/^https?:\/\//, '').split('/')[0] || 'gateway';
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': waApiKey },
    body: JSON.stringify({ phone: phoneDigits, code }),
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const sendRes = await whatsAppFetch(url, opts);
      const responseText = await sendRes.text();
      let parsed: { success?: boolean; error?: string; message?: string } = {};
      try {
        parsed = JSON.parse(responseText) as { success?: boolean; error?: string; message?: string };
      } catch {
        /* non-JSON body */
      }
      // Gateway must return JSON { success: true }; treat anything else as failure → SMS fallback
      const waOk = sendRes.ok && parsed.success === true;
      const response = {
        status: sendRes.status,
        ok: sendRes.ok,
        success: parsed.success,
        error: parsed.error ?? parsed.message,
        bodyPreview: responseText.length > 400 ? `${responseText.slice(0, 400)}…` : responseText,
      };
      console.log('OTP-SEND-DEBUG:', { phone: phoneDigits, code, response });
      if (waOk) {
        return { sent: true };
      }
      console.warn(
        `[customer/auth/start] WhatsApp send-otp failed (attempt ${attempt + 1}/${retries + 1}):`,
        sendRes.status,
        gatewayHost,
        responseText.slice(0, 200)
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      console.warn(
        '[customer/auth/start] If OTP is delayed, check WhatsApp gateway GET /health and third-party provider status page for outages.'
      );
      const raw = ((parsed.error ?? parsed.message ?? responseText.slice(0, 200)) || '').trim();
      return { sent: false, status: sendRes.status, error: classifyWhatsAppOtpError(raw, sendRes.status) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('OTP-SEND-DEBUG:', { phone: phoneDigits, code, response: { error: msg, network: true } });
      console.warn(
        `[customer/auth/start] WhatsApp send-otp error (attempt ${attempt + 1}/${retries + 1}):`,
        gatewayHost,
        msg
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      console.warn(
        '[customer/auth/start] If OTP is delayed, check WhatsApp gateway GET /health and third-party provider status page for outages.'
      );
      return { sent: false, error: classifyWhatsAppOtpError(msg) };
    }
  }
  return { sent: false };
}

function normalizePhoneForSms(phone: string): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits || digits.length < 9) return null;
  // Israel numbers are usually local 05xxxxxxxx. Convert to +9725xxxxxxxx (E.164-like).
  const withCountry = digits.startsWith('0') ? '972' + digits.slice(1) : digits.length <= 10 ? '972' + digits : digits;
  return '+' + withCountry;
}

async function sendOtpViaSmsGateway(
  smsGatewayUrl: string,
  apiKey: string,
  phone: string,
  code: string
): Promise<{ sent: boolean; error?: string; status?: number }> {
  const url = `${smsGatewayUrl.replace(/\/$/, '')}/send-otp`;
  const phoneTo = normalizePhoneForSms(phone);
  if (!phoneTo) return { sent: false, error: 'Invalid phone for SMS' };

  const message = `رمز التحقق الخاص بك هو: ${String(code).trim()}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ phone: phoneTo, code, message }),
    });
    if (res.ok) return { sent: true };
    const errText = await res.text().catch(() => '');
    return { sent: false, status: res.status, error: errText.slice(0, 200) || `HTTP ${res.status}` };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendOtpViaTwilio(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  phone: string,
  code: string
): Promise<{ sent: boolean; error?: string }> {
  const phoneTo = normalizePhoneForSms(phone);
  if (!phoneTo) return { sent: false, error: 'Invalid phone for SMS' };
  if (!fromNumber) return { sent: false, error: 'Missing TWILIO_FROM_NUMBER' };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const message = `رمز التحقق الخاص بك هو: ${String(code).trim()}`;
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basicAuth}` },
      body: new URLSearchParams({ To: phoneTo, From: fromNumber, Body: message }),
    });
    if (res.ok) return { sent: true };
    const errText = await res.text().catch(() => '');
    return { sent: false, error: errText.slice(0, 200) || `Twilio HTTP error ${res.status}` };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

app.post('/customer/auth/start', async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || typeof phone !== 'string') {
    console.log('[customer/auth/start] 400: phone required');
    return res.status(400).json({ error: 'phone required' });
  }
  const phoneDigits = normalizeInternationalPhoneDigits(phone);
  if (!phoneDigits || phoneDigits.length < 9) {
    console.log('[customer/auth/start] 400: invalid phone', phone);
    return res.status(400).json({ error: 'Invalid phone format' });
  }
  const result = createOtp(phone);
  if (!result.ok) {
    console.log('[customer/auth/start] 429:', result.error, result.code);
    return res.status(429).json({ error: result.error, code: result.code });
  }
  const playReview =
    ('playReview' in result && result.playReview === true) ||
    isGooglePlayReviewPhone(phoneDigits);
  if (playReview) {
    console.log(
      '[customer/auth/start] Google Play review phone — OTP delivery skipped (use app-access credentials)',
    );
  }
  const externalApiUrl = (process.env.WHATSAPP_API_URL || '').trim().replace(/\/$/, '');
  const externalToken = (process.env.WHATSAPP_TOKEN || '').trim();
  let gatewayUrl = (process.env.WHATSAPP_GATEWAY_URL || process.env.WHATSAPP_SERVICE_URL || '').trim().replace(/\/$/, '');
  const waApiKey = process.env.WA_API_KEY;
  const useLegacyGateway = process.env.USE_LEGACY_WHATSAPP_GATEWAY === '1' || process.env.USE_LEGACY_WHATSAPP_GATEWAY === 'true';
  if (useLegacyGateway && !gatewayUrl) {
    gatewayUrl = 'http://whatsapp-service:3000';
  }

  let whatsAppSent = false;
  let whatsAppError: string | undefined;
  if (!playReview && externalApiUrl && externalToken && result.codeForSending) {
    const ext = await sendOtpViaExternalWhatsAppApi(externalApiUrl, externalToken, phoneDigits, result.codeForSending);
    whatsAppSent = ext.sent;
    if (!ext.sent && ext.providerError) {
      console.error('[customer/auth/start] External WhatsApp API error (exact provider message):', ext.providerError);
    }
  } else if (!playReview && useLegacyGateway && gatewayUrl && waApiKey && result.codeForSending) {
    const sendResult = await sendOtpViaGateway(gatewayUrl, waApiKey, phoneDigits, result.codeForSending, 0);
    whatsAppSent = sendResult.sent;
    if (!sendResult.sent && sendResult.error) {
      whatsAppError = sendResult.error;
      console.error('[customer/auth/start] Legacy gateway error:', sendResult.error);
    }
    // Debugging: if legacy whatsapp connection fails, always print the OTP code to container logs
    // (even if SMS fallback succeeds) so Fawaz can manually sign in while the gateway is down.
    if (!sendResult.sent && result.codeForSending) {
      const shouldLogOtp = process.env.OTP_LOG_ON_WA_FAIL === '1' || process.env.NODE_ENV !== 'production';
      if (shouldLogOtp) {
        logOtpManualFallback(phoneDigits, result.codeForSending, 'whatsapp_connection_failed');
      }
    }
  }

  // If WhatsApp failed or was not configured, try SMS (custom gateway first, then Twilio).
  let smsSent = false;
  if (!playReview && !whatsAppSent && result.codeForSending) {
    const smsGatewayUrl = (process.env.SMS_GATEWAY_URL || '').replace(/\/$/, '');
    const smsApiKey = process.env.SMS_API_KEY ?? '';
    if (smsGatewayUrl && smsApiKey) {
      const smsRes = await sendOtpViaSmsGateway(smsGatewayUrl, smsApiKey, phoneDigits, result.codeForSending);
      smsSent = smsRes.sent;
      if (!smsRes.sent) {
        console.warn('[customer/auth/start] SMS gateway fallback failed:', smsRes.error);
      }
    }
    if (!smsSent) {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID ?? '';
      const twilioToken = process.env.TWILIO_AUTH_TOKEN ?? '';
      const twilioFrom = process.env.TWILIO_FROM_NUMBER ?? '';
      if (twilioSid && twilioToken && twilioFrom) {
        const smsRes = await sendOtpViaTwilio(twilioSid, twilioToken, twilioFrom, phoneDigits, result.codeForSending);
        smsSent = smsRes.sent;
        if (!smsRes.sent) console.warn('[customer/auth/start] Twilio SMS fallback failed:', smsRes.error);
      }
    }
  }

  if (!whatsAppSent && smsSent) {
    console.warn('[customer/auth/start] WhatsApp delivery failed; SMS delivered the OTP.');
  }
  if (!playReview && !whatsAppSent && !smsSent && result.codeForSending) {
    logOtpManualFallback(phoneDigits, result.codeForSending, 'whatsapp_and_sms_failed');
  }

  if (result.devCode) console.log('[customer/auth/start] 200 → OTP sent (see [OTP] log above or client toast)');
  const sentVia = playReview
    ? 'play_review'
    : whatsAppSent && smsSent
      ? 'both'
      : whatsAppSent
        ? 'whatsapp'
        : smsSent
          ? 'sms'
          : 'none';
  const deliveryOk = whatsAppSent || smsSent;
  const mockOrDevCode = Boolean(result.devCode);
  const clientSeesSuccess = deliveryOk || mockOrDevCode || playReview;
  res.json({
    ok: true,
    whatsAppSent: clientSeesSuccess, // true if WA/SMS worked OR dev/fixed MOCK_OTP exposes devCode
    smsSent,
    sentVia,
    ...(!deliveryOk &&
      !mockOrDevCode && {
        deliveryFailed: true,
        deliveryError: whatsAppError || 'OTP delivery failed',
        hint: 'OTP logged to server console and otp-debug.log if configured',
      }),
    ...(result.devCode && { devCode: result.devCode }),
  });
});

function normalizePhoneForMatch(phone: string): string {
  return normalizeInternationalPhoneDigits(phone) ?? '';
}

function loadOtpConfig(): { fawazPhone: string; mockOtp: string; nodeEnv: string } {
  return {
    fawazPhone: normalizePhoneForMatch(process.env.FAWAZ_PHONE ?? ''),
    mockOtp: String(process.env.MOCK_OTP ?? '').trim(),
    nodeEnv: String(process.env.NODE_ENV ?? '').trim(),
  };
}

function shouldBypassOtpVerification(phone: string, code: string): boolean {
  const cfg = loadOtpConfig();
  if (cfg.nodeEnv.toLowerCase() === 'production') return false;
  const phoneNorm = normalizePhoneForMatch(phone);
  const codeNorm = String(code ?? '').trim();
  if (!cfg.mockOtp || codeNorm !== cfg.mockOtp) return false;
  const fawazMatch = !!cfg.fawazPhone && phoneNorm === cfg.fawazPhone;
  if (fawazMatch) {
    console.warn('[OTP-BYPASS] MOCK_OTP accepted', {
      phone: phoneNorm,
      reason: 'FAWAZ_PHONE match',
    });
    return true;
  }
  return false;
}

// Customer signup/login: name from storefront is saved via repos.customers (DB or JSON per STORAGE_DRIVER).
app.post('/customer/auth/verify', async (req, res) => {
  const { phone, code, name } = req.body as { phone?: string; code?: string; name?: string };
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
  const result = verifyOtp(phone, code);
  const bypass = !result.ok && shouldBypassOtpVerification(phone, code);
  if (!result.ok && !bypass) {
    const status = result.code === 'OTP_LOCKED' || result.code === 'RATE_LIMITED' ? 429 : 401;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  const key = normalizePhoneForMatch(phone);
  const customers = await repos.customers.findAll();
  const existing = pickCustomerByCanonicalPhone(customers, phone);
  const isNewUser = !existing;
  let customer = existing;
  const nameTrimmed = typeof name === 'string' ? name.trim() : undefined;
  if (!customer) {
    const id = `customer-${crypto.randomUUID?.() ?? Date.now()}`;
    customer = { id, phone: key || canonicalCustomerPhone(phone), name: nameTrimmed || undefined, createdAt: new Date().toISOString() };
    const next = [...customers, customer];
    await repos.customers.setAll(next);
  } else if (nameTrimmed && !customer.name) {
    customer = { ...customer, phone: key || canonicalCustomerPhone(customer.phone), name: nameTrimmed };
    const next = customers.map((c) => (c.id === customer!.id ? customer! : c));
    await repos.customers.setAll(next);
  }
  const token = jwt.sign({ sub: customer.id, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '30d' });
  const customerUser = { id: customer.id, phone: customer.phone, name: customer.name?.trim() || 'Rand' };
  res.json({
    token,
    accessToken: token,
    user: customerUser,
    customer: customerUser,
    isNewUser,
  });
});

// Mobile compatibility endpoint: same OTP verification flow, legacy path.
app.post('/auth/verify-otp', async (req, res) => {
  const { phone, code, name } = req.body as { phone?: string; code?: string; name?: string };
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
  const result = verifyOtp(phone, code);
  const bypass = !result.ok && shouldBypassOtpVerification(phone, code);
  if (!result.ok && !bypass) {
    const status = result.code === 'OTP_LOCKED' || result.code === 'RATE_LIMITED' ? 429 : 401;
    return res.status(status).json({ error: result.error, code: result.code });
  }
  const key = normalizePhoneForMatch(phone);
  const customers = await repos.customers.findAll();
  const existing = pickCustomerByCanonicalPhone(customers, phone);
  const isNewUser = !existing;
  let customer = existing;
  const nameTrimmed = typeof name === 'string' ? name.trim() : undefined;
  if (!customer) {
    const id = `customer-${crypto.randomUUID?.() ?? Date.now()}`;
    customer = { id, phone: key || canonicalCustomerPhone(phone), name: nameTrimmed || undefined, createdAt: new Date().toISOString() };
    const next = [...customers, customer];
    await repos.customers.setAll(next);
  } else if (nameTrimmed && !customer.name) {
    customer = { ...customer, phone: key || canonicalCustomerPhone(customer.phone), name: nameTrimmed };
    const next = customers.map((c) => (c.id === customer!.id ? customer! : c));
    await repos.customers.setAll(next);
  }
  const token = jwt.sign({ sub: customer.id, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '30d' });
  const user = { id: customer.id, phone: customer.phone, name: customer.name?.trim() || 'Rand' };
  res.json({ token, accessToken: token, user, customer: user, isNewUser });
});

// Compatibility aliases for clients using /customer/auth/otp/* paths.
app.post('/customer/auth/otp/start', async (req, res) => res.redirect(307, '/customer/auth/start'));
app.post('/customer/auth/otp/verify', async (req, res) => res.redirect(307, '/customer/auth/verify'));

app.get('/customer/me', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string; name?: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const full = (await repos.customers.findAll()).find((c) => c.id === customer.id);
  res.json({
    id: customer.id,
    phone: customer.phone,
    name: full?.name ?? customer.name,
    email: full?.email,
    city: full?.city,
    avatarUrl: full?.avatarUrl,
    defaultDeliveryTown: full ? parseAccountExtras(full).defaultDeliveryTown : undefined,
  });
});

app.patch('/customer/profile', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string; name?: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body as {
    name?: string;
    email?: string | null;
    city?: string | null;
    avatarUrl?: string | null;
    defaultDeliveryTown?: string | null;
    source?: string;
  };
  const customers = await repos.customers.findAll();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const prev = customers[idx];
  let updated = { ...prev };
  if (typeof body.name === 'string') updated.name = body.name.trim();
  if ('email' in body) {
    const raw = body.email;
    if (raw == null || raw === '') updated.email = undefined;
    else {
      const t = String(raw).trim();
      updated.email = t.length === 0 ? undefined : t;
    }
  }
  if ('city' in body) {
    const raw = body.city;
    if (raw == null || raw === '') updated.city = undefined;
    else {
      const t = String(raw).trim();
      updated.city = t.length === 0 ? undefined : t;
    }
  }
  if ('avatarUrl' in body) {
    const raw = body.avatarUrl;
    if (raw == null || raw === '') updated.avatarUrl = undefined;
    else {
      const t = String(raw).trim();
      updated.avatarUrl = t.length === 0 ? undefined : t;
    }
  }
  if ('defaultDeliveryTown' in body) {
    const extras = parseAccountExtras(updated);
    const raw = body.defaultDeliveryTown;
    if (raw == null || raw === '') {
      extras.defaultDeliveryTown = undefined;
    } else {
      const t = String(raw).trim();
      if (t.length > 0 && !isSupportedDeliveryTown(t)) {
        return res.status(422).json({
          error: 'منطقة التوصيل غير مدعومة',
          field: 'defaultDeliveryTown',
          code: 'INVALID_DELIVERY_TOWN',
        });
      }
      extras.defaultDeliveryTown = t.length === 0 ? undefined : t;
      if (extras.defaultDeliveryTown) {
        const sourceRaw = typeof body.source === 'string' ? body.source.trim() : '';
        const source =
          sourceRaw === 'registration' || sourceRaw === 'profile' || sourceRaw === 'checkout'
            ? sourceRaw
            : 'profile';
        console.log(
          '[CUSTOMER_DEFAULT_TOWN_SET]',
          JSON.stringify({
            customerId: customer.id,
            town: extras.defaultDeliveryTown,
            source,
          }),
        );
      }
    }
    updated = mergeExtrasIntoCustomer(updated, extras);
  }
  customers[idx] = updated;
  await repos.customers.setAll(customers);
  const extrasOut = parseAccountExtras(updated);
  res.json({
    customer: {
      id: updated.id,
      phone: updated.phone,
      name: updated.name,
      email: updated.email,
      city: updated.city,
      avatarUrl: updated.avatarUrl,
      defaultDeliveryTown: extrasOut.defaultDeliveryTown,
    },
  });
});

/** Apple App Store: account deletion — removes customer row and related data (DB: participations, coins, FCM cascade). */
app.delete('/customer/me', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const isDb = (process.env.STORAGE_DRIVER ?? '').toLowerCase() === 'db';
  if (isDb) {
    const phoneKey = normalizePhoneForMatch(customer.phone);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.contestParticipation.deleteMany({ where: { customerId: customer.id } });
        await tx.customerCoin.deleteMany({ where: { customerPhone: phoneKey } });
        await tx.customer.delete({ where: { id: customer.id } });
      });
    } catch (e) {
      console.error('[DELETE /customer/me]', e);
      return res.status(500).json({ error: 'Failed to delete account' });
    }
    return res.status(204).send();
  }
  const customers = await repos.customers.findAll();
  const next = customers.filter((c) => c.id !== customer.id);
  if (next.length === customers.length) return res.status(404).json({ error: 'Customer not found' });
  await repos.customers.setAll(next);
  return res.status(204).send();
});

// --- Customer account: addresses, payment methods (masked), notification prefs (stored in Customer.accountExtras) ---
app.get('/customer/addresses', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const customers = await repos.customers.findAll();
  const full = customers.find((c) => c.id === customer.id);
  const extras = parseAccountExtras(full);
  res.json({ addresses: extras.addresses });
});

app.post('/customer/addresses', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body as { label?: string; line1?: string; city?: string; notes?: string; isDefault?: boolean };
  const line1 = typeof body.line1 === 'string' ? body.line1.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  if (!line1 || !city) return res.status(400).json({ error: 'line1 and city required' });
  const customers = await repos.customers.findAll();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const extras = parseAccountExtras(customers[idx]);
  const id = newAddressId();
  const addr = {
    id,
    label: typeof body.label === 'string' ? body.label.trim() || undefined : undefined,
    line1,
    city,
    notes: typeof body.notes === 'string' ? body.notes.trim() || undefined : undefined,
    isDefault: !!body.isDefault,
  };
  if (addr.isDefault) extras.addresses = extras.addresses.map((a) => ({ ...a, isDefault: false }));
  extras.addresses.push(addr);
  customers[idx] = mergeExtrasIntoCustomer(customers[idx]!, extras);
  await repos.customers.setAll(customers);
  res.status(201).json({ address: addr });
});

app.patch('/customer/addresses/:id', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id ?? '').trim();
  const body = req.body as { label?: string; line1?: string; city?: string; notes?: string; isDefault?: boolean };
  const customers = await repos.customers.findAll();
  const cidx = customers.findIndex((c) => c.id === customer.id);
  if (cidx === -1) return res.status(404).json({ error: 'Customer not found' });
  const extras = parseAccountExtras(customers[cidx]);
  const aidx = extras.addresses.findIndex((a) => a.id === id);
  if (aidx === -1) return res.status(404).json({ error: 'Address not found' });
  const cur = extras.addresses[aidx]!;
  const next = { ...cur };
  if (typeof body.label === 'string') next.label = body.label.trim() || undefined;
  if (typeof body.line1 === 'string') next.line1 = body.line1.trim();
  if (typeof body.city === 'string') next.city = body.city.trim();
  if (typeof body.notes === 'string') next.notes = body.notes.trim() || undefined;
  if (typeof body.isDefault === 'boolean') {
    next.isDefault = body.isDefault;
  }
  if (!next.line1 || !next.city) return res.status(400).json({ error: 'line1 and city required' });
  extras.addresses[aidx] = next;
  if (body.isDefault === true) {
    extras.addresses = extras.addresses.map((a) => ({ ...a, isDefault: a.id === id }));
  }
  customers[cidx] = mergeExtrasIntoCustomer(customers[cidx]!, extras);
  await repos.customers.setAll(customers);
  res.json({ address: next });
});

app.delete('/customer/addresses/:id', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id ?? '').trim();
  const customers = await repos.customers.findAll();
  const cidx = customers.findIndex((c) => c.id === customer.id);
  if (cidx === -1) return res.status(404).json({ error: 'Customer not found' });
  const extras = parseAccountExtras(customers[cidx]);
  const before = extras.addresses.length;
  extras.addresses = extras.addresses.filter((a) => a.id !== id);
  if (extras.addresses.length === before) return res.status(404).json({ error: 'Address not found' });
  customers[cidx] = mergeExtrasIntoCustomer(customers[cidx]!, extras);
  await repos.customers.setAll(customers);
  res.status(204).send();
});

app.get('/customer/payment-methods', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const customers = await repos.customers.findAll();
  const full = customers.find((c) => c.id === customer.id);
  const extras = parseAccountExtras(full);
  res.json({ paymentMethods: extras.paymentMethods });
});

app.post('/customer/payment-methods', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body as {
    cardNumber?: string;
    holderName?: string;
    expiryMonth?: number;
    expiryYear?: number;
    cvv?: string;
  };
  const pan = String(body.cardNumber ?? '').replace(/\D/g, '');
  const holderName = typeof body.holderName === 'string' ? body.holderName.trim() : '';
  if (!holderName) return res.status(400).json({ error: 'holderName required' });
  if (!luhnValid(pan)) return res.status(400).json({ error: 'Invalid card number' });
  const brand = inferCardBrand(pan);
  const last4 = pan.slice(-4);
  let expM = Number(body.expiryMonth);
  let expY = Number(body.expiryYear);
  if (!Number.isFinite(expM) || expM < 1 || expM > 12) return res.status(400).json({ error: 'Invalid expiry month' });
  if (!Number.isFinite(expY)) return res.status(400).json({ error: 'Invalid expiry year' });
  if (expY < 100) expY += 2000;
  const cvv = String(body.cvv ?? '').replace(/\D/g, '');
  const needCvv = brand === 'Amex' ? 4 : 3;
  if (cvv.length !== needCvv) return res.status(400).json({ error: 'Invalid CVV' });
  const endOfExpiryMonth = new Date(expY, expM, 0, 23, 59, 59, 999);
  if (endOfExpiryMonth < new Date()) {
    return res.status(400).json({ error: 'Card expired' });
  }
  const customers = await repos.customers.findAll();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const extras = parseAccountExtras(customers[idx]);
  const id = newCardId();
  const card = {
    id,
    brand,
    last4,
    holderName,
    expiryMonth: expM,
    expiryYear: expY,
  };
  extras.paymentMethods.push(card);
  customers[idx] = mergeExtrasIntoCustomer(customers[idx]!, extras);
  await repos.customers.setAll(customers);
  res.status(201).json({ paymentMethod: card });
});

app.delete('/customer/payment-methods/:id', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id ?? '').trim();
  const customers = await repos.customers.findAll();
  const cidx = customers.findIndex((c) => c.id === customer.id);
  if (cidx === -1) return res.status(404).json({ error: 'Customer not found' });
  const extras = parseAccountExtras(customers[cidx]);
  const before = extras.paymentMethods.length;
  extras.paymentMethods = extras.paymentMethods.filter((p) => p.id !== id);
  if (extras.paymentMethods.length === before) return res.status(404).json({ error: 'Card not found' });
  customers[cidx] = mergeExtrasIntoCustomer(customers[cidx]!, extras);
  await repos.customers.setAll(customers);
  res.status(204).send();
});

app.get('/customer/notification-settings', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const customers = await repos.customers.findAll();
  const full = customers.find((c) => c.id === customer.id);
  const extras = parseAccountExtras(full);
  res.json(extras.notifications);
});

app.patch('/customer/notification-settings', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body as Partial<{ orderUpdates: boolean; promotions: boolean; news: boolean }>;
  const customers = await repos.customers.findAll();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const extras = parseAccountExtras(customers[idx]);
  extras.notifications = normalizeNotificationPatch(extras.notifications, body);
  customers[idx] = mergeExtrasIntoCustomer(customers[idx]!, extras);
  await repos.customers.setAll(customers);
  res.json(extras.notifications);
});

app.put('/customer/me/fcm-token', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string; name?: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const raw = (req.body as { fcmToken?: string })?.fcmToken;
  const token = raw != null && typeof raw === 'string' ? raw.trim() : null;
  const customers = await repos.customers.findAll();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const updated = { ...customers[idx], fcmToken: token || null };
  customers[idx] = updated;
  await repos.customers.setAll(customers);
  console.log('[FCM] Customer fcm-token saved for customer ID:', customer.id);
  res.status(204).send();
}));

/** Customer app: save FCM device token after login. Requires customer JWT (req.customer). */
app.post('/customer/save-fcm-token', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string; name?: string } }).customer;
  if (!customer?.id) {
    console.warn('[FCM_SAVE] customerId=(missing) unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const body = req.body as { token?: string; fcmToken?: string; platform?: string; customerId?: string };
  const raw =
    (typeof body.token === 'string' ? body.token : undefined) ??
    (typeof body.fcmToken === 'string' ? body.fcmToken : undefined);
  const token = raw?.trim() ?? '';
  const platform = typeof body.platform === 'string' ? body.platform.trim() : '';
  const prefix = token ? `${token.slice(0, 12)}...` : '(empty)';
  console.log(`[FCM_SAVE] customerId=${customer.id} tokenPrefix=${prefix} platform=${platform || 'unknown'}`);
  if (!token) {
    return res.status(400).json({ error: 'token required' });
  }
  const isDb = isStorageDb();
  if (isDb) {
    await prisma.customerFCMToken.deleteMany({ where: { customerId: customer.id } });
    await prisma.customerFCMToken.upsert({
      where: { token },
      create: { customerId: customer.id, token },
      update: { customerId: customer.id },
    });
    console.log(`[FCM_SAVE] customerId=${customer.id} tokenPrefix=${prefix} persisted=true storage=CustomerFCMToken`);
  } else {
    const customers = await repos.customers.findAll();
    const idx = customers.findIndex((c) => c.id === customer.id);
    if (idx === -1) {
      console.warn(`[FCM_SAVE] customerId=${customer.id} persisted=false reason=notFound`);
      return res.status(404).json({ error: 'Customer not found' });
    }
    const updated = { ...customers[idx], fcmToken: token };
    customers[idx] = updated;
    await repos.customers.setAll(customers);
    console.log(`[FCM_SAVE] customerId=${customer.id} tokenPrefix=${prefix} persisted=true storage=customer.fcmToken`);
  }
  res.status(204).send();
}));

app.get('/customer/push-public-key', (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.get('/merchant/push-public-key', (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.post('/merchant/push-subscription', async (req, res) => {
  const u = req.user as { tenantId?: string; role?: string; marketId?: string } | undefined;
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; expirationTime?: number | null }; tenantId?: string };
  const sub = body?.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'subscription with endpoint required' });
  let tenantId = body.tenantId ?? u.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required (or login as tenant admin)' });
  if (u.role === 'TENANT_ADMIN' && u.tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden: can only subscribe for your store' });
  if (u.role === 'MARKET_ADMIN' && u.marketId) {
    const tenants = await repos.tenants.findAll();
    const tenant = tenants.find((t) => t.id === tenantId && (t as { marketId?: string }).marketId === u.marketId);
    if (!tenant) return res.status(403).json({ error: 'Forbidden: tenant not in your market' });
  }
  const subscription = {
    endpoint: sub.endpoint,
    keys: sub.keys ? { p256dh: sub.keys.p256dh, auth: sub.keys.auth } : undefined,
    expirationTime: sub.expirationTime ?? null,
  };
  saveAdminSubscription(tenantId, subscription);
  res.json({ ok: true });
});

app.post('/merchant/push-test', async (req, res) => {
  const u = req.user as { tenantId?: string; role?: string; marketId?: string } | undefined;
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  let tenantId = u.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'No tenant for this user; open a store first' });
  const subs = getSubscriptionsByTenant(tenantId);
  if (subs.length === 0) return res.status(404).json({ error: 'No push subscriptions for this store; allow notifications and reopen the app' });
  const payload = { title: 'طلب جديد وصل! 🔔', body: 'لديك طلب جديد ينتظر القبول في متجر دبورية' };
  try {
    await Promise.all(subs.map((sub) => sendPushNotification(sub, payload)));
    res.json({ ok: true, sent: subs.length });
  } catch (e) {
    console.error('[Push] Test send failed:', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Push send failed' });
  }
});

app.post('/customer/push-subscription', async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  const hasAuth = !!req.headers.authorization;
  if (!customer) {
    console.log('[Push] POST /customer/push-subscription 401 – no customer (auth header present:', hasAuth, ')');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const body = req.body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; expirationTime?: number | null };
    phone?: string;
  };
  const sub = body?.subscription;
  if (!sub || !sub.endpoint) {
    console.log('[Push] POST /customer/push-subscription 400 – subscription with endpoint required');
    return res.status(400).json({ error: 'subscription with endpoint required' });
  }
  const phoneFromBody = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phoneFromBody) {
    console.log('[Push] POST /customer/push-subscription 400 – phone required in body');
    return res.status(400).json({ error: 'phone required in body for customer push subscription' });
  }
  const normalizedBody = phoneFromBody.replace(/\D/g, '');
  const normalizedCustomer = customer.phone.replace(/\D/g, '');
  if (normalizedBody !== normalizedCustomer) {
    console.log('[Push] POST /customer/push-subscription 403 – phone mismatch body vs customer');
    return res.status(403).json({ error: 'Phone in body does not match authenticated customer' });
  }
  const subscription = {
    endpoint: sub.endpoint,
    keys: sub.keys ? { p256dh: sub.keys.p256dh, auth: sub.keys.auth } : undefined,
    expirationTime: sub.expirationTime ?? null,
  };
  try {
    saveSubscription(customer.phone, subscription);
    console.log('[Push] Customer subscription saved under phone key ***' + customer.phone.replace(/\D/g, '').slice(-4));
    res.json({ ok: true });
  } catch (err) {
    console.error('[Push] Customer subscription save threw:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

app.get('/customer/activity', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; status?: string; total?: number; currency?: string; createdAt?: string; items?: unknown[]; customerId?: string }[];
  const customerOrders = orders.filter((o) => o.customerId === customer.id);
  const leads = getLeads();
  const customerLeads = leads.filter(
    (l) => l.type === 'PROFESSIONAL_CONTACT' && (l.metadata as { customerId?: string })?.customerId === customer.id
  );
  const tenants = await repos.tenants.findAll();
  const ordersWithTenant = customerOrders.map((o) => {
    const t = tenants.find((x) => x.id === o.tenantId);
    return { ...o, tenantName: t?.name, tenantSlug: (t as { slug?: string })?.slug };
  });
  const leadsWithTenant = customerLeads.map((l) => {
    const t = tenants.find((x) => x.id === l.tenantId);
    return { ...l, tenantName: t?.name, tenantSlug: (t as { slug?: string })?.slug };
  });
  res.json({ orders: ordersWithTenant, leads: leadsWithTenant });
}));

/** Fixed samples for native/UI test builds (`MOCK_CUSTOMER_ORDERS_STATIC_BYPASS=1`). */
function getStaticCustomerOrdersSamples(): Record<string, unknown>[] {
  const base = Date.now();
  return [
    {
      id: 'static-order-001',
      tenantId: 'static-tenant-a',
      customerId: 'static-bypass',
      orderType: 'PRODUCT',
      status: 'PREPARING',
      total: 120.5,
      currency: 'ILS',
      createdAt: new Date(base - 3600_000).toISOString(),
      fulfillmentType: 'DELIVERY',
      orderGroupId: undefined,
      tenantName: 'متجر تجريبي — أ',
      tenantSlug: 'demo-a',
      tenantLogoUrl: undefined,
      tenantWhatsappDigits: '972501111111',
      itemCount: 2,
      items: [
        { productId: 'p1', productName: 'منتج أ', quantity: 1, basePrice: 60, totalPrice: 60, imageUrl: '' },
        { productId: 'p2', productName: 'منتج ب', quantity: 1, basePrice: 60.5, totalPrice: 60.5, imageUrl: '' },
      ],
    },
    {
      id: 'static-order-002',
      tenantId: 'static-tenant-b',
      customerId: 'static-bypass',
      orderType: 'PRODUCT',
      status: 'OUT_FOR_DELIVERY',
      total: 45,
      currency: 'ILS',
      createdAt: new Date(base - 86_400_000).toISOString(),
      fulfillmentType: 'DELIVERY',
      driverLocation: { lat: 32.794, lng: 34.9896 },
      dropoffLocation: { lat: 32.805, lng: 34.998 },
      orderGroupId: undefined,
      tenantName: 'متجر تجريبي — ب',
      tenantSlug: 'demo-b',
      tenantLogoUrl: undefined,
      tenantWhatsappDigits: '972502222222',
      itemCount: 1,
      items: [{ productId: 'p3', productName: 'طلب سريع', quantity: 1, basePrice: 45, totalPrice: 45, imageUrl: '' }],
    },
    {
      id: 'static-order-service-001',
      tenantId: 'static-tenant-svc',
      customerId: 'static-bypass',
      orderType: 'SERVICE',
      status: 'PREPARING',
      total: 300,
      currency: 'ILS',
      createdAt: new Date(base - 7200_000).toISOString(),
      fulfillmentType: 'PICKUP',
      orderGroupId: undefined,
      tenantName: 'عيادة تجريبية',
      tenantSlug: 'demo-svc',
      tenantLogoUrl: undefined,
      tenantWhatsappDigits: '972504444444',
      itemCount: 1,
      items: [{ productId: 'svc1', productName: 'استشارة', quantity: 1, basePrice: 300, totalPrice: 300, imageUrl: '' }],
    },
    {
      id: 'static-order-003',
      tenantId: 'static-tenant-c',
      customerId: 'static-bypass',
      orderType: 'PRODUCT',
      status: 'DELIVERED',
      total: 210,
      currency: 'ILS',
      createdAt: new Date(base - 172_800_000).toISOString(),
      fulfillmentType: 'DELIVERY',
      orderGroupId: 'group-demo-1',
      tenantName: 'متجر تجريبي — ج',
      tenantSlug: 'demo-c',
      tenantLogoUrl: undefined,
      tenantWhatsappDigits: '972503333333',
      itemCount: 3,
      items: [
        { productId: 'p4', productName: 'صنف 1', quantity: 2, basePrice: 50, totalPrice: 100, imageUrl: '' },
        { productId: 'p5', productName: 'صنف 2', quantity: 1, basePrice: 110, totalPrice: 110, imageUrl: '' },
      ],
    },
  ];
}

/** Native app: full order list for customer (same enrichment as activity.orders, sorted newest first). */
app.get('/customer/orders', wrapAsync(async (req, res) => {
  if (MOCK_CUSTOMER_ORDERS_STATIC_BYPASS) {
    const samples = getStaticCustomerOrdersSamples();
    console.log('[customer/orders] MOCK_CUSTOMER_ORDERS_STATIC_BYPASS — returning', samples.length, 'static orders (no auth)');
    return res.json({ orders: samples });
  }

  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const rows = (await repos.orders.findAll()) as Record<string, unknown>[];
  const customerOrders = rows.filter((o) => (o as { customerId?: string }).customerId === customer.id);
  const tenants = await repos.tenants.findAll();
  const enriched = customerOrders.map((raw) => {
    const o = raw as {
      id?: string;
      tenantId?: string;
      status?: string;
      total?: number;
      currency?: string;
      createdAt?: string;
      items?: unknown[];
      fulfillmentType?: string;
      orderGroupId?: string;
      customerName?: string;
      customerPhone?: string;
      orderType?: string;
    };
    const t = tenants.find((x) => x.id === o.tenantId);
    const items = Array.isArray(o.items) ? o.items : [];
    const itemCount = items.length;
    const logoUrl = (t as { logoUrl?: string } | undefined)?.logoUrl ?? '';
    const whatsapp =
      (t as { whatsappPhone?: string; phone?: string } | undefined)?.whatsappPhone ??
      (t as { phone?: string } | undefined)?.phone ??
      '';
    const orderType = String(o.orderType ?? 'PRODUCT').toUpperCase();
    const isService = orderType === 'SERVICE';
    const st = String(o.status ?? '').toUpperCase();
    const isDelivery = String(o.fulfillmentType ?? '').toUpperCase() === 'DELIVERY';
    let driverLocation: { lat: number; lng: number } | undefined;
    if (!isService && isDelivery && ['OUT_FOR_DELIVERY', 'PICKED_UP', 'IN_PROGRESS', 'ON_THE_WAY'].includes(st)) {
      driverLocation = { lat: 32.794, lng: 34.9896 };
    }
    return {
      ...o,
      orderType: o.orderType ?? 'PRODUCT',
      tenantName: t?.name ?? o.tenantId,
      tenantSlug: (t as { slug?: string } | undefined)?.slug,
      tenantLogoUrl: logoUrl || undefined,
      tenantWhatsappDigits: String(whatsapp).replace(/\D/g, '') || undefined,
      itemCount,
      ...(driverLocation ? { driverLocation } : {}),
    };
  });
  enriched.sort((a, b) => {
    const ta = String((a as { createdAt?: string }).createdAt ?? '');
    const tb = String((b as { createdAt?: string }).createdAt ?? '');
    return tb.localeCompare(ta);
  });

  res.json({ orders: enriched });
}));

// --- Customer order editing window (submission gate) — orderGroupId scoped ---

async function loadCustomerOrderGroup(
  customerId: string,
  orderGroupId: string
): Promise<OrderRecord[]> {
  const rows = (await repos.orders.findAll()) as OrderRecord[];
  return rows.filter(
    (o) =>
      String(o.orderGroupId ?? '') === orderGroupId &&
      String(o.customerId ?? '') === customerId
  );
}

function respondGroupGateError(
  res: express.Response,
  gate: ReturnType<typeof assertGroupEditable>
): void {
  if (gate.ok) return;
  res.status(gate.status).json({
    code: gate.code,
    messageAr: gate.messageAr,
    error: gate.error,
  });
}

/** GET /customer/order-groups/:orderGroupId/editing-window */
app.get('/customer/order-groups/:orderGroupId/editing-window', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const orderGroupId = String(req.params.orderGroupId ?? '').trim();
  if (!orderGroupId) return res.status(400).json({ error: 'orderGroupId required' });
  const group = await loadCustomerOrderGroup(customer.id, orderGroupId);
  if (group.length === 0) return res.status(404).json({ error: 'Order group not found' });
  res.json(summarizeEditingWindow(group));
}));

/** POST /customer/order-groups/:orderGroupId/send-now — immediate merchant submission */
app.post('/customer/order-groups/:orderGroupId/send-now', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const orderGroupId = String(req.params.orderGroupId ?? '').trim();
  const group = await loadCustomerOrderGroup(customer.id, orderGroupId);
  const gate = assertGroupEditable(group);
  if (!gate.ok) return respondGroupGateError(res, gate);
  const { orders } = await submitOrderGroupToMerchant(orderGroupId, repos, merchantSubmitDeps);
  res.json(summarizeEditingWindow(orders));
}));

/** POST /customer/order-groups/:orderGroupId/cancel — only before merchant submission */
app.post('/customer/order-groups/:orderGroupId/cancel', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const orderGroupId = String(req.params.orderGroupId ?? '').trim();
  const group = await loadCustomerOrderGroup(customer.id, orderGroupId);
  const gate = assertGroupEditable(group);
  if (!gate.ok) return respondGroupGateError(res, gate);
  const now = new Date().toISOString();
  const updated: OrderRecord[] = [];
  for (const o of group) {
    const next: OrderRecord = {
      ...o,
      status: 'CANCELED',
      cancelledBeforeSubmission: true,
      cancelledAt: now,
      revision: readGateFields(o).revision + 1,
    };
    await repos.orders.update(next);
    // DB column claim-path: also set cancelled flag via prisma when available
    if (isStorageDb()) {
      try {
        await prisma.order.updateMany({
          where: { id: String(o.id), submittedAt: null, cancelledBeforeSubmission: false },
          data: { cancelledBeforeSubmission: true, revision: readGateFields(o).revision + 1 },
        });
      } catch (e) {
        console.error('[order-submission-gate] cancel column update failed:', e);
      }
    }
    updated.push(next);
  }
  res.json(summarizeEditingWindow(updated));
}));

/**
 * PATCH /customer/order-groups/:orderGroupId
 * V1: notes, delivery address, quantity / remove items only.
 * Same order IDs / orderGroupId. No new store orders.
 */
app.patch('/customer/order-groups/:orderGroupId', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const orderGroupId = String(req.params.orderGroupId ?? '').trim();
  const group = await loadCustomerOrderGroup(customer.id, orderGroupId);
  const gate = assertGroupEditable(group);
  if (!gate.ok) return respondGroupGateError(res, gate);

  const body = req.body as {
    notes?: string;
    deliveryAddress?: string;
    orders?: { id: string; items?: unknown[]; notes?: string }[];
  };
  const tenants = await repos.tenants.findAll();
  const perOrder = new Map((body.orders ?? []).map((row) => [String(row.id), row]));
  // Reject unknown order ids (do not create new orders)
  for (const id of perOrder.keys()) {
    if (!group.some((o) => String(o.id) === id)) {
      return res.status(400).json({
        code: 'INVALID_ORDER_ID',
        error: 'Cannot add orders to group; V1 edit is limited to existing order lines',
        messageAr: 'لا يمكن إضافة طلبات جديدة للمجموعة في هذه المرحلة.',
      });
    }
  }
  const updated: OrderRecord[] = [];

  for (const o of group) {
    let next: OrderRecord = { ...o };
    if (body.notes !== undefined) next.notes = body.notes;
    if (body.deliveryAddress !== undefined) {
      next.deliveryAddress = body.deliveryAddress;
      const del = { ...((next.delivery as Record<string, unknown>) ?? {}) };
      del.addressText = body.deliveryAddress;
      next.delivery = del;
    }
    const patch = perOrder.get(String(o.id ?? ''));
    if (patch?.notes !== undefined) next.notes = patch.notes;
    if (patch?.items !== undefined) {
      const items = Array.isArray(patch.items) ? patch.items : [];
      if (items.length === 0) {
        return res.status(400).json({
          code: 'EMPTY_ITEMS',
          error: 'Order must retain at least one item',
          messageAr: 'يجب الإبقاء على صنف واحد على الأقل.',
        });
      }
      next.items = items;
      const tenant = tenants.find((t) => t.id === next.tenantId);
      next = await refreshOrderTotalsAfterItemEdit(next, tenant, repos);
    } else {
      next.revision = readGateFields(next).revision + 1;
    }
    await repos.orders.update(next);
    updated.push(next);
  }

  res.json(summarizeEditingWindow(updated));
}));

// --- Contest & Prediction (logged-in customers only; DB/Prisma) ---
class ContestParticipateError extends Error {
  code: string;
  extra?: Record<string, unknown>;
  constructor(code: string, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.name = 'ContestParticipateError';
    this.code = code;
    this.extra = extra;
  }
}

/** Resolves Prisma Customer id for FK writes (coins, redemptions). Handles phone/id drift from JSON repos. */
async function ensureCustomerInPrisma(customer: {
  id: string;
  phone: string;
  name?: string | null;
  createdAt?: string;
}): Promise<string> {
  const full = (await repos.customers.findAll()).find((c) => c.id === customer.id);
  return resolvePrismaCustomerId(prisma, customer, full ?? null);
}

function parseCouponValueFromRewardDescription(description: string | null): {
  type: 'FIXED' | 'PERCENT';
  value: number;
} {
  const desc = (description ?? '').trim();
  const percent = desc.match(/(\d+)\s*%/);
  if (percent) {
    return { type: 'PERCENT', value: Math.min(100, Math.max(1, parseInt(percent[1], 10))) };
  }
  const fixed = desc.match(/(\d+)/);
  if (fixed) {
    return { type: 'FIXED', value: Math.max(1, parseInt(fixed[1], 10)) };
  }
  return { type: 'FIXED', value: 10 };
}

async function createRewardCouponForCustomer(
  reward: { description: string | null },
  customerPhone: string,
  now: string,
): Promise<string> {
  const { type, value } = parseCouponValueFromRewardDescription(reward.description);
  let code = `OBR-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(10 + Math.random() * 90)}`;
  for (let i = 0; i < 8; i++) {
    const exists = await prisma.coupon.findUnique({ where: { code } });
    if (!exists) break;
    code = `OBR-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(10 + Math.random() * 90)}`;
  }
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const phoneNorm = normalizePhoneForCoupon(customerPhone);
  await prisma.coupon.create({
    data: {
      id: `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      code,
      type,
      value,
      tenantId: null,
      storeId: null,
      oneTimeUse: true,
      winnerPhone: phoneNorm || customerPhone,
      usedAt: null,
      createdAt: now,
      expiresAt,
    },
  });
  return code;
}

type ContestRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  options: string | null;
  correctAnswer: string | null;
  isActive: boolean;
  rewardCode: string | null;
  bannerImageUrl: string | null;
  teamAName: string | null;
  teamBName: string | null;
  isPrediction: boolean | null;
  finalScoreA: number | null;
  finalScoreB: number | null;
  expiresAt: string | null;
  coinsCost: number;
  createdAt: string;
};

function contestActiveJson(
  contest: ContestRow,
  participation?: { id: string; isWinner: boolean } | null,
) {
  return {
    id: contest.id,
    title: contest.title,
    description: contest.description,
    type: contest.type,
    options: contest.options ? (JSON.parse(contest.options) as { id: string; label: string }[]) : [],
    rewardCode: contest.rewardCode,
    bannerImageUrl: contest.bannerImageUrl ?? undefined,
    teamAName: contest.teamAName ?? undefined,
    teamBName: contest.teamBName ?? undefined,
    isPrediction: contest.isPrediction ?? false,
    finalScoreA: contest.finalScoreA ?? undefined,
    finalScoreB: contest.finalScoreB ?? undefined,
    expiresAt: contest.expiresAt,
    coinsCost: Math.max(0, contest.coinsCost ?? 0),
    participated: !!participation,
    participationId: participation?.id ?? null,
    participationStatus: participation ? 'PENDING' : null,
  };
}

app.get('/contest/active', wrapAsync(async (req, res) => {
  const now = new Date().toISOString();
  const contest = await prisma.contest.findFirst({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!contest) return res.json(null);
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  let participation: { id: string; isWinner: boolean } | null = null;
  if (customer) {
    const prismaCustomerId = await ensureCustomerInPrisma(customer);
    const row = await prisma.contestParticipation.findUnique({
      where: { customerId_contestId: { customerId: prismaCustomerId, contestId: contest.id } },
      select: { id: true, isWinner: true },
    });
    if (row) participation = row;
  }
  res.json(contestActiveJson(contest as ContestRow, participation));
}));

app.post('/contest/participate', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) {
    return res.status(401).json({ error: 'سجّل الدخول للمتابعة', code: 'LOGIN_REQUIRED' });
  }
  const body = req.body as { contestId?: string; userAnswer?: string; scoreA?: number; scoreB?: number };
  const contestId = String(body?.contestId ?? '').trim();
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest || !contest.isActive) return res.status(404).json({ error: 'Contest not found or inactive' });
  const now = new Date().toISOString();
  if (contest.expiresAt && contest.expiresAt < now) return res.status(400).json({ error: 'Contest has expired' });

  let userAnswer: string;
  let scoreA: number | null = null;
  let scoreB: number | null = null;
  if (contest.isPrediction) {
    const a = typeof body?.scoreA === 'number' ? body.scoreA : parseInt(String(body?.scoreA ?? ''), 10);
    const b = typeof body?.scoreB === 'number' ? body.scoreB : parseInt(String(body?.scoreB ?? ''), 10);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      return res.status(400).json({ error: 'scoreA and scoreB required (non-negative integers) for match prediction' });
    }
    scoreA = a;
    scoreB = b;
    userAnswer = `${scoreA}-${scoreB}`;
  } else {
    userAnswer = String(body?.userAnswer ?? '').trim();
    if (!userAnswer) return res.status(400).json({ error: 'contestId and userAnswer required' });
  }

  const coinsCost = Math.max(0, (contest as { coinsCost?: number }).coinsCost ?? 0);
  const phoneNorm = normalizePhoneForCoupon(customer.phone);
  if (!phoneNorm && coinsCost > 0) return res.status(400).json({ error: 'Phone required' });

  const prismaCustomerId = await ensureCustomerInPrisma(customer);

  const participationId = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dup = await tx.contestParticipation.findUnique({
        where: { customerId_contestId: { customerId: prismaCustomerId, contestId } },
      });
      if (dup) {
        throw new ContestParticipateError('ALREADY_PARTICIPATED', 'Already participated', {
          participationId: dup.id,
        });
      }

      const coinKey = normalizePhoneForCoupon(customer.phone);
      let existingCoin = coinsCost > 0
        ? await tx.customerCoin.findUnique({ where: { customerPhone: coinKey } })
        : null;
      let walletKey = coinKey;
      if (coinsCost > 0 && !existingCoin) {
        for (const variant of customerPhoneLookupVariants(customer.phone)) {
          if (variant === coinKey) continue;
          const legacy = await tx.customerCoin.findUnique({ where: { customerPhone: variant } });
          if (legacy) {
            await tx.customerCoin.update({
              where: { customerPhone: variant },
              data: { customerPhone: coinKey, updatedAt: now },
            });
            existingCoin = { ...legacy, customerPhone: coinKey };
            walletKey = coinKey;
            break;
          }
        }
      }
      const balanceBefore = existingCoin?.balance ?? INITIAL_COINS;
      console.log('[CONTEST_PARTICIPATE]', {
        customerId: customer.id,
        contestId,
        coinsCost,
        balanceBefore,
        status: 'attempt',
      });

      if (coinsCost > 0 && balanceBefore < coinsCost) {
        throw new ContestParticipateError('INSUFFICIENT_COINS', 'Insufficient coins', {
          balance: balanceBefore,
          required: coinsCost,
        });
      }

      let balanceAfter = balanceBefore;
      if (coinsCost > 0) {
        balanceAfter = balanceBefore - coinsCost;
        if (existingCoin) {
          const updated = await tx.customerCoin.updateMany({
            where: { customerPhone: walletKey, balance: { gte: coinsCost } },
            data: { balance: { decrement: coinsCost }, updatedAt: now },
          });
          if (updated.count === 0) {
            throw new ContestParticipateError('INSUFFICIENT_COINS', 'Insufficient coins', {
              balance: balanceBefore,
              required: coinsCost,
            });
          }
        } else {
          await tx.customerCoin.create({
            data: { customerPhone: walletKey, balance: balanceAfter, updatedAt: now },
          });
        }
      }

      const correctAnswer = contest.correctAnswer?.trim();
      const finalA = contest.finalScoreA;
      const finalB = contest.finalScoreB;
      const isWinner = contest.type === 'QUESTION'
        ? !!correctAnswer && userAnswer === correctAnswer
        : contest.isPrediction && finalA != null && finalB != null && scoreA === finalA && scoreB === finalB;

      const participation = await tx.contestParticipation.create({
        data: {
          id: participationId,
          customerId: prismaCustomerId,
          contestId,
          userAnswer,
          scoreA: scoreA ?? undefined,
          scoreB: scoreB ?? undefined,
          isWinner,
          createdAt: now,
        },
      });

      return { participation, balanceAfter, isWinner };
    });

    console.log('[CONTEST_PARTICIPATE]', {
      customerId: customer.id,
      contestId,
      coinsCost,
      balanceBefore: result.balanceAfter + coinsCost,
      balanceAfter: result.balanceAfter,
      status: 'PENDING',
    });

    res.status(201).json({
      participated: true,
      participationId: result.participation.id,
      balance: result.balanceAfter,
      status: 'PENDING',
      isWinner: result.isWinner,
      rewardCode: result.isWinner ? contest.rewardCode : undefined,
      id: result.participation.id,
    });
  } catch (e: unknown) {
    if (e instanceof ContestParticipateError) {
      const messageAr: Record<string, string> = {
        INSUFFICIENT_COINS: 'رصيدك غير كافٍ',
        ALREADY_PARTICIPATED: 'تم الاشتراك مسبقًا',
        LOGIN_REQUIRED: 'سجّل الدخول للمتابعة',
      };
      console.log('[CONTEST_PARTICIPATE]', {
        customerId: customer.id,
        contestId,
        coinsCost,
        balanceBefore: (e.extra?.balance as number | undefined) ?? null,
        balanceAfter: null,
        status: e.code,
      });
      return res.status(400).json({
        error: messageAr[e.code] ?? e.message,
        code: e.code,
        ...e.extra,
      });
    }
    throw e;
  }
}));

app.get('/contest/me', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const prismaCustomerId = await ensureCustomerInPrisma(customer);
  const list = await prisma.contestParticipation.findMany({
    where: { customerId: prismaCustomerId },
    include: { contest: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(list.map((p) => ({ contestId: p.contestId, userAnswer: p.userAnswer, isWinner: p.isWinner, rewardCode: p.contest.rewardCode ?? undefined, createdAt: p.createdAt })));
}));

// --- Admin: Contests CRUD + Enter Result (platform admin) ---
function requireContestAdmin(req: express.Request, res: express.Response): boolean {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function contestToJson(c: {
  id: string;
  title: string;
  description: string | null;
  type: string;
  options: string | null;
  correctAnswer: string | null;
  isActive: boolean;
  rewardCode: string | null;
  bannerImageUrl: string | null;
  teamAName: string | null;
  teamBName: string | null;
  isPrediction: boolean | null;
  finalScoreA: number | null;
  finalScoreB: number | null;
  expiresAt: string | null;
  coinsCost?: number | null;
  createdAt: string;
}) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    type: c.type,
    options: c.options ? JSON.parse(c.options) : [],
    correctAnswer: c.correctAnswer,
    isActive: c.isActive,
    rewardCode: c.rewardCode,
    bannerImageUrl: c.bannerImageUrl ?? undefined,
    teamAName: c.teamAName ?? undefined,
    teamBName: c.teamBName ?? undefined,
    isPrediction: c.isPrediction ?? false,
    finalScoreA: c.finalScoreA ?? undefined,
    finalScoreB: c.finalScoreB ?? undefined,
    expiresAt: c.expiresAt,
    coinsCost: Math.max(0, c.coinsCost ?? 0),
    createdAt: c.createdAt,
  };
}

app.get('/contests', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const list = await prisma.contest.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(list.map(contestToJson));
}));

app.post('/contests', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const body = req.body as { title: string; description?: string; type: 'QUESTION' | 'PREDICTION'; options?: { id: string; label: string }[]; correctAnswer?: string; rewardCode?: string; bannerImageUrl?: string; expiresAt?: string; isPrediction?: boolean; teamAName?: string; teamBName?: string; coinsCost?: number };
  const title = String(body?.title ?? '').trim();
  if (!title) return res.status(400).json({ error: 'title required' });
  const type = body.type === 'PREDICTION' ? 'PREDICTION' : 'QUESTION';
  const isPrediction = !!body?.isPrediction;
  const coinsCost = Math.max(0, Number(body?.coinsCost ?? 0));
  const id = `contest-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  await prisma.contest.create({
    data: {
      id,
      title,
      description: body.description?.trim() ?? null,
      type,
      options: !isPrediction && body.options && body.options.length > 0 ? JSON.stringify(body.options) : null,
      correctAnswer: body.correctAnswer?.trim() ?? null,
      isActive: true,
      rewardCode: body.rewardCode?.trim() ?? null,
      bannerImageUrl: body.bannerImageUrl?.trim() || null,
      teamAName: body.teamAName?.trim() || null,
      teamBName: body.teamBName?.trim() || null,
      isPrediction,
      expiresAt: body.expiresAt?.trim() || null,
      coinsCost,
      createdAt: now,
    },
  });
  const c = await prisma.contest.findUnique({ where: { id } });
  res.status(201).json(c ? contestToJson(c) : { id });
}));

app.put('/contests/:id', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  const body = req.body as { title?: string; description?: string; options?: { id: string; label: string }[]; correctAnswer?: string; isActive?: boolean; rewardCode?: string; bannerImageUrl?: string; expiresAt?: string; isPrediction?: boolean; teamAName?: string; teamBName?: string; finalScoreA?: number; finalScoreB?: number; coinsCost?: number };
  const existing = await prisma.contest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Contest not found' });
  await prisma.contest.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
      ...(body.options !== undefined && { options: body.options?.length ? JSON.stringify(body.options) : null }),
      ...(body.correctAnswer !== undefined && { correctAnswer: body.correctAnswer?.trim() ?? null }),
      ...(body.isActive !== undefined && { isActive: !!body.isActive }),
      ...(body.rewardCode !== undefined && { rewardCode: body.rewardCode?.trim() ?? null }),
      ...(body.bannerImageUrl !== undefined && { bannerImageUrl: body.bannerImageUrl?.trim() || null }),
      ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt?.trim() || null }),
      ...(body.isPrediction !== undefined && { isPrediction: !!body.isPrediction }),
      ...(body.teamAName !== undefined && { teamAName: body.teamAName?.trim() || null }),
      ...(body.teamBName !== undefined && { teamBName: body.teamBName?.trim() || null }),
      ...(body.finalScoreA !== undefined && { finalScoreA: Number.isInteger(body.finalScoreA) ? body.finalScoreA : null }),
      ...(body.finalScoreB !== undefined && { finalScoreB: Number.isInteger(body.finalScoreB) ? body.finalScoreB : null }),
      ...(body.coinsCost !== undefined && { coinsCost: Math.max(0, Number(body.coinsCost)) }),
    },
  });
  const c = await prisma.contest.findUnique({ where: { id } });
  res.json(c ? contestToJson(c) : { id });
}));

app.delete('/contests/:id', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  await prisma.contest.delete({ where: { id } }).catch((e: { code?: string }) => {
    if (e.code === 'P2025') return null;
    throw e;
  });
  res.status(204).end();
}));

/** Public catalog for customer app: active rewards, not expired, in stock. */
function rewardToPublicJson(r: {
  id: string;
  titleAr: string;
  titleEn: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  coinsCost: number;
  stockLimit: number;
  expiryDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: r.id,
    title_ar: r.titleAr,
    title_en: r.titleEn,
    description: r.description ?? undefined,
    image_url: r.imageUrl ?? undefined,
    type: r.type,
    coins_cost: r.coinsCost,
    stock_limit: r.stockLimit,
    expiry_date: r.expiryDate ?? undefined,
    is_active: r.isActive,
    created_at: r.createdAt,
  };
}

function rewardToAdminJson(r: {
  id: string;
  titleAr: string;
  titleEn: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  coinsCost: number;
  stockLimit: number;
  expiryDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: r.id,
    titleAr: r.titleAr,
    titleEn: r.titleEn,
    description: r.description ?? '',
    imageUrl: r.imageUrl ?? '',
    type: r.type,
    coinsCost: r.coinsCost,
    stockLimit: r.stockLimit,
    expiryDate: r.expiryDate ?? '',
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function isRewardType(t: string): t is 'COUPON' | 'EVENT' | 'PRIZE' | 'TOURNAMENT' {
  return t === 'COUPON' || t === 'EVENT' || t === 'PRIZE' || t === 'TOURNAMENT';
}

class RewardRedeemError extends Error {
  constructor(
    public code: 'INSUFFICIENT_COINS' | 'ALREADY_REDEEMED' | 'SOLD_OUT',
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RewardRedeemError';
  }
}

/** GET /rewards — public catalog; includes locked (expired / sold out) for storefront overlays. */
app.get('/rewards', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  const customerRedemptions = new Map<string, { status: string; id: string }>();
  if (customer) {
    const prismaCustomerId = await ensureCustomerInPrisma(customer);
    const reds = await prisma.rewardRedemption.findMany({
      where: { customerId: prismaCustomerId, status: { in: ['PENDING', 'COMPLETED'] } },
      select: { rewardId: true, status: true, id: true },
    });
    for (const row of reds) {
      customerRedemptions.set(row.rewardId, { status: row.status, id: row.id });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = await prisma.globalReward.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  const out: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    if (r.stockLimit < 0) continue;
    let locked = false;
    let lock_reason: 'EXPIRED' | 'SOLD_OUT' | null = null;
    if (r.expiryDate) {
      const exp = r.expiryDate.slice(0, 10);
      if (exp < today) {
        locked = true;
        lock_reason = 'EXPIRED';
      }
    }
    if (!locked && r.stockLimit > 0) {
      const used = await prisma.rewardRedemption.count({
        where: { rewardId: r.id, status: { in: ['PENDING', 'COMPLETED'] } },
      });
      if (used >= r.stockLimit) {
        locked = true;
        lock_reason = 'SOLD_OUT';
      }
    }
    const redemption = customer ? customerRedemptions.get(r.id) : undefined;
    out.push({
      ...rewardToPublicJson(r),
      locked,
      lock_reason,
      ...(customer
        ? {
            redeemed: !!redemption,
            redemption_status: redemption?.status ?? null,
            redemption_id: redemption?.id ?? null,
          }
        : {}),
    } as Record<string, unknown>);
  }
  res.json(out);
}));

/** GET /rewards/:rewardId — single reward for detail/debug (public catalog item). */
app.get('/rewards/:rewardId', wrapAsync(async (req, res) => {
  const rewardId = String(req.params.rewardId ?? '').trim();
  const reward = rewardId
    ? await prisma.globalReward.findUnique({ where: { id: rewardId } })
    : null;
  const found = !!(reward && reward.isActive);
  console.log('[REWARD_DETAILS]', {
    rewardId,
    found,
    payload: reward ? rewardToPublicJson(reward) : null,
  });
  if (!found || !reward) {
    return res.status(404).json({ error: 'Reward not found' });
  }
  res.json(rewardToPublicJson(reward));
}));

/** GET /admin/rewards — platform admin full list. */
app.get('/admin/rewards', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const rows = await prisma.globalReward.findMany({ orderBy: { createdAt: 'desc' } });
  const counts = await prisma.rewardRedemption.groupBy({
    by: ['rewardId'],
    where: { status: { in: ['PENDING', 'COMPLETED'] } },
    _count: { id: true },
  });
  const countByRewardId = Object.fromEntries(counts.map((c) => [c.rewardId, c._count.id]));
  res.json(
    rows.map((r) => ({
      ...rewardToAdminJson(r),
      participantCount: countByRewardId[r.id] ?? 0,
    }))
  );
}));

app.post('/admin/rewards', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const body = req.body as {
    titleAr?: string;
    titleEn?: string;
    description?: string;
    imageUrl?: string;
    type?: string;
    coinsCost?: number;
    stockLimit?: number;
    expiryDate?: string;
    isActive?: boolean;
  };
  const titleAr = String(body?.titleAr ?? '').trim();
  const titleEn = String(body?.titleEn ?? '').trim();
  if (!titleAr || !titleEn) return res.status(400).json({ error: 'titleAr and titleEn required' });
  const typeRaw = String(body?.type ?? 'COUPON').trim();
  if (!isRewardType(typeRaw)) return res.status(400).json({ error: 'Invalid type' });
  const coinsCost = Math.max(0, Number(body?.coinsCost ?? 0));
  const stockLimit = Math.max(0, Number(body?.stockLimit ?? 0));
  const id = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  await prisma.globalReward.create({
    data: {
      id,
      titleAr,
      titleEn,
      description: body.description?.trim() || null,
      imageUrl: body.imageUrl?.trim() || null,
      type: typeRaw,
      coinsCost,
      stockLimit,
      expiryDate: body.expiryDate?.trim() || null,
      isActive: body.isActive !== false,
      createdAt: now,
      updatedAt: now,
    },
  });
  const row = await prisma.globalReward.findUnique({ where: { id } });
  res.status(201).json(row ? rewardToAdminJson(row) : { id });
}));

app.patch('/admin/rewards/:id', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  const body = req.body as {
    titleAr?: string;
    titleEn?: string;
    description?: string;
    imageUrl?: string;
    type?: string;
    coinsCost?: number;
    stockLimit?: number;
    expiryDate?: string | null;
    isActive?: boolean;
  };
  const existing = await prisma.globalReward.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Reward not found' });
  if (body.type !== undefined && !isRewardType(String(body.type))) return res.status(400).json({ error: 'Invalid type' });
  const now = new Date().toISOString();
  await prisma.globalReward.update({
    where: { id },
    data: {
      ...(body.titleAr !== undefined && { titleAr: String(body.titleAr).trim() }),
      ...(body.titleEn !== undefined && { titleEn: String(body.titleEn).trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl?.trim() || null }),
      ...(body.type !== undefined && { type: String(body.type).trim() }),
      ...(body.coinsCost !== undefined && { coinsCost: Math.max(0, Number(body.coinsCost)) }),
      ...(body.stockLimit !== undefined && { stockLimit: Math.max(0, Number(body.stockLimit)) }),
      ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate?.trim() ? body.expiryDate.trim() : null }),
      ...(body.isActive !== undefined && { isActive: !!body.isActive }),
      updatedAt: now,
    },
  });
  const row = await prisma.globalReward.findUnique({ where: { id } });
  res.json(row ? rewardToAdminJson(row) : { id });
}));

app.delete('/admin/rewards/:id', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  await prisma.globalReward.delete({ where: { id } }).catch((e: { code?: string }) => {
    if (e.code === 'P2025') return null;
    throw e;
  });
  res.status(204).end();
}));

/** Customer joins / redeems a global reward: checks balance, deducts coins, creates PENDING redemption. */
async function handleRewardRedeem(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) {
    res.status(401).json({ error: 'سجّل الدخول للمتابعة', code: 'LOGIN_REQUIRED' });
    return;
  }
  const rewardId = req.params.rewardId;
  if (!rewardId) {
    res.status(400).json({ error: 'rewardId required' });
    return;
  }

  const reward = await prisma.globalReward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.isActive) {
    res.status(404).json({ error: 'Reward not found or inactive' });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (reward.expiryDate) {
    const exp = reward.expiryDate.slice(0, 10);
    if (exp < today) {
      res.status(400).json({ error: 'Reward expired', code: 'EXPIRED' });
      return;
    }
  }

  const coinsCost = Math.max(0, reward.coinsCost);
  const phoneNorm = normalizePhoneForCoupon(customer.phone);
  if (!phoneNorm) {
    res.status(400).json({ error: 'Phone required' });
    return;
  }

  const now = new Date().toISOString();
  const redemptionId = `rred-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const prismaCustomerId = await ensureCustomerInPrisma(customer);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dup = await tx.rewardRedemption.findFirst({
        where: { customerId: prismaCustomerId, rewardId, status: { in: ['PENDING', 'COMPLETED'] } },
      });
      if (dup) {
        throw new RewardRedeemError('ALREADY_REDEEMED', 'Already redeemed this reward');
      }

      if (reward.stockLimit > 0) {
        const usedSlots = await tx.rewardRedemption.count({
          where: { rewardId, status: { in: ['PENDING', 'COMPLETED'] } },
        });
        if (usedSlots >= reward.stockLimit) {
          throw new RewardRedeemError('SOLD_OUT', 'Reward is out of stock');
        }
      }

      const coinKey = normalizePhoneForCoupon(customer.phone);
      let existingCoin = await tx.customerCoin.findUnique({ where: { customerPhone: coinKey } });
      let walletKey = coinKey;
      if (!existingCoin) {
        for (const variant of customerPhoneLookupVariants(customer.phone)) {
          if (variant === coinKey) continue;
          const legacy = await tx.customerCoin.findUnique({ where: { customerPhone: variant } });
          if (legacy) {
            await tx.customerCoin.update({
              where: { customerPhone: variant },
              data: { customerPhone: coinKey, updatedAt: now },
            });
            existingCoin = { ...legacy, customerPhone: coinKey };
            walletKey = coinKey;
            break;
          }
        }
      }
      const currentBalance = existingCoin?.balance ?? INITIAL_COINS;
      console.log('[REWARD_REDEEM]', {
        customerId: customer.id,
        rewardId,
        coinsCost,
        balanceBefore: currentBalance,
        status: 'attempt',
        phoneNorm: walletKey,
      });
      if (currentBalance < coinsCost) {
        throw new RewardRedeemError('INSUFFICIENT_COINS', 'Insufficient coins', {
          balance: currentBalance,
          required: coinsCost,
        });
      }

      const newBalance = currentBalance - coinsCost;
      if (existingCoin) {
        const updated = await tx.customerCoin.updateMany({
          where: { customerPhone: walletKey, balance: { gte: coinsCost } },
          data: { balance: { decrement: coinsCost }, updatedAt: now },
        });
        if (updated.count === 0) {
          throw new RewardRedeemError('INSUFFICIENT_COINS', 'Insufficient coins', {
            balance: currentBalance,
            required: coinsCost,
          });
        }
      } else {
        await tx.customerCoin.create({
          data: { customerPhone: walletKey, balance: newBalance, updatedAt: now },
        });
      }

      await tx.rewardRedemption.create({
        data: {
          id: redemptionId,
          customerId: prismaCustomerId,
          rewardId,
          status: 'PENDING',
          coinsSpent: coinsCost,
          redeemedAt: now,
          updatedAt: now,
        },
      });

      return { redemptionId, newBalance, now };
    });

    let couponCode: string | undefined;
    if (reward.type === 'COUPON') {
      couponCode = await createRewardCouponForCustomer(reward, customer.phone, now);
    }

    console.log('[REWARD_REDEEM]', {
      customerId: prismaCustomerId,
      rewardId,
      coinsCost,
      balanceBefore: result.newBalance + coinsCost,
      status: 'PENDING',
      balanceAfter: result.newBalance,
      couponCode: couponCode ?? null,
    });

    res.status(201).json({
      success: true,
      id: result.redemptionId,
      rewardRedemptionId: result.redemptionId,
      rewardId,
      status: 'PENDING',
      coinsSpent: coinsCost,
      balance: result.newBalance,
      remainingCoins: result.newBalance,
      redeemedAt: result.now,
      redeemed: true,
      redemption_status: 'PENDING',
      ...(couponCode ? { couponCode } : {}),
    });
  } catch (e: unknown) {
    if (e instanceof RewardRedeemError) {
      const statusMap: Record<string, string> = {
        INSUFFICIENT_COINS: 'INSUFFICIENT',
        ALREADY_REDEEMED: 'ALREADY_REDEEMED',
        SOLD_OUT: 'SOLD_OUT',
      };
      console.log('[REWARD_REDEEM]', {
        customerId: prismaCustomerId,
        rewardId,
        coinsCost,
        balanceBefore: (e.extra?.balance as number | undefined) ?? null,
        status: statusMap[e.code] ?? e.code,
        balanceAfter: null,
      });
      const messageAr: Record<string, string> = {
        INSUFFICIENT_COINS: 'رصيدك غير كافٍ',
        ALREADY_REDEEMED: 'سبق أن شاركت في هذه المكافأة',
        SOLD_OUT: 'نفدت الكمية المتاحة',
      };
      res.status(400).json({
        success: false,
        error: messageAr[e.code] ?? e.message,
        code: e.code,
        ...e.extra,
      });
      return;
    }
    console.error('[REWARD_REDEEM] unhandled', e);
    res.status(500).json({ success: false, error: 'تعذّر إتمام الاستبدال' });
  }
}

app.post('/customer/rewards/:rewardId/redeem', wrapAsync(handleRewardRedeem));
app.post('/rewards/:rewardId/redeem', wrapAsync(handleRewardRedeem));

function redemptionToAdminRow(r: {
  id: string;
  customerId: string;
  rewardId: string;
  status: string;
  coinsSpent: number;
  redeemedAt: string;
  updatedAt: string | null;
  customer: { id: string; phone: string; name: string | null };
  reward: { id: string; titleAr: string; titleEn: string; type: string };
}) {
  return {
    id: r.id,
    customerId: r.customerId,
    customerName: r.customer.name?.trim() || '—',
    customerPhone: r.customer.phone,
    rewardId: r.rewardId,
    rewardTitleAr: r.reward.titleAr,
    rewardTitleEn: r.reward.titleEn,
    type: r.reward.type,
    coinsSpent: r.coinsSpent,
    redeemedAt: r.redeemedAt,
    status: r.status,
    updatedAt: r.updatedAt ?? undefined,
  };
}

/** Admin: list reward redemptions (participants log). */
app.get('/admin/reward-redemptions', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const rewardId = typeof req.query.rewardId === 'string' ? req.query.rewardId.trim() : '';
  const rows = await prisma.rewardRedemption.findMany({
    where: rewardId ? { rewardId } : undefined,
    include: {
      customer: { select: { id: true, phone: true, name: true } },
      reward: { select: { id: true, titleAr: true, titleEn: true, type: true } },
    },
    orderBy: { redeemedAt: 'desc' },
  });
  res.json(rows.map(redemptionToAdminRow));
}));

/** Admin: update status (e.g. mark COMPLETED when user attends; CANCELLED refunds coins). */
app.patch('/admin/reward-redemptions/:id', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  const body = req.body as { status?: string };
  const next = String(body?.status ?? '').toUpperCase();
  if (next !== 'COMPLETED' && next !== 'CANCELLED' && next !== 'PENDING') {
    return res.status(400).json({ error: 'status must be PENDING, COMPLETED, or CANCELLED' });
  }

  const existing = await prisma.rewardRedemption.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!existing) return res.status(404).json({ error: 'Redemption not found' });

  if (existing.status === next) {
    const full = await prisma.rewardRedemption.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, phone: true, name: true } },
        reward: { select: { id: true, titleAr: true, titleEn: true, type: true } },
      },
    });
    return res.json(full ? redemptionToAdminRow(full) : { error: 'not found' });
  }

  const now = new Date().toISOString();
  const phoneNorm = normalizePhoneForCoupon(existing.customer.phone);

  /** Refund coins only when cancelling a pending reservation (not after COMPLETED). */
  if (next === 'CANCELLED' && existing.status === 'PENDING') {
    const refund = Math.max(0, existing.coinsSpent);
    if (refund > 0 && phoneNorm) {
      const coinRow = await prisma.customerCoin.findUnique({ where: { customerPhone: phoneNorm } });
      const bal = (coinRow?.balance ?? INITIAL_COINS) + refund;
      if (coinRow) {
        await prisma.customerCoin.update({
          where: { customerPhone: phoneNorm },
          data: { balance: bal, updatedAt: now },
        });
      } else {
        await prisma.customerCoin.create({
          data: { customerPhone: phoneNorm, balance: bal, updatedAt: now },
        });
      }
      console.log('[coins-audit] ADD', {
        customerPhone: phoneNorm,
        amount: refund,
        newBalance: bal,
        via: 'reward_redemption_refund',
        redemptionId: id,
      });
    }
  }

  await prisma.rewardRedemption.update({
    where: { id },
    data: { status: next, updatedAt: now },
  });

  const updated = await prisma.rewardRedemption.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, phone: true, name: true } },
      reward: { select: { id: true, titleAr: true, titleEn: true, type: true } },
    },
  });
  res.json(updated ? redemptionToAdminRow(updated) : { id });
}));

/** Admin: CSV export of participants (optional ?rewardId=). */
app.get('/admin/reward-redemptions/export.csv', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const rewardId = typeof req.query.rewardId === 'string' ? req.query.rewardId.trim() : '';
  const rows = await prisma.rewardRedemption.findMany({
    where: rewardId ? { rewardId } : undefined,
    include: {
      customer: { select: { id: true, phone: true, name: true } },
      reward: { select: { id: true, titleAr: true, titleEn: true, type: true } },
    },
    orderBy: { redeemedAt: 'desc' },
  });

  const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ['User Name', 'Phone', 'Reward (AR)', 'Reward (EN)', 'Type', 'Coins Spent', 'Date', 'Status'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const row = redemptionToAdminRow(r);
    lines.push(
      [
        escape(row.customerName),
        escape(row.customerPhone),
        escape(row.rewardTitleAr),
        escape(row.rewardTitleEn),
        escape(row.type),
        String(row.coinsSpent),
        escape(row.redeemedAt),
        escape(row.status),
      ].join(',')
    );
  }
  const csv = '\uFEFF' + lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="reward-participants.csv"');
  res.send(csv);
}));

app.post('/contests/:id/result', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  const body = req.body as { correctAnswer?: string; finalScoreA?: number; finalScoreB?: number };
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  if (contest.type !== 'PREDICTION') return res.status(400).json({ error: 'Only PREDICTION contests can have result set' });

  if (contest.isPrediction) {
    const finalScoreA = typeof body?.finalScoreA === 'number' ? body.finalScoreA : parseInt(String(body?.finalScoreA ?? ''), 10);
    const finalScoreB = typeof body?.finalScoreB === 'number' ? body.finalScoreB : parseInt(String(body?.finalScoreB ?? ''), 10);
    if (!Number.isInteger(finalScoreA) || !Number.isInteger(finalScoreB) || finalScoreA < 0 || finalScoreB < 0) return res.status(400).json({ error: 'finalScoreA and finalScoreB required (non-negative integers) for match prediction' });
    const correctAnswer = `${finalScoreA}-${finalScoreB}`;
    await prisma.contest.update({ where: { id }, data: { correctAnswer, finalScoreA, finalScoreB } });
    const updated = await prisma.contestParticipation.updateMany({
      where: { contestId: id, scoreA: finalScoreA, scoreB: finalScoreB },
      data: { isWinner: true },
    });
    return res.json({ correctAnswer, finalScoreA, finalScoreB, winnersCount: updated.count });
  }

  const correctAnswer = String(body?.correctAnswer ?? '').trim();
  if (!correctAnswer) return res.status(400).json({ error: 'correctAnswer required' });
  await prisma.contest.update({ where: { id }, data: { correctAnswer } });
  const updated = await prisma.contestParticipation.updateMany({
    where: { contestId: id, userAnswer: correctAnswer },
    data: { isWinner: true },
  });
  res.json({ correctAnswer, winnersCount: updated.count });
}));

app.get('/contests/:id/participations', wrapAsync(async (req, res) => {
  if (!requireContestAdmin(req, res)) return;
  const { id } = req.params;
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  const list = await prisma.contestParticipation.findMany({ where: { contestId: id }, orderBy: { createdAt: 'desc' } });
  const customerIds = [...new Set(list.map((p) => p.customerId))];
  const customerRows = customerIds.length > 0
    ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, phone: true, name: true } })
    : [];
  const customerById = Object.fromEntries(customerRows.map((c) => [c.id, c]));
  const rows = list.map((p) => {
    const c = customerById[p.customerId];
    return { id: p.id, customerId: p.customerId, customerPhone: c?.phone, customerName: c?.name ?? undefined, userAnswer: p.userAnswer, scoreA: p.scoreA ?? undefined, scoreB: p.scoreB ?? undefined, isWinner: p.isWinner, createdAt: p.createdAt };
  });
  res.json({
    contest: { id: contest.id, title: contest.title, type: contest.type, correctAnswer: contest.correctAnswer, isPrediction: contest.isPrediction ?? false, finalScoreA: contest.finalScoreA ?? undefined, finalScoreB: contest.finalScoreB ?? undefined },
    participations: rows,
  });
}));

/** Premium promotional contest draws — Super Admin only. ContestParticipation source only. */
registerContestDrawRoutes(app, { prisma });

// --- Coupons (winner / promo codes; validate at checkout) ---
function normalizePhoneForCoupon(phone: string | undefined): string {
  return normalizeCustomerPhoneKey(phone);
}


app.get('/coupons/validate', wrapAsync(async (req, res) => {
  const code = (req.query.code as string)?.trim()?.toUpperCase();
  const tenantId = (req.query.tenantId as string)?.trim() || undefined;
  const cartStoreIds = (req.query.cartStoreIds as string)?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const subtotal = Number(req.query.subtotal) || 0;
  const customerPhone = normalizePhoneForCoupon(req.query.customerPhone as string);

  if (!code) return res.status(400).json({ valid: false, error: 'code required' });

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return res.json({ valid: false, error: 'الكود غير صحيح' });
  if (coupon.usedAt) return res.json({ valid: false, error: 'الكود مستخدم مسبقاً' });
  if (coupon.expiresAt && coupon.expiresAt < new Date().toISOString()) return res.json({ valid: false, error: 'انتهت صلاحية الكود' });
  if (coupon.tenantId && tenantId && coupon.tenantId !== tenantId) return res.json({ valid: false, error: 'الكود غير صالح لهذا المتجر' });

  if (coupon.storeId) {
    const allStoreIds = cartStoreIds.length > 0 ? cartStoreIds : (tenantId ? [tenantId] : []);
    if (allStoreIds.length > 0 && !allStoreIds.includes(coupon.storeId)) {
      const store = await prisma.tenant.findUnique({ where: { id: coupon.storeId }, select: { name: true } }).catch(() => null);
      const storeName = store?.name ?? coupon.storeId;
      return res.json({ valid: false, error: `هذا الكود صالح فقط لمتجر ${storeName}` });
    }
  }

  if (coupon.oneTimeUse && coupon.winnerPhone) {
    const normalized = normalizePhoneForCoupon(coupon.winnerPhone);
    if (normalized && customerPhone && normalized !== customerPhone) return res.json({ valid: false, error: 'الكود غير صالح لهذا الرقم' });
  }

  let discountAmount = 0;
  if (coupon.type === 'FIXED') discountAmount = Math.min(Number(coupon.value), subtotal);
  else if (coupon.type === 'PERCENT') discountAmount = Math.min((subtotal * Number(coupon.value)) / 100, subtotal);
  if (discountAmount <= 0) return res.json({ valid: false, error: 'الحد الأدنى للطلب غير محقق' });

  res.json({
    valid: true,
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value, discountAmount, storeId: coupon.storeId ?? undefined },
  });
}));

/** Server-authoritative checkout totals for storefront/Flutter (platform fee hidden in merchandise amount). */
app.post('/customer/pricing/quote', wrapAsync(async (req, res) => {
  const body = req.body as { stores?: CheckoutPricingStoreInput[]; deliveryFee?: number };
  const stores = Array.isArray(body.stores) ? body.stores : [];
  if (stores.length === 0) {
    return res.status(400).json({ error: 'stores required' });
  }
  for (const s of stores) {
    if (!s?.tenantId || typeof s.tenantId !== 'string') {
      return res.status(400).json({ error: 'each store requires tenantId' });
    }
  }

  const allTenants = (await repos.tenants.findAll()) as RegistryTenant[];
  const allMarkets = (await repos.markets.findAll()) as Market[];
  const marketById = new Map(allMarkets.map((m) => [m.id, m]));

  const quote = computeCheckoutPricingQuote(
    { stores, deliveryFee: Number(body.deliveryFee) || 0 },
    (tenantId) => {
      const tenant = allTenants.find((t) => t.id === tenantId);
      const market = tenant?.marketId ? marketById.get(tenant.marketId) : undefined;
      return {
        marketFeeConfig: market?.platformFeeConfig,
        tenantFeeOverride: tenant?.financialConfig?.platformFee,
      };
    }
  );

  res.json(quote);
}));

/** Reprice a single merchant line amount (product page with options). */
app.post('/customer/pricing/line', wrapAsync(async (req, res) => {
  const body = req.body as { tenantId?: string; baseAmount?: number; quantity?: number; itemCount?: number };
  const tenantId = String(body.tenantId ?? '').trim();
  const baseAmount = Number(body.baseAmount) || 0;
  const quantity = Math.max(1, Number(body.quantity) || 1);
  const itemCount = Math.max(0, Math.floor(Number(body.itemCount ?? quantity) || 0));
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

  const ctx = await resolveTenantPricingContext(tenantId);
  const result = computeMarketplaceDisplayPricing(
    [{ baseAmount, quantity, itemCount: itemCount || quantity }],
    ctx
  );
  const line = result.lines[0];
  res.json({
    baseAmount: line?.baseAmount ?? baseAmount,
    displayAmount: line?.displayAmount ?? baseAmount,
    displayUnitPrice: line?.displayUnitPrice ?? baseAmount / quantity,
    platformFeeApplied: isPlatformFeeEnabled() && result.platformFee > 0,
  });
}));

/** Reprice cart lines (merchant base amounts in, customer display amounts out). */
app.post('/customer/pricing/cart', wrapAsync(async (req, res) => {
  const body = req.body as {
    tenantId?: string;
    lines?: Array<{ lineId?: string; baseAmount?: number; quantity?: number; itemCount?: number }>;
    discountAmount?: number;
  };
  const tenantId = String(body.tenantId ?? '').trim();
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!tenantId || lines.length === 0) {
    return res.status(400).json({ error: 'tenantId and lines required' });
  }
  const ctx = await resolveTenantPricingContext(tenantId);
  const mapped = lines.map((l) => ({
    lineId: l.lineId,
    baseAmount: Number(l.baseAmount) || 0,
    quantity: Math.max(1, Number(l.quantity) || 1),
    itemCount: Math.max(0, Math.floor(Number(l.itemCount ?? l.quantity) || 0)),
  }));
  const result = computeMarketplaceDisplayPricing(mapped, ctx, {
    discountAmount: Number(body.discountAmount) || 0,
  });
  res.json(result);
}));

app.get('/customer/rewards', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const phoneNorm = normalizePhoneForCoupon(customer.phone);
  if (!phoneNorm) return res.json([]);

  const now = new Date().toISOString();
  const list = await prisma.coupon.findMany({
    where: {
      winnerPhone: { not: null },
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
  });
  const forCustomer = list.filter((c) => normalizePhoneForCoupon(c.winnerPhone ?? '') === phoneNorm);
  res.json(forCustomer.map((c) => ({ id: c.id, code: c.code, type: c.type, value: c.value, expiresAt: c.expiresAt ?? undefined })));
}));

// --- Customer Now Coins (Lucky Wheel; backend persistence) ---
const SPIN_COST = 10;
const hypHostedHtmlPages = new Map<string, { html: string; expiresAt: number }>();

function extractFirstHttpUrlFromHtml(html: string): string | null {
  const m = html.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

function saveHostedPaymentHtml(base: string, html: string, orderGroupId: string): string {
  const id = `hyp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  hypHostedHtmlPages.set(id, { html, expiresAt: Date.now() + 10 * 60 * 1000 });
  return `${base}/payments/hyp/hosted/${encodeURIComponent(id)}?orderGroupId=${encodeURIComponent(orderGroupId)}`;
}

/** If client sent Bearer JWT, append `token=` for mock-api hosted/demo URLs (WebViews may drop headers on redirect). */
function withPaymentWebViewToken(req: express.Request, paymentUrl: string): string {
  const auth = req.headers.authorization?.trim();
  const token = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return paymentUrl;
  try {
    const u = new URL(paymentUrl);
    if (!u.pathname.includes('/payments/hyp/demo') && !u.pathname.includes('/payments/hyp/hosted/')) {
      return paymentUrl;
    }
    u.searchParams.set('token', token);
    return u.toString();
  } catch {
    return paymentUrl;
  }
}

app.get('/customer/coins', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { row, key } = await findCustomerCoinRow(prisma, customer.phone);
    const balance = row?.balance ?? INITIAL_COINS;
    console.log('[COINS_READ]', {
      jwtCustomerId: customer.id,
      phone: customer.phone,
      walletKey: key,
      balance,
    });
    return res.json({ balance, spinCost: SPIN_COST });
  } catch {
    return res.json({ balance: INITIAL_COINS, spinCost: SPIN_COST });
  }
}));

/** Start Hyp hosted payment: returns one-time CreditGuard URL (redirect / WebView). */
app.post('/customer/payments/hyp/session', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body as { orderGroupId?: string };
  const orderGroupId = body.orderGroupId != null ? String(body.orderGroupId).trim() : '';
  if (!orderGroupId) return res.status(400).json({ error: 'orderGroupId required' });

  const demoModeEnabled = String(process.env.HYP_DEMO_MODE ?? '0').toLowerCase() !== '0';
  const buildDemoUrl = (base: string, groupId: string) =>
    `${base}/payments/hyp/demo?orderGroupId=${encodeURIComponent(groupId)}`;

  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  const mine = orders.filter(
    (o) =>
      String((o as { orderGroupId?: string }).orderGroupId ?? '') === orderGroupId &&
      String((o as { customerId?: string }).customerId ?? '') === customer.id
  );
  if (mine.length === 0) return res.status(404).json({ error: 'No orders for this group or access denied' });
  const allTenants = await repos.tenants.findAll();
  const cardDisabledTenant = mine.find((o) => {
    const tid = String((o as { tenantId?: string }).tenantId ?? '');
    const tenant = allTenants.find((t) => t.id === tid);
    if (!tenant) return false;
    const payment = resolvePaymentMethodsForTenant(tenant);
    return payment.card !== true;
  });
  if (cardDisabledTenant) {
    return res.status(403).json({
      error: 'CARD_PAYMENT_DISABLED',
      details: 'Card payment is disabled globally or for this store.',
    });
  }

  let totalAg = 0;
  for (const o of mine) {
    const t = Number((o as { total?: number }).total);
    if (Number.isFinite(t)) totalAg += Math.round(t * 100);
  }
  if (totalAg <= 0) return res.status(400).json({ error: 'Invalid order total' });

  const hypCfg = loadHypConfigDiagnostics();
  const cfg = hypCfg.config;
  const base = getPublicApiBaseUrl();
  if (hypCfg.missingKeys.length > 0) {
    console.warn('[Hyp] session starting with missing keys (forcing relay attempt):', hypCfg.missingKeys.join(', '));
  }

  const successUrl = `nmdcustomer://payment-success?orderGroupId=${encodeURIComponent(orderGroupId)}&paymentStatus=success`;
  const errorUrl = `nmdcustomer://payment-cancel?orderGroupId=${encodeURIComponent(orderGroupId)}&paymentStatus=error`;
  const cancelUrl = `nmdcustomer://payment-cancel?orderGroupId=${encodeURIComponent(orderGroupId)}&paymentStatus=cancel`;

  const tenantInstallmentOptions = mine
    .map((o) => String((o as { tenantId?: string }).tenantId ?? ''))
    .map((tid) => allTenants.find((t) => t.id === tid))
    .filter((t): t is RegistryTenant => Boolean(t))
    .flatMap((t) => {
      const caps = (t.paymentCapabilities ?? {}) as {
        allowInstallments?: boolean;
        installmentOptions?: number[];
      };
      if (!caps.allowInstallments) return [];
      const opts = Array.isArray(caps.installmentOptions) ? caps.installmentOptions : [3, 6, 12];
      return opts;
    });

  const xml = buildDoDealPaymentPageXml({
    terminalNumber: cfg.terminalNumber,
    mid: cfg.mid,
    totalAgorot: totalAg,
    uniqueId: orderGroupId,
    successUrl,
    errorUrl,
    cancelUrl,
    language: 'HEB',
    installmentOptions: tenantInstallmentOptions,
  });

  const maskTail = (v: string, keep = 3) => {
    const s = String(v ?? '');
    if (!s) return '';
    if (s.length <= keep) return '*'.repeat(s.length);
    return `${'*'.repeat(Math.max(0, s.length - keep))}${s.slice(-keep)}`;
  };
  console.log('[Hyp] Session relay preflight', {
    mode: String(process.env.HYP_DEMO_MODE ?? ''),
    relayUrl: cfg.relayBaseUrl,
    terminal: maskTail(cfg.terminalNumber, 3),
    mid: maskTail(cfg.mid, 3),
    apiUser: maskTail(cfg.apiUser, 3),
    hasToken: Boolean(process.env.HYP_TOKEN?.trim()),
    missingKeys: hypCfg.missingKeys,
  });

  const { ok, status: httpStatus, bodyText } = await requestHypHostedPage(cfg, xml);
  const parsed = parseDoDealResponse(bodyText);
  const looksLikeHtml = /^\s*</.test(bodyText) && /<(html|form|script|body)\b/i.test(bodyText);
  // Strict direct-bank mode: use ONLY provider paymentUrl, never wrap in local /payments/hyp/hosted.
  const effectiveUrl = parsed.paymentUrl;
  const looksLikeGatewayLoginPage =
    looksLikeHtml && /(login|password|sign[ -]?in|user ?name|yaad|hyp|creditguard)/i.test(bodyText);

  if (ok && effectiveUrl) {
    return res.json({
      success: true,
      paymentUrl: effectiveUrl,
      url: effectiveUrl,
      orderGroupId,
      amountAgorot: totalAg,
      currency: 'ILS',
      installmentsEnabled: tenantInstallmentOptions.length > 0,
      installmentOptions: tenantInstallmentOptions.length > 0 ? [...new Set(tenantInstallmentOptions)].sort((a, b) => a - b) : [],
    });
  }

  if (!ok || parsed.result !== '000' || !parsed.paymentUrl) {
    const hypResult =
      parsed.result ||
      (!ok ? (httpStatus ? String(httpStatus) : bodyText.startsWith('[fetch]') ? 'NETWORK' : '') : '');
    const hypMessage = parsed.message?.trim() || undefined;
    const snippet = bodyText.replace(/\s+/g, ' ').trim().slice(0, 500);
    console.warn('[Hyp] doDeal relay failed', {
      relayUrl: cfg.relayBaseUrl,
      httpStatus,
      ok,
      hypResult: hypResult || '(empty)',
      hypMessage: hypMessage ?? '(none)',
      snippet,
    });
    const isAuthOrEnvHint =
      httpStatus === 401 ||
      /invalid.*credential|auth|password|user/i.test(snippet) ||
      hypResult === '401';
    const looksLikeGatewayHtmlLogin = looksLikeHtml && /action=login|window\.location|yaadpay|pay\.hyp\.co\.il|charset=windows-1255/i.test(snippet);
    if (demoModeEnabled && (isAuthOrEnvHint || looksLikeGatewayLoginPage || looksLikeHtml)) {
      const url = withPaymentWebViewToken(req, buildDemoUrl(base, orderGroupId));
      return res.json({ url, paymentUrl: url, orderGroupId, amountAgorot: totalAg, currency: 'ILS', demoMode: true });
    }
    const providerErrorDescription =
      hypMessage || (isAuthOrEnvHint || looksLikeGatewayHtmlLogin
        ? 'Provider rejected credentials or account mapping.'
        : 'Provider failed to generate payment URL.');
    return res.status(502).json({
      error: 'Hyp payment page failed',
      code: isAuthOrEnvHint || looksLikeGatewayHtmlLogin ? 'HYP_CONFIG_ERROR' : 'HYP_DO_DEAL_FAILED',
      details: providerErrorDescription,
      errorDescription: providerErrorDescription,
      missingKeys: hypCfg.missingKeys.length > 0 ? hypCfg.missingKeys : undefined,
      hypResult: hypResult || undefined,
      hypMessage: hypMessage ?? undefined,
      httpStatus,
    });
  }

  res.json({ success: true, paymentUrl: parsed.paymentUrl, url: parsed.paymentUrl, orderGroupId, amountAgorot: totalAg, currency: 'ILS' });
}));

app.get('/payments/hyp/hosted/:id', (req, res) => {
  const id = String(req.params.id ?? '').trim();
  const page = hypHostedHtmlPages.get(id);
  if (!page) return res.status(404).send('Payment page expired');
  if (Date.now() > page.expiresAt) {
    hypHostedHtmlPages.delete(id);
    return res.status(410).send('Payment page expired');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(page.html);
});

app.get('/payments/hyp/demo', (req, res) => {
  const orderGroupId = String(req.query.orderGroupId ?? '').trim();
  if (!orderGroupId) return res.status(400).send('Missing orderGroupId');
  const base = getPublicApiBaseUrl();
  const successUrl = `${base}/payments/hyp/return?outcome=success&orderGroupId=${encodeURIComponent(orderGroupId)}&demo=1`;
  const cancelUrl = `${base}/payments/hyp/return?outcome=cancel&orderGroupId=${encodeURIComponent(orderGroupId)}&demo=1`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demo Visa Payment</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f4f7fb; margin:0; padding:24px; color:#102a43; }
    .card { max-width:420px; margin:24px auto; background:#fff; border-radius:14px; padding:20px; box-shadow:0 10px 30px rgba(16,42,67,.12); }
    .title { font-size:20px; font-weight:700; margin-bottom:8px; }
    .sub { font-size:13px; color:#486581; margin-bottom:16px; }
    .input { width:100%; box-sizing:border-box; margin:8px 0; padding:12px; border:1px solid #d9e2ec; border-radius:10px; }
    .row { display:flex; gap:10px; }
    .btn { width:100%; border:0; border-radius:10px; padding:12px; font-weight:700; cursor:pointer; margin-top:10px; }
    .ok { background:#16a34a; color:#fff; }
    .cancel { background:#e4e7eb; color:#102a43; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Demo Visa Checkout</div>
    <div class="sub">This is a simulated card page. Pay to mark the order as PAID/CARD.</div>
    <input class="input" placeholder="Card Number" />
    <div class="row">
      <input class="input" placeholder="MM/YY" />
      <input class="input" placeholder="CVV" />
    </div>
    <button class="btn ok" onclick="location.href='${successUrl}'">Pay Now (Demo)</button>
    <button class="btn cancel" onclick="location.href='${cancelUrl}'">Cancel</button>
  </div>
</body>
</html>`);
});

/** Browser return from Hyp payment page — validates MAC, completes orders, redirects to app deep link. */
app.get('/payments/hyp/return', wrapAsync(async (req, res) => {
  const cfg = loadHypConfig();
  const orderGroupId = String(req.query.orderGroupId ?? '').trim();
  const outcome = String(req.query.outcome ?? '').trim();
  const isDemo = String(req.query.demo ?? '').trim() === '1';
  const q = normalizeHypQuery(req.query as Record<string, string | string[] | undefined>);

  if (!cfg && !isDemo) {
    return res.status(503).send('<html><body>Hyp not configured</body></html>');
  }
  if (!orderGroupId) return res.status(400).send('Missing orderGroupId');

  const deep = (status: string) =>
    `nmdcustomer://hyp-payment?status=${encodeURIComponent(status)}&paymentStatus=${encodeURIComponent(
      status === 'paid' ? 'success' : status
    )}&paymentMethod=CREDIT_CARD&orderGroupId=${encodeURIComponent(orderGroupId)}`;
  const html = (url: string) =>
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head><body><script>location.replace(${JSON.stringify(
      url
    )});</script><p>جاري العودة إلى التطبيق…</p></body></html>`;

  if (outcome === 'cancel' || outcome === 'error') {
    if (!isDemo && q.responseMac && !verifyHypResponseMac(cfg!.macPassword, q)) {
      return res.status(400).send('Invalid MAC');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html(deep(outcome)));
  }

  const gatewayErrorCode = String(q.errorCode ?? '').trim();
  if (!isDemo && gatewayErrorCode && gatewayErrorCode !== '000') {
    console.warn('[Hyp] return indicates non-success', { orderGroupId, gatewayErrorCode, txId: q.txId || '' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html(deep('error')));
  }

  if (!isDemo && q.responseMac && !verifyHypResponseMac(cfg!.macPassword, q)) {
    console.warn('[Hyp] MAC mismatch on return');
    return res.status(400).send('Invalid payment verification');
  }

  try {
    const maskRaw = String(q.cardMask ?? '').replace(/[^\d]/g, '');
    const tokenRaw = String(q.cardToken ?? '').replace(/[^\d]/g, '');
    const cardLast4 =
      maskRaw.length >= 4 ? maskRaw.slice(-4) : tokenRaw.length >= 4 ? tokenRaw.slice(-4) : '';
    const cardBrand = String(q.cardBrand ?? '').trim().toUpperCase().slice(0, 24);
    await completeHypPaymentForGroup(orderGroupId, {
      providerRef: q.txId || q.uniqueID || undefined,
      demoMode: isDemo,
      cardLast4: cardLast4 || undefined,
      cardBrand: cardBrand || undefined,
    });
  } catch (e) {
    console.error('[Hyp] completeHypPaymentForGroup', e);
    return res.status(500).send('Payment recorded but order update failed');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html(deep('paid')));
}));

/** Optional Hyp IPN — verify shared secret; extend payload parsing when Hyp provides it. */
app.post('/payments/hyp/webhook', (req, res) => {
  const secret = process.env.HYP_WEBHOOK_SECRET?.trim();
  if (secret) {
    const got = String(req.headers['x-hyp-signature'] ?? req.headers['x-webhook-secret'] ?? '');
    if (got !== secret) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }
  console.log('[Hyp] webhook', JSON.stringify(req.body ?? {}).slice(0, 800));
  res.json({ ok: true });
});

app.post('/customer/coins/sync', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const phoneNorm = normalizePhoneForCoupon(customer.phone);
  if (!phoneNorm) return res.status(400).json({ error: 'Phone required' });

  const body = req.body as { balance?: number };
  const localBalance = Math.max(0, Math.floor(Number(body?.balance ?? 0) || 0));

  const existing = await prisma.customerCoin.findUnique({ where: { customerPhone: phoneNorm } });
  const now = new Date().toISOString();

  if (existing) {
    const merged = Math.max(existing.balance, localBalance);
    await prisma.customerCoin.update({
      where: { customerPhone: phoneNorm },
      data: { balance: merged, updatedAt: now },
    });
    console.log('[coins-audit] SYNC', { customerPhone: phoneNorm, merged, localBalance });
    res.json({ balance: merged, synced: true });
  } else {
    const merged = Math.max(INITIAL_COINS, localBalance);
    await prisma.customerCoin.create({
      data: { customerPhone: phoneNorm, balance: merged, updatedAt: now },
    });
    console.log('[coins-audit] SYNC', { customerPhone: phoneNorm, merged, localBalance, note: 'first_row' });
    res.json({ balance: merged, synced: true });
  }
}));

/** Add coins: platform admin JWT, or x-api-key (API_KEY), or x-internal-secret (INTERNAL_API_SECRET). Body: { phone, amount } — never customer self-serve. */
app.post('/customer/coins/add', wrapAsync(async (req, res) => {
  const via = authorizeCoinAddRequest(req);
  if (!via) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Coin grants require platform admin JWT (ROOT_ADMIN/SUPER_ADMIN), x-api-key, or x-internal-secret',
    });
  }

  const body = req.body as { phone?: string; amount?: number };
  const phoneNorm = normalizePhoneForCoupon(body.phone);
  if (!phoneNorm) return res.status(400).json({ error: 'phone required' });

  const amount = Math.max(0, Math.floor(Number(body?.amount ?? 0) || 0));
  if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const now = new Date().toISOString();
  const existing = await prisma.customerCoin.findUnique({ where: { customerPhone: phoneNorm } });

  let balance: number;
  if (existing) {
    balance = existing.balance + amount;
    await prisma.customerCoin.update({
      where: { customerPhone: phoneNorm },
      data: { balance, updatedAt: now },
    });
  } else {
    balance = INITIAL_COINS + amount;
    await prisma.customerCoin.create({
      data: { customerPhone: phoneNorm, balance, updatedAt: now },
    });
  }
  console.log('[coins-audit] ADD', { customerPhone: phoneNorm, amount, newBalance: balance, via });
  res.json({ balance });
}));

app.post('/customer/coins/deduct', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const phoneNorm = normalizePhoneForCoupon(customer.phone);
  if (!phoneNorm) return res.status(400).json({ error: 'Phone required' });

  const body = req.body as { amount?: number };
  const amount = Math.max(0, Math.floor(Number(body?.amount ?? 0) || 0));
  if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const existing = await prisma.customerCoin.findUnique({ where: { customerPhone: phoneNorm } });
  const currentBalance = existing?.balance ?? INITIAL_COINS;

  if (currentBalance < amount) {
    return res.status(400).json({ error: 'Insufficient balance', balance: currentBalance });
  }

  const balance = currentBalance - amount;
  const now = new Date().toISOString();

  if (existing) {
    await prisma.customerCoin.update({
      where: { customerPhone: phoneNorm },
      data: { balance, updatedAt: now },
    });
  } else {
    await prisma.customerCoin.create({
      data: { customerPhone: phoneNorm, balance, updatedAt: now },
    });
  }
  console.log('[coins-audit] DEDUCT', { customerPhone: phoneNorm, amount, newBalance: balance, via: 'customer_deduct' });
  res.json({ balance });
}));

/** POST /customer/lucky-wheel/spin: deduct coins, weighted random to pick prize, return prizeIndex. */
app.post('/customer/lucky-wheel/spin', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const phoneNorm = normalizePhoneForCoupon(customer.phone);
  if (!phoneNorm) return res.status(400).json({ error: 'Phone required' });

  const prizes = await prisma.wheelPrize.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  if (prizes.length === 0) {
    return res.status(400).json({ error: 'No active prizes configured' });
  }

  const existing = await prisma.customerCoin.findUnique({ where: { customerPhone: phoneNorm } });
  const currentBalance = existing?.balance ?? INITIAL_COINS;
  if (currentBalance < SPIN_COST) {
    return res.status(400).json({ error: 'Insufficient balance', balance: currentBalance });
  }

  const totalWeight = prizes.reduce((s, p) => s + Math.max(1, p.chanceWeight), 0);
  const r = Math.random() * totalWeight;
  let cum = 0;
  let prizeIndex = prizes.length - 1;
  for (let i = 0; i < prizes.length; i++) {
    cum += Math.max(1, prizes[i].chanceWeight);
    if (r < cum) {
      prizeIndex = i;
      break;
    }
  }

  const balance = currentBalance - SPIN_COST;
  const now = new Date().toISOString();
  if (existing) {
    await prisma.customerCoin.update({
      where: { customerPhone: phoneNorm },
      data: { balance, updatedAt: now },
    });
  } else {
    await prisma.customerCoin.create({
      data: { customerPhone: phoneNorm, balance, updatedAt: now },
    });
  }

  console.log('[coins-audit] DEDUCT', {
    customerPhone: phoneNorm,
    amount: SPIN_COST,
    newBalance: balance,
    via: 'lucky_wheel_spin',
  });

  const prize = prizes[prizeIndex];
  res.json({
    prizeIndex,
    prize: { id: prize.id, label: prize.label, type: prize.type, value: prize.value },
    balance,
  });
}));

/** POST /customer/lucky-wheel/redeem: redeem prize after spin. PERCENT/FIXED → coupon; COINS → add coins. */
app.post('/customer/lucky-wheel/redeem', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const phoneNorm = normalizePhoneForCoupon(customer.phone);
  if (!phoneNorm) return res.status(400).json({ error: 'Phone required' });

  const body = req.body as { prizeId: string; prizeType: string; prizeValue?: number };
  const prizeType = String(body?.prizeType ?? '').toUpperCase();
  const prizeValue = Math.max(0, Math.floor(Number(body?.prizeValue ?? 0) || 0));

  if (prizeType === 'NO_WIN') {
    return res.json({ ok: true, type: 'NO_WIN' });
  }

  if (prizeType === 'COINS') {
    if (prizeValue <= 0) return res.status(400).json({ error: 'Invalid prize value' });
    const now = new Date().toISOString();
    const existing = await prisma.customerCoin.findUnique({ where: { customerPhone: phoneNorm } });
    let balance: number;
    if (existing) {
      balance = existing.balance + prizeValue;
      await prisma.customerCoin.update({
        where: { customerPhone: phoneNorm },
        data: { balance, updatedAt: now },
      });
    } else {
      balance = INITIAL_COINS + prizeValue;
      await prisma.customerCoin.create({
        data: { customerPhone: phoneNorm, balance, updatedAt: now },
      });
    }
    console.log('[coins-audit] ADD', {
      customerPhone: phoneNorm,
      amount: prizeValue,
      newBalance: balance,
      via: 'lucky_wheel_redeem_coins',
    });
    return res.json({ ok: true, type: 'COINS', balance });
  }

  if (prizeType === 'PERCENT' || prizeType === 'FIXED') {
    const value = prizeType === 'PERCENT' ? Math.min(100, Math.max(1, prizeValue || 5)) : Math.max(1, prizeValue || 10);
    const type = prizeType as 'PERCENT' | 'FIXED';
    let code = `NMD-LUCKY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.coupon.findUnique({ where: { code } });
      if (!exists) break;
      code = `NMD-LUCKY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    }
    const id = `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await prisma.coupon.create({
      data: {
        id,
        code,
        type,
        value,
        tenantId: null,
        storeId: null,
        oneTimeUse: true,
        winnerPhone: customer.phone,
        usedAt: null,
        createdAt: now,
        expiresAt,
      },
    });
    sendWhatsAppNotification(customer.phone, code);
    return res.json({ ok: true, type: 'COUPON', code });
  }

  return res.status(400).json({ error: 'Invalid prize type' });
}));

app.post('/coupons', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });

  const body = req.body as { code: string; type: 'FIXED' | 'PERCENT'; value: number; tenantId?: string; storeId?: string; oneTimeUse?: boolean; winnerPhone?: string; expiresAt?: string };
  const code = String(body?.code ?? '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'code required' });
  const type = body?.type === 'PERCENT' ? 'PERCENT' : 'FIXED';
  const value = Number(body?.value);
  if (Number.isNaN(value) || value <= 0) return res.status(400).json({ error: 'value must be a positive number' });
  if (type === 'PERCENT' && value > 100) return res.status(400).json({ error: 'percent value must be 1-100' });

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) return res.status(409).json({ error: 'Coupon code already exists' });

  const id = `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  await prisma.coupon.create({
    data: {
      id,
      code,
      type,
      value,
      tenantId: body?.tenantId?.trim() || null,
      storeId: body?.storeId?.trim() || null,
      oneTimeUse: !!body?.oneTimeUse,
      winnerPhone: body?.winnerPhone?.trim() || null,
      createdAt: now,
      expiresAt: body?.expiresAt?.trim() || null,
    },
  });
  const created = await prisma.coupon.findUnique({ where: { id } });
  const winnerPhone = body?.winnerPhone?.trim();
  if (winnerPhone) {
    sendWhatsAppNotification(winnerPhone, code);
  }
  res.status(201).json(created);
}));

app.get('/coupons', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  const list = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(list);
}));

/** Super Admin: update coupon (not code if already used). */
app.patch('/coupons/:id', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  const { id } = req.params;
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Coupon not found' });
  const body = req.body as {
    type?: 'FIXED' | 'PERCENT';
    value?: number;
    tenantId?: string | null;
    storeId?: string | null;
    oneTimeUse?: boolean;
    winnerPhone?: string | null;
    expiresAt?: string | null;
    isActive?: boolean;
  };
  if (existing.usedAt && body.value != null) {
    return res.status(409).json({ error: 'Cannot change value of a used coupon' });
  }
  const type = body.type === 'PERCENT' ? 'PERCENT' : body.type === 'FIXED' ? 'FIXED' : existing.type;
  const value = body.value != null ? Number(body.value) : existing.value;
  if (Number.isNaN(value) || value <= 0) return res.status(400).json({ error: 'value must be positive' });
  if (type === 'PERCENT' && value > 100) return res.status(400).json({ error: 'percent value must be 1-100' });
  let expiresAt = existing.expiresAt;
  if ('expiresAt' in body) {
    expiresAt = body.expiresAt?.trim() || null;
  }
  if (body.isActive === false) {
    expiresAt = new Date().toISOString();
  } else if (body.isActive === true && expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    expiresAt = null;
  }
  const updated = await prisma.coupon.update({
    where: { id },
    data: {
      type,
      value,
      tenantId: 'tenantId' in body ? (body.tenantId?.trim() || null) : existing.tenantId,
      storeId: 'storeId' in body ? (body.storeId?.trim() || null) : existing.storeId,
      oneTimeUse: typeof body.oneTimeUse === 'boolean' ? body.oneTimeUse : existing.oneTimeUse,
      winnerPhone: 'winnerPhone' in body ? (body.winnerPhone?.trim() || null) : existing.winnerPhone,
      expiresAt,
    },
  });
  res.json(updated);
}));

/** Super Admin: soft-deactivate coupon (sets expiresAt to now; keeps record). */
app.post('/coupons/:id/deactivate', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  const { id } = req.params;
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Coupon not found' });
  const updated = await prisma.coupon.update({
    where: { id },
    data: { expiresAt: new Date().toISOString() },
  });
  res.json(updated);
}));

/** Public: supported delivery towns for profile + checkout. */
app.get('/public/delivery-towns', (_req, res) => {
  res.json({ towns: SUPPORTED_DELIVERY_TOWNS });
});

/** Super Admin: manually grant NMD reward coins to a wallet (normalized phone). */
app.post('/admin/customers/grant-coins', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  const body = req.body as { phone?: string; amount?: number; note?: string };
  const phoneNorm = normalizePhoneForCoupon(body.phone);
  if (!phoneNorm) return res.status(400).json({ error: 'phone required' });
  const amount = Math.max(0, Math.floor(Number(body.amount) || 0));
  if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const now = new Date().toISOString();
  const existing = await prisma.customerCoin.findUnique({ where: { customerPhone: phoneNorm } });
  let balance: number;
  if (existing) {
    balance = existing.balance + amount;
    await prisma.customerCoin.update({
      where: { customerPhone: phoneNorm },
      data: { balance, updatedAt: now },
    });
  } else {
    balance = INITIAL_COINS + amount;
    await prisma.customerCoin.create({
      data: { customerPhone: phoneNorm, balance, updatedAt: now },
    });
  }
  console.log('[coins-audit] ADD', { customerPhone: phoneNorm, amount, newBalance: balance, via: 'admin_grant', note: body.note });
  res.json({ balance, granted: amount });
}));

/** Customer Trust & Risk — dedicated endpoints (see customer-trust/routes.ts). */
registerCustomerTrustRoutes(app, { prisma, repos });

// --- Wheel Prizes (Lucky Wheel) ---
/** GET /lucky-wheel/prizes: public, returns active prizes for storefront */
app.get('/lucky-wheel/prizes', wrapAsync(async (_req, res) => {
  const list = await prisma.wheelPrize.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(list);
}));

/** GET /admin/wheel-prizes: platform admin only, list all prizes */
app.get('/admin/wheel-prizes', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  const list = await prisma.wheelPrize.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(list);
}));

/** POST /admin/wheel-prizes: platform admin only, create or update prize */
app.post('/admin/wheel-prizes', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  const body = req.body as { id?: string; label: string; type: string; value?: number; chanceWeight?: number; isActive?: boolean; sortOrder?: number };
  const label = String(body?.label ?? '').trim();
  if (!label) return res.status(400).json({ error: 'label required' });
  const type = ['PERCENT', 'FIXED', 'COINS', 'NO_WIN'].includes(body?.type) ? body.type : 'NO_WIN';
  const value = Math.max(0, Math.floor(Number(body?.value ?? 0) || 0));
  const chanceWeight = Math.max(1, Math.floor(Number(body?.chanceWeight ?? 1) || 1));
  const isActive = body?.isActive !== false;
  const sortOrder = Math.floor(Number(body?.sortOrder ?? 0) || 0);

  if (body?.id) {
    const existing = await prisma.wheelPrize.findUnique({ where: { id: body.id } });
    if (!existing) return res.status(404).json({ error: 'Prize not found' });
    const updated = await prisma.wheelPrize.update({
      where: { id: body.id },
      data: { label, type, value, chanceWeight, isActive, sortOrder },
    });
    return res.json(updated);
  }
  const id = `wheel-prize-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const created = await prisma.wheelPrize.create({
    data: { id, label, type, value, chanceWeight, isActive, sortOrder },
  });
  res.status(201).json(created);
}));

// --- Courier portal (COURIER role only) ---
function requireCourier(req: express.Request, res: express.Response): { courierId: string; marketId: string } | null {
  const user = req.user as { role?: string; courierId?: string; marketId?: string } | undefined;
  if (!user || user.role !== 'COURIER' || !user.courierId || !user.marketId) {
    res.status(403).json({ error: 'Courier access required' });
    return null;
  }
  return { courierId: user.courierId, marketId: user.marketId };
}

/** Dispatch-only mode: couriers cannot self-assign or browse the open pool. */
function respondDispatchOnly(res: express.Response): void {
  res.status(403).json({
    error: 'DISPATCH_ONLY',
    message: 'Orders are assigned by market dispatch.',
    messageAr: 'يتم تعيين الطلبات من إدارة توصيل السوق.',
  });
}

/** Assign/unassign: MARKET_ADMIN (own market) or platform admin with emergency write reason. */
function requireMarketDispatchAssignAuth(req: express.Request, res: express.Response, marketId: string): boolean {
  const user = req.user as { role?: string; marketId?: string } | undefined;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const role = user.role;
  if (role === 'COURIER' || role === 'TENANT_ADMIN' || role === 'CUSTOMER') {
    res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
    return false;
  }
  if (role === 'MARKET_ADMIN') {
    if (user.marketId !== marketId) {
      res.status(403).json({ error: 'Cannot assign couriers in another market', code: 'CROSS_MARKET_ACCESS' });
      return false;
    }
    return true;
  }
  if (isPlatformAdmin(role)) {
    return requireWriteWithReason(req, res);
  }
  res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  return false;
}

/** Courier API hard gate: require x-api-key on all /courier routes. */
function requireCourierApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server API_KEY is not configured' });
  }
  const fromHeader = String(req.get('x-api-key') ?? '').trim();
  const fromQuery = String((req.query.apiKey as string | undefined) ?? '').trim();
  const provided = fromHeader || fromQuery;
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid API key' });
  }
  next();
}

// Must run before any /courier route handlers.
app.use('/courier', requireCourierApiKey);

app.get('/courier/me', async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const courier = (await repos.couriers.findAll()).find((c) => c.id === scope.courierId);
  const market = (await repos.markets.findAll()).find((m) => m.id === scope.marketId);
  if (!courier || !market) return res.status(404).json({ error: 'Courier or market not found' });
  if (courier.marketId !== scope.marketId) return res.status(403).json({ error: 'Forbidden' });
  res.json({
    id: req.user!.id,
    email: (req.user as { email: string }).email,
    role: 'COURIER',
    courierId: scope.courierId,
    marketId: scope.marketId,
    courier: { id: courier.id, name: courier.name, phone: courier.phone, isOnline: courier.isOnline, isAvailable: courier.isAvailable },
    market: { id: market.id, name: market.name },
  });
});

async function lookupCustomerCoinsBalance(order: Record<string, unknown>): Promise<number | null> {
  const phone = String(
    order.customerPhone ?? (order.customer as { phone?: string } | undefined)?.phone ?? ''
  ).trim();
  if (phone) {
    const { row } = await findCustomerCoinRow(prisma, phone);
    if (row) return row.balance;
  }
  const customerId = String(order.customerId ?? '').trim();
  if (customerId && isStorageDb()) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { phone: true },
    });
    if (customer?.phone) {
      const { row } = await findCustomerCoinRow(prisma, customer.phone);
      if (row) return row.balance;
    }
  }
  return null;
}

/** Enrich delivery orders for courier API (tenant, customer, payment, earnings preview, coins). */
async function enrichCourierOrders(
  orders: { id?: string; tenantId?: string; courierId?: string; status?: string; fulfillmentType?: string; total?: number; currency?: string; paymentMethod?: string; cashChangeFor?: number; customerName?: string; customerPhone?: string; customerId?: string; createdAt?: string; deliveryAddress?: string; deliveryLocation?: { lat: number; lng: number }; deliveryStatus?: string; deliveryTimeline?: Record<string, unknown>; delivery?: { zoneName?: string; addressText?: string; fee?: number } }[],
  tenants: { id?: string; name?: string; whatsappPhone?: string; addressLine?: string; location?: { lat: number; lng: number }; categoryId?: string }[],
  courierId: string
): Promise<Record<string, unknown>[]> {
  return Promise.all(
    orders.map(async (o) => {
      const rec = o as Record<string, unknown>;
      const t = o.tenantId ? tenants.find((x) => x.id === o.tenantId) : undefined;
      const tenant = t
        ? {
            name: t.name ?? '',
            phone: t.whatsappPhone,
            address: t.addressLine,
            location: t.location,
            categoryId: t.categoryId,
          }
        : { name: '', phone: undefined, address: undefined, location: undefined, categoryId: undefined };
      const deliveryZoneName = (o.delivery as { zoneName?: string } | undefined)?.zoneName ?? '';
      const customer = {
        name: o.customerName ?? '',
        phone: o.customerPhone ?? '',
        deliveryAddress: o.deliveryAddress ?? '',
        deliveryLocation: o.deliveryLocation,
        deliveryZoneName,
      };
      const currency = o.currency ?? 'ILS';
      const pay = rec.payment;
      const orderTotal =
        (pay as { financials?: { gross?: number; customerTotal?: number } } | undefined)?.financials
          ?.customerTotal ??
        (pay as { financials?: { gross?: number } } | undefined)?.financials?.gross ??
        (Number(o.total) || 0);
      const paymentMethod = ((pay as { method?: string } | undefined)?.method ??
        (rec.paymentMethod === 'CARD' ? 'CARD' : 'CASH')) as 'CASH' | 'CARD';
      const amountToCollect = paymentMethod === 'CASH' ? orderTotal : 0;
      const collection = computeDriverCollectionAmount(rec as Record<string, unknown>);
      const settlementMeta = enrichOrderWithDriverCollection(rec as Record<string, unknown>);
      const { deliveryFee } = extractOrderEarningsBase(rec);
      const driverEarningsPreview = await computeDriverEarningsPreview(rec, courierId);
      const customerCoinsBalance = await lookupCustomerCoinsBalance(rec);
      return {
        ...o,
        orderTime: o.createdAt ?? null,
        tenant,
        customer,
        currency,
        orderTotal,
        customerOrderTotal: orderTotal,
        deliveryFee: collection.deliveryFee || deliveryFee,
        platformCommission: collection.platformCommission,
        driverCollectionAmount: collection.driverCollectionAmount,
        restaurantShare: collection.restaurantShare,
        driverCashInHand: settlementMeta.driverCashInHand,
        driverNonCashCollected: settlementMeta.driverNonCashCollected,
        platformRevenueAmount: settlementMeta.platformRevenueAmount,
        driverPlatformLiabilityAmount: settlementMeta.driverPlatformLiabilityAmount,
        driverRestaurantLiabilityAmount: settlementMeta.driverRestaurantLiabilityAmount,
        totalDriverLiability: settlementMeta.totalDriverLiability,
        normalizedPaymentMethod: settlementMeta.normalizedPaymentMethod,
        anomalyCode: settlementMeta.anomalyCode,
        anomalyMessage: settlementMeta.anomalyMessage,
        settlementStatus: settlementMeta.settlementStatus,
        settledAt: settlementMeta.settledAt,
        settledBy: settlementMeta.settledBy,
        settlementReference: settlementMeta.settlementReference,
        settlementNotes: settlementMeta.settlementNotes,
        driverEarningsPreview,
        customerCoinsBalance,
        paymentMethod,
        amountToCollect,
        cashChangeFor: o.cashChangeFor,
        deliveryZoneName,
      };
    })
  );
}

/** Courier's assigned active orders. PICKUP orders are excluded — only DELIVERY appears in courier lists. */
app.get('/courier/orders', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const orders = ((await repos.orders.findAll()) as { id?: string; tenantId?: string; courierId?: string; status?: string; fulfillmentType?: string; total?: number; currency?: string; paymentMethod?: string; cashChangeFor?: number; customerName?: string; customerPhone?: string; deliveryAddress?: string; deliveryLocation?: { lat: number; lng: number }; isExternal?: boolean }[])
    .filter((o) => o.fulfillmentType === 'DELIVERY' && o.courierId === scope.courierId && !isCourierListTerminalStatus(o.status));
  const tenants = (await repos.tenants.findAll()) as { id?: string; name?: string; whatsappPhone?: string; addressLine?: string; location?: { lat: number; lng: number } }[];
  res.json(await enrichCourierOrders(orders, tenants, scope.courierId));
}));

/** Courier delivery history — completed/delivered orders for the logged-in courier. */
app.get('/courier/orders/history', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const orders = ((await repos.orders.findAll()) as { id?: string; tenantId?: string; courierId?: string; status?: string; fulfillmentType?: string; createdAt?: string; deliveryTimeline?: { deliveredAt?: string }; total?: number; currency?: string; paymentMethod?: string; cashChangeFor?: number; customerName?: string; customerPhone?: string; deliveryAddress?: string; deliveryLocation?: { lat: number; lng: number }; isExternal?: boolean }[])
    .filter((o) => o.fulfillmentType === 'DELIVERY' && o.courierId === scope.courierId && isCourierListTerminalStatus(o.status))
    .sort((a, b) => {
      const aAt = (a.deliveryTimeline as { deliveredAt?: string } | undefined)?.deliveredAt ?? a.createdAt ?? '';
      const bAt = (b.deliveryTimeline as { deliveredAt?: string } | undefined)?.deliveredAt ?? b.createdAt ?? '';
      return bAt.localeCompare(aAt);
    });
  const tenants = (await repos.tenants.findAll()) as { id?: string; name?: string; whatsappPhone?: string; addressLine?: string; location?: { lat: number; lng: number } }[];
  res.json(await enrichCourierOrders(orders, tenants, scope.courierId));
}));

/** Open-market pool disabled — dispatch-only assignment by MARKET_ADMIN. */
app.get('/courier/orders/available', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  respondDispatchOnly(res);
}));

/** Courier self-assign disabled — dispatch-only assignment by MARKET_ADMIN. */
app.post('/courier/orders/:orderId/accept', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  respondDispatchOnly(res);
}));

/** Courier's own performance stats (points, badges, metrics). */
app.get('/courier/stats', async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const metrics = await computeCourierMetrics(scope.marketId, scope.courierId);
  res.json(metrics);
});

/** Restaurants + destination labels (delivery zones) for manual external-order form. */
app.get('/courier/forms/options', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const courier = await prisma.courier.findUnique({
    where: { id: scope.courierId },
    select: { allowedStoreIds: true },
  });
  let allowedStoreIds: string[] = [];
  try {
    const parsed = courier?.allowedStoreIds ? JSON.parse(courier.allowedStoreIds) : [];
    if (Array.isArray(parsed)) allowedStoreIds = parsed.map((x) => String(x)).filter(Boolean);
  } catch {
    allowedStoreIds = [];
  }
  const tenants = await prisma.tenant.findMany({
    where: {
      marketId: scope.marketId,
      enabled: { not: false },
      ...(allowedStoreIds.length > 0 ? { id: { in: allowedStoreIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const restaurants = tenants.map((t) => ({ id: t.id, name: (t.name ?? t.id) as string }));
  const zones = await prisma.deliveryZone.findMany({
    where: { tenantId: { in: tenants.map((t) => t.id) } },
    select: { name: true },
  });
  const zoneNames = new Set<string>();
  for (const z of zones) {
    if (z.name?.trim()) zoneNames.add(z.name.trim());
  }
  const destinations = [...zoneNames].sort((a, b) => a.localeCompare(b, 'ar'));
  res.json({ restaurants, destinations });
}));

/** Manual off-app delivery entry — disabled for couriers (Phase 1 dispatch-only). */
app.post('/courier/external-orders', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  respondDispatchOnly(res);
}));

/** Driver expense submission (pending admin approval). */
app.post('/courier/expenses', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const body = (req.body ?? {}) as { category?: string; amount?: number; note?: string };
  const cat = String(body.category ?? '').toUpperCase();
  if (!EXPENSE_CATEGORIES.includes(cat as (typeof EXPENSE_CATEGORIES)[number])) {
    return res.status(400).json({ error: 'Invalid category', valid: EXPENSE_CATEGORIES });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const id = `cexp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  await prisma.courierExpense.create({
    data: {
      id,
      courierId: scope.courierId,
      marketId: scope.marketId,
      category: cat,
      amount,
      currency: 'ILS',
      note: body.note?.trim() || null,
      status: 'PENDING',
      createdAt: now,
    },
  });
  res.status(201).json({ id, category: cat, amount, status: 'PENDING', createdAt: now });
}));

app.get('/courier/expenses', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const rows = await prisma.courierExpense.findMany({
    where: { courierId: scope.courierId },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(rows);
}));

/** Start duty shift. */
app.post('/courier/shifts/start', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  try {
    const shift = await startShift(scope.courierId, scope.marketId);
    res.status(201).json(shift);
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'ACTIVE_SHIFT_EXISTS') {
      return res.status(409).json({ error: e.message, code: e.code });
    }
    throw err;
  }
}));

/** End duty shift. */
app.post('/courier/shifts/end', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  try {
    const shift = await endShift(scope.courierId);
    res.json(shift);
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'NO_ACTIVE_SHIFT') {
      return res.status(400).json({ error: e.message, code: e.code });
    }
    throw err;
  }
}));

/** Active shift (if any). Auto-closes stale shifts >16h before responding. */
app.get('/courier/shifts/active', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const shift = await getActiveShift(scope.courierId);
  const shiftWarning = await getRecentAutoClosedShiftWarning(scope.courierId);
  res.json({ shift: shift ?? null, shiftWarning });
}));

/** Driver earnings summary — period=today|week|month or from/to (YYYY-MM-DD). */
app.get('/courier/earnings', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const period = String(req.query.period ?? 'today');
  const fromQ = req.query.from ? String(req.query.from) : undefined;
  const toQ = req.query.to ? String(req.query.to) : undefined;
  const { from, to } = parseDateRange(period, fromQ, toQ);
  const summary = await computeEarningsSummary(scope.courierId, from, to);
  const config = await getOrCreatePayrollConfig(scope.courierId);
  const shiftWarning = await getRecentAutoClosedShiftWarning(scope.courierId);
  const outstandingBalance = await computeOutstandingBalance(scope.courierId);
  res.json({
    ...summary,
    hourlyRate: config.hourlyRate,
    isPayrollEnabled: config.isPayrollEnabled,
    outstandingBalance,
    shiftWarning,
  });
}));

/** Daily P&L: (app + external delivery fees) − expenses. `date` = YYYY-MM-DD (local day via ISO prefix match). */
app.get('/courier/daily-summary', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10)).trim();
  const dayOrders = await prisma.order.findMany({
    where: {
      courierId: scope.courierId,
      status: 'COMPLETED',
      createdAt: { startsWith: date },
    },
    select: {
      total: true,
      isExternal: true,
    },
  });
  let appOrdersTotal = 0;
  let externalOrdersTotal = 0;
  for (const o of dayOrders) {
    const t = Number(o.total) || 0;
    if (o.isExternal) externalOrdersTotal += t;
    else appOrdersTotal += t;
  }
  const expenseRows = await prisma.courierExpense.findMany({
    where: {
      courierId: scope.courierId,
      createdAt: { startsWith: date },
    },
    select: { amount: true },
  });
  const expensesTotal = expenseRows
    .reduce((s, e) => s + e.amount, 0);
  const gross = appOrdersTotal + externalOrdersTotal;
  const net = gross - expensesTotal;
  res.json({
    date,
    appOrdersTotal,
    externalOrdersTotal,
    expensesTotal,
    gross,
    net,
  });
}));

/** Valid action transitions by deliveryStatus (not order.status). Simplified: ASSIGNED → IN_PROGRESS → DELIVERED. */
const VALID_ACTION_FROM_DELIVERY: Record<string, string[]> = {
  ASSIGNED: ['ACKNOWLEDGE'],
  IN_PROGRESS: ['DELIVERED'],
  PICKED_UP: ['DELIVERED'], // legacy orders only
  DELIVERED: ['FINISH'],
};

function computeDurations(tl: { assignedAt?: string; acknowledgedAt?: string; pickedUpAt?: string; deliveredAt?: string }): Record<string, number> | undefined {
  const a = tl.assignedAt ? new Date(tl.assignedAt).getTime() : 0;
  const k = tl.acknowledgedAt ? new Date(tl.acknowledgedAt).getTime() : 0;
  const p = tl.pickedUpAt ? new Date(tl.pickedUpAt).getTime() : 0;
  const d = tl.deliveredAt ? new Date(tl.deliveredAt).getTime() : 0;
  if (!a || !d) return undefined;
  const mins = (x: number, y: number) => Math.round((y - x) / 60000);
  const out: Record<string, number> = { totalMinutes: mins(a, d) };
  if (k) out.assignedToAcknowledged = mins(a, k);
  if (k && p) out.acknowledgedToPickedUp = mins(k, p);
  if (p) out.pickedUpToDelivered = mins(p, d);
  return out;
}

/** Legacy deliveryStatus -> action mapping for backward compatibility */
const DELIVERY_STATUS_TO_ACTION: Record<string, string> = {
  ASSIGNED: 'ACKNOWLEDGE',
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED',
};

const VALID_ACTIONS = ['ACKNOWLEDGE', 'PICKED_UP', 'DELIVERED', 'FINISH'];

/** Compute payment object for aggregator financial model. */
async function computePaymentForOrder(
  order: { items?: { totalPrice?: number }[]; subtotal?: number; total?: number; delivery?: { fee?: number } },
  tenantId: string
): Promise<{
  method: 'CASH' | 'CARD';
  provider: string;
  status: 'PENDING' | 'COLLECTED' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED';
  currency: string;
  breakdown: { itemsTotal: number; deliveryFee: number; discount?: number; tax?: number };
  financials: { gross: number; commission: number; gatewayFee: number; netToMerchant: number; netToMarket: number };
}> {
  const itemsTotal = order.subtotal ?? (order.items ?? []).reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const deliverySettings = await repos.delivery.getSettings(tenantId);
  const deliveryFee = order.delivery?.fee ?? (deliverySettings as { deliveryFee?: number } | undefined)?.deliveryFee ?? 0;
  const gross = Number(order.total) || itemsTotal + deliveryFee;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  const cfg = tenant?.financialConfig ?? { commissionType: 'PERCENTAGE' as const, commissionValue: 10, deliveryFeeModel: 'TENANT' as const };
  const commission = cfg.commissionType === 'PERCENTAGE' ? Math.round(gross * (cfg.commissionValue / 100) * 100) / 100 : cfg.commissionValue;
  const gatewayFee = 0;
  const isMarketFee = cfg.deliveryFeeModel === 'MARKET';
  const netToMarket = commission + gatewayFee + (isMarketFee ? deliveryFee : 0);
  const netToMerchant = gross - commission - gatewayFee - (isMarketFee ? deliveryFee : 0);
  return {
    method: 'CASH',
    provider: 'NMD',
    status: 'PENDING',
    currency: 'ILS',
    breakdown: { itemsTotal, deliveryFee },
    financials: { gross, commission, gatewayFee, netToMerchant, netToMarket },
  };
}

app.post('/courier/orders/:orderId/status', async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const { orderId } = req.params;
  const body = (req.body ?? {}) as { action?: string; deliveryStatus?: string; notes?: string };
  let action = body.action;
  if (!action && body.deliveryStatus != null) {
    action = DELIVERY_STATUS_TO_ACTION[body.deliveryStatus] ?? body.deliveryStatus;
  }
  if (!action) {
    return res.status(400).json({ error: 'Missing action or deliveryStatus', code: 'BAD_REQUEST', details: { expected: ['action', 'deliveryStatus'] } });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Invalid action or deliveryStatus', code: 'BAD_REQUEST', details: { received: body.action ?? body.deliveryStatus, validActions: VALID_ACTIONS } });
  }
  const orders = (await repos.orders.findAll()) as { id?: string; courierId?: string; status?: string; deliveryStatus?: string; tenantId?: string; deliveryTimeline?: Record<string, unknown>; deliveredAt?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  const prevOrderStatusForLoyalty = order.status as string | undefined;
  if (order.courierId !== scope.courierId) return res.status(403).json({ error: 'Order not assigned to you', code: 'FORBIDDEN' });
  const currentDeliveryStatus = order.deliveryStatus ?? 'UNASSIGNED';
  const allowed = VALID_ACTION_FROM_DELIVERY[currentDeliveryStatus];
  if (!allowed?.includes(action)) {
    return res.status(409).json({
      error: `Invalid transition: ${currentDeliveryStatus} -> ${action}`,
      code: 'INVALID_TRANSITION',
      details: { currentDeliveryStatus, action, allowed },
    });
  }
  const tl = { ...(order.deliveryTimeline as Record<string, unknown> || {}) };
  const hasAck = !!tl.acknowledgedAt;
  const hasPicked = !!tl.pickedUpAt;
  const hasClosed = !!tl.closedAt;
  if (action === 'ACKNOWLEDGE' && hasAck) return res.json(order);
  if (action === 'PICKED_UP' && hasPicked) return res.json(order);
  if (action === 'FINISH' && hasClosed) return res.json(order);
  const now = new Date().toISOString();
  if (action === 'ACKNOWLEDGE') tl.acknowledgedAt = tl.acknowledgedAt ?? now;
  if (action === 'PICKED_UP') tl.pickedUpAt = tl.pickedUpAt ?? now;
  if (action === 'DELIVERED') {
    tl.deliveredAt = now;
    tl.durations = computeDurations(tl as { assignedAt?: string; acknowledgedAt?: string; pickedUpAt?: string; deliveredAt?: string });
    const couriers = (await repos.couriers.findAll());
    const cIdx = couriers.findIndex((c) => c.id === scope.courierId);
    if (cIdx >= 0) {
      couriers[cIdx] = { ...couriers[cIdx], isAvailable: true, deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1 };
      await repos.couriers.setAll(couriers);
    }
  }
  if (action === 'FINISH') {
    tl.closedAt = tl.closedAt ?? now;
    if (!tl.durations && tl.deliveredAt) {
      tl.durations = computeDurations(tl as { assignedAt?: string; acknowledgedAt?: string; pickedUpAt?: string; deliveredAt?: string });
    }
  }
  const deliveryStatusMap: Record<string, string> = { ACKNOWLEDGE: 'IN_PROGRESS', PICKED_UP: 'PICKED_UP', DELIVERED: 'DELIVERED', FINISH: 'DELIVERED' };
  const newDeliveryStatus = deliveryStatusMap[action] ?? currentDeliveryStatus;
  const updated = { ...order, deliveryStatus: newDeliveryStatus, deliveryTimeline: tl };
  if (action === 'DELIVERED') {
    (updated as { deliveryStatus?: string }).deliveryStatus = 'DELIVERED';
    (updated as { deliveredAt?: string }).deliveredAt = tl.deliveredAt as string;
    (updated as { status?: string }).status = 'COMPLETED';
  }
  if (action === 'FINISH') {
    const pay = (updated as { payment?: { status?: string; method?: string; cashLedger?: unknown } }).payment;
    if (pay && (pay.method === 'CASH' || !pay.method)) {
      (updated as Record<string, unknown>).payment = {
        ...pay,
        status: 'COLLECTED',
        cashLedger: { collected: true, collectedAt: now, collectedByCourierId: scope.courierId },
      };
    }
  }
  orders[idx] = updated;
  await repos.orders.upsert(updated as OrderRecord);
  await runLoyaltyAwardForOrderAtIndex(orders as Record<string, unknown>[], idx, prevOrderStatusForLoyalty);
  orders[idx] = await applySettlementToOrderIfEligible(orders[idx] as Record<string, unknown>);
  await repos.orders.upsert(orders[idx] as OrderRecord);
  await applyCourierPayrollIfEligible(orders[idx] as Record<string, unknown>);
  res.json(orders[idx]);
});

/** Courier heartbeat: update order's courierLocation when en route (IN_PROGRESS or legacy PICKED_UP). */
app.patch('/courier/orders/:orderId/location', wrapAsync(async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  const { orderId } = req.params;
  const body = (req.body ?? {}) as { lat?: number; lng?: number };
  const lat = typeof body.lat === 'number' ? body.lat : undefined;
  const lng = typeof body.lng === 'number' ? body.lng : undefined;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Missing or invalid lat/lng', code: 'BAD_REQUEST' });
  }
  const orders = (await repos.orders.findAll()) as { id?: string; courierId?: string; deliveryStatus?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  if (order.courierId !== scope.courierId) return res.status(403).json({ error: 'Order not assigned to you', code: 'FORBIDDEN' });
  const deliveryStatus = order.deliveryStatus ?? 'UNASSIGNED';
  if (deliveryStatus !== 'IN_PROGRESS' && deliveryStatus !== 'PICKED_UP') {
    return res.status(400).json({ error: 'Location updates only when order is en route (IN_PROGRESS)', code: 'INVALID_STATE' });
  }
  const updated = { ...order, courierLocation: { lat, lng } };
  orders[idx] = updated;
  await repos.orders.upsert(updated as OrderRecord);
  res.json(updated);
}));

/** SSE: courier events. Emits when order assigned to this courier. Auth via Bearer or ?token= query.
 *  Test: open courier app, login, SSE connects without 401. */
const courierEventListeners = new Map<string, (data: string) => void>();

app.get('/courier/events', async (req, res) => {
  const scope = requireCourier(req, res);
  if (!scope) return;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (data: string) => {
    try {
      res.write(`data: ${data}\n\n`);
      (res as { flush?: () => void }).flush?.();
    } catch {
      courierEventListeners.delete(scope.courierId);
    }
  };
  courierEventListeners.set(scope.courierId, send);
  send(JSON.stringify({ type: 'connected', courierId: scope.courierId }));
  req.on('close', () => courierEventListeners.delete(scope.courierId));
});

export function emitCourierAssigned(courierId: string, order: { id?: string; tenantId?: string }) {
  const send = courierEventListeners.get(courierId);
  if (send) send(JSON.stringify({ type: 'order_assigned', orderId: order.id, tenantId: order.tenantId }));
}

export function emitCourierUnassigned(courierId: string, orderId: string) {
  const send = courierEventListeners.get(courierId);
  if (send) send(JSON.stringify({ type: 'order_unassigned', orderId }));
}

/** Disabled (dispatch-only): open-market order_available broadcasts are no longer sent to couriers. */
export function emitOrderAvailableForMarket(_marketId: string, _orderId: string, _couriers: { id?: string; scopeType?: string; scopeId?: string; marketId?: string }[]) {
  // no-op — assignment is MARKET_ADMIN dispatch only
}

/** Disabled (dispatch-only): order_ready open-market broadcasts are no longer sent to couriers. */
export function emitOrderReadyForMarket(_marketId: string, _orderId: string, _couriers: { id?: string; scopeType?: string; scopeId?: string; marketId?: string }[]) {
  // no-op — assignment is MARKET_ADMIN dispatch only
}

/** Change password (self-service). Requires auth. TENANT_ADMIN can change only their own. */
app.post('/auth/change-password', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  }
  const users = (await repos.users.findAll());
  const user = users.find((u) => u.id === req.user!.id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.password !== currentPassword) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const updated = users.map((u) =>
    u.id === req.user!.id ? { ...u, password: newPassword, mustChangePassword: false } : u
  );
  await repos.users.setAll(updated);
  res.json({ ok: true });
});

/** ROOT_ADMIN: require emergency mode for writes. SUPER_ADMIN: always allowed (ghost mode). MARKET_ADMIN: always allowed (scope checked elsewhere). */
function requireWrite(req: express.Request): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'MARKET_ADMIN') return true;
  if (isPlatformAdmin(user.role)) {
    const em = (req as express.Request & { emergencyMode?: boolean }).emergencyMode;
    return em === true;
  }
  return false;
}

function getEmergencyReason(req: express.Request): string {
  return (req as express.Request & { emergencyReason?: string }).emergencyReason?.trim() ?? '';
}

/** For ROOT_ADMIN writes: require emergency mode + non-empty reason. SUPER_ADMIN bypasses (no reason required). Returns false and sends response if invalid. */
function requireWriteWithReason(req: express.Request, res: express.Response): boolean {
  if (!requireWrite(req)) {
    res.status(403).json({ error: 'Emergency mode required', code: 'EMERGENCY_MODE_REQUIRED' });
    return false;
  }
  if (req.user?.role === 'SUPER_ADMIN') return true;
  if (isPlatformAdmin(req.user?.role) && !getEmergencyReason(req)) {
    res.status(400).json({ error: 'emergencyReason is required in body _meta when emergency mode is on', code: 'EMERGENCY_REASON_REQUIRED' });
    return false;
  }
  return true;
}

const DEFAULT_HERO: StorefrontHero = {
  title: 'مرحباً بك',
  subtitle: 'اكتشف أفضل المنتجات لدينا',
  ctaText: 'تسوق الآن',
  ctaLink: '#',
};

function normalizeHero(h: StorefrontHero | undefined): StorefrontHero {
  const base = h ?? DEFAULT_HERO;
  const cta = (base as { ctaHref?: string }).ctaHref ?? base.ctaLink ?? '#';
  return { ...base, ctaLink: cta, ctaHref: cta } as StorefrontHero;
}

const DEFAULT_OPEN_TIME = '08:00';
const DEFAULT_CLOSE_TIME = '17:00';

type PaymentMethodsToggle = { cash: boolean; card: boolean; installments: boolean };

function resolvePaymentMethodsForTenant(t: RegistryTenant): PaymentMethodsToggle {
  const globalPayment = getGlobalConfig()?.paymentMethods ?? { cash: true, card: true, installments: true };
  const market = t.marketId ? getData().markets.find((m) => m.id === t.marketId) : undefined;
  const marketPayment = market?.paymentMethods ?? {
    cash: (market?.paymentCapabilities?.cash ?? true) !== false,
    card: market?.paymentCapabilities?.card === true,
    installments: Boolean((market?.paymentCapabilities as { allowInstallments?: boolean } | undefined)?.allowInstallments),
  };
  const tenantPayment = t.paymentMethods ?? {
    cash: (t.paymentCapabilities?.cash ?? true) !== false,
    card: t.paymentCapabilities?.card === true,
    installments: Boolean((t.paymentCapabilities as { allowInstallments?: boolean } | undefined)?.allowInstallments),
  };
  return {
    cash: globalPayment.cash !== false && marketPayment.cash !== false && tenantPayment.cash !== false,
    card: globalPayment.card !== false && marketPayment.card !== false && tenantPayment.card !== false,
    installments: globalPayment.installments !== false && marketPayment.installments !== false && tenantPayment.installments !== false,
  };
}

/** Effective status for customer-facing list/detail (override, forceClosed, hours, manual status). */
function customerOperationalStatus(n: RegistryTenant): 'open' | 'closed' | 'busy' {
  const status = getOperationalStatus(n as Parameters<typeof getOperationalStatus>[0]);
  console.log(`[STORE_STATUS_GET] tenantId=${n.id} status=${status}`);
  return status;
}

/** Returns full tenant including name, about, officeHours - used by GET /tenants/by-slug and PUT responses. Banners/arrays fallback to []. openTime/closeTime fallback to 08:00/17:00. */
function normalizeTenantResponse(t: RegistryTenant): RegistryTenant {
  const type = (t.type === 'CLOTHING' || t.type === 'FOOD') ? t.type : 'GENERAL';
  const banners = t.banners;
  const openTime = (t as { openTime?: string }).openTime ?? DEFAULT_OPEN_TIME;
  const closeTime = (t as { closeTime?: string }).closeTime ?? DEFAULT_CLOSE_TIME;
  const forceClosed = (t as { forceClosed?: boolean }).forceClosed ?? false;
  return {
    ...t,
    type,
    hero: normalizeHero(t.hero),
    banners: Array.isArray(banners) ? banners : [],
    openTime,
    closeTime,
    forceClosed,
    paymentMethods: resolvePaymentMethodsForTenant(t),
  } as RegistryTenant;
}

/** Resolve tenant's category display name from sub-category (preferred) or pillar. Aligns with Admin Tenants table. Never returns raw ID. */
function resolveTenantCategoryName(t: { subCategoryId?: string | null; pillarId?: string | null }): string | null {
  const subs = getSubCategories();
  const pillars = getPillars();
  if (t.subCategoryId) {
    const sub = subs.find((s) => s.id === t.subCategoryId);
    if (sub) return (sub.nameAr && sub.nameAr.trim()) || sub.name || null;
  }
  if (t.pillarId) {
    const pillar = pillars.find((p) => p.id === t.pillarId);
    if (pillar) return (pillar.nameAr && pillar.nameAr.trim()) || pillar.name || null;
  }
  return null;
}

// --- Leads (public POST for storefront tracking; GET requires auth) ---
/** Normalize for case-insensitive, slug-friendly comparison. */
function norm(s: string): string {
  return String(s ?? '').trim().toLowerCase();
}

/** Resolve tenantId from id or slug; always return UUID for consistent storage and filtering. Slug match is case-insensitive. */
async function resolveTenantId(tenantIdOrSlug: string): Promise<string | null> {
  const v = String(tenantIdOrSlug).trim();
  if (!v) return null;
  const tenants = await repos.tenants.findAll();
  const byId = tenants.find((t) => norm(t.id) === norm(v));
  if (byId) return byId.id;
  const bySlug = tenants.find((t) => norm((t as { slug?: string }).slug ?? '') === norm(v));
  return bySlug ? bySlug.id : null;
}

/** Loose filter: lead belongs to tenant if ANY of (tenantId, tenantSlug, storeId) matches requested id OR slug. Case-insensitive. */
function leadBelongsToTenantFilter(
  l: { tenantId?: string; tenantSlug?: string; storeId?: string },
  reqId: string,
  reqSlug: string | undefined,
  _tenants: { id: string; slug?: string }[]
): boolean {
  const rid = norm(reqId);
  const rslug = reqSlug ? norm(reqSlug) : '';
  const lid = l.tenantId != null ? norm(l.tenantId) : '';
  const lslug = (l as { tenantSlug?: string }).tenantSlug != null ? norm((l as { tenantSlug?: string }).tenantSlug!) : '';
  const lstore = (l as { storeId?: string }).storeId != null ? norm((l as { storeId?: string }).storeId!) : '';
  if (rid && (lid === rid || lslug === rid || lstore === rid)) return true;
  if (rslug && (lid === rslug || lslug === rslug || lstore === rslug)) return true;
  return false;
}

app.post('/leads', wrapAsync(async (req, res) => {
  const body = req.body as {
    tenantId?: string;
    tenantSlug?: string;
    professionalId?: string;
    type?: string;
    status?: string;
    contactType?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  };
  const tenantIdOrSlug = body.tenantId ?? body.tenantSlug ?? body.professionalId;
  if (!tenantIdOrSlug || typeof tenantIdOrSlug !== 'string') {
    return res.status(400).json({ error: 'tenantId or tenantSlug required' });
  }
  const resolvedTenantId = await resolveTenantId(tenantIdOrSlug);
  if (!resolvedTenantId) {
    return res.status(400).json({ error: 'Tenant not found' });
  }
  const rawType = body.type;
  const type =
    rawType === 'PROFESSIONAL_CONTACT'
      ? 'PROFESSIONAL_CONTACT'
      : (rawType === 'whatsapp' || rawType === 'call' || rawType === 'cta')
        ? rawType
        : 'cta';
  const userAgent = req.headers['user-agent'] ?? '';
  const metadata = { ...(body.metadata ?? {}), userAgent: userAgent || (body.metadata as Record<string, unknown>)?.userAgent };
  const lead = appendLead({
    tenantId: resolvedTenantId,
    type,
    status: body.status,
    contactType: body.contactType,
    timestamp: typeof body.timestamp === 'string' ? body.timestamp : undefined,
    metadata,
  });
  res.status(201).json(lead);
}));

app.get('/leads', wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const caller = req.user as { role?: string; marketId?: string; tenantId?: string };
  const querySlug = (req.query.tenantSlug as string)?.trim();
  const tenants = await repos.tenants.findAll();
  let filterTenantId: string | null = null;
  if (querySlug) {
    const resolved = await resolveTenantId(querySlug);
    if (!resolved) {
      return res.status(400).json({ error: 'Tenant not found for tenantSlug' });
    }
    if (caller.role === 'TENANT_ADMIN') {
      const myTenantId = String(caller.tenantId ?? '').trim();
      if (myTenantId && resolved !== myTenantId) return res.status(403).json({ error: 'Forbidden: can only view own tenant leads' });
      filterTenantId = resolved;
    } else if (caller.role === 'MARKET_ADMIN' && caller.marketId) {
      const t = tenants.find((x) => x.id === resolved);
      if (!t || (t as { marketId?: string }).marketId !== caller.marketId) return res.status(403).json({ error: 'Forbidden: tenant not in your market' });
      filterTenantId = resolved;
    } else {
      filterTenantId = resolved;
    }
  }
  let leads = getLeads();
  const scope = String(req.query.scope ?? '').trim().toLowerCase();
  if (scope === 'delivery') {
    leads = leads.filter((l) => isDeliveryLeadRecord(l));
  }
  if (isPlatformAdmin(caller.role)) {
    if (filterTenantId) {
      const t = tenants.find((x) => x.id === filterTenantId);
      const slug = (t as { slug?: string })?.slug;
      leads = leads.filter((l) => leadBelongsToTenantFilter(l, filterTenantId, slug, tenants));
    }
  } else if (caller.role === 'TENANT_ADMIN') {
    let myTenantId = filterTenantId ?? String(caller.tenantId ?? '').trim();
    if (!myTenantId && (caller as { id?: string }).id) {
      const users = await repos.users.findAll();
      const u = users.find((x) => x.id === (caller as { id?: string }).id);
      const tid = (u as { tenantId?: string })?.tenantId;
      if (tid) myTenantId = String(tid).trim();
    }
    const myTenant = myTenantId ? tenants.find((t) => norm(t.id) === norm(myTenantId) || norm((t as { slug?: string }).slug ?? '') === norm(myTenantId)) : null;
    const mySlug = (myTenant as { slug?: string })?.slug ?? (myTenantId && !myTenant ? myTenantId : '');
    const effectiveId = myTenant?.id ?? myTenantId;
    if (process.env.NODE_ENV !== 'production') {
      console.log('DEBUG GET /leads: User Slug:', mySlug, 'User TenantId:', myTenantId, 'EffectiveId:', effectiveId, 'First lead tenantId:', leads[0]?.tenantId, 'Total before filter:', leads.length);
    }
    if (effectiveId || mySlug) {
      leads = leads.filter((l) => leadBelongsToTenantFilter(l, effectiveId || mySlug, mySlug || undefined, tenants));
    } else {
      leads = [];
    }
  } else if (caller.role === 'MARKET_ADMIN' && caller.marketId) {
    const marketTenantIds = new Set(tenants.filter((t) => (t as { marketId?: string }).marketId === caller.marketId).map((t) => t.id));
    if (filterTenantId) {
      if (!marketTenantIds.has(filterTenantId)) leads = [];
      else {
        const t = tenants.find((x) => x.id === filterTenantId);
        const slug = (t as { slug?: string })?.slug;
        leads = leads.filter((l) => leadBelongsToTenantFilter(l, filterTenantId, slug, tenants));
      }
    } else {
      leads = leads.filter((l) => {
        if (l.tenantId == null) return false;
        const tid = String(l.tenantId).trim();
        if (marketTenantIds.has(tid)) return true;
        const tenant = tenants.find((t) => norm(t.id) === norm(tid) || norm((t as { slug?: string }).slug ?? '') === norm(tid));
        return !!tenant && marketTenantIds.has(tenant.id);
      });
    }
  }
  res.json(leads);
}));

function sortCustomersByCreatedAtDesc<T extends { createdAt?: string }>(customers: T[]): T[] {
  return [...customers].sort((a, b) => {
    const ta = new Date(a.createdAt ?? '').getTime();
    const tb = new Date(b.createdAt ?? '').getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
}

function buildCustomerLastActivityMap(
  orders: { customerId?: string; createdAt?: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const o of orders) {
    const cid = o.customerId;
    const at = o.createdAt;
    if (!cid || !at) continue;
    const prev = map.get(cid);
    if (!prev || at > prev) map.set(cid, at);
  }
  return map;
}

function enrichAndSortCustomersForAdminList(
  customers: import('./store.js').Customer[],
  orders: { customerId?: string; createdAt?: string }[],
  coinBalances?: Map<string, number>,
  trustMeta?: Map<
    string,
    {
      riskLevel: string;
      requiresConfirmation: boolean;
      cashOnDeliveryAllowed: boolean;
      hasIncidents: boolean;
      totalIncidents: number;
    }
  >,
) {
  const lastActivity = buildCustomerLastActivityMap(orders);
  return sortCustomersByCreatedAtDesc(
    customers.map((c) => {
      const trust = trustMeta?.get(c.id);
      return {
        ...c,
        lastActivityAt: lastActivity.get(c.id),
        coinsBalance: coinBalances?.get(c.phone) ?? coinBalances?.get(c.id) ?? null,
        riskLevel: trust?.riskLevel ?? 'NORMAL',
        requiresConfirmation: trust?.requiresConfirmation ?? false,
        cashOnDeliveryAllowed: trust?.cashOnDeliveryAllowed ?? true,
        hasIncidents: trust?.hasIncidents ?? false,
        totalIncidents: trust?.totalIncidents ?? 0,
      };
    }),
  );
}

function applyCustomerTrustListFilters<T extends {
  riskLevel?: string;
  requiresConfirmation?: boolean;
  cashOnDeliveryAllowed?: boolean;
  hasIncidents?: boolean;
}>(list: T[], query: express.Request['query']): T[] {
  const trustFilter = String(query.trustFilter ?? query.trust ?? '').trim().toUpperCase();
  if (!trustFilter || trustFilter === 'ALL') return list;
  return list.filter((c) => {
    switch (trustFilter) {
      case 'HIGH_RISK':
        return c.riskLevel === 'HIGH_RISK';
      case 'NEEDS_CONFIRMATION':
      case 'CONFIRMATION_REQUIRED':
        return c.requiresConfirmation === true || c.riskLevel === 'CONFIRMATION_REQUIRED';
      case 'BLOCKED_COD':
        return c.riskLevel === 'BLOCKED_COD' || c.cashOnDeliveryAllowed === false;
      case 'HAS_INCIDENTS':
        return c.hasIncidents === true;
      case 'NO_INCIDENTS':
        return c.hasIncidents !== true;
      default:
        return true;
    }
  });
}

async function buildCustomerCoinBalanceMap(
  customers: import('./store.js').Customer[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const c of customers) {
    const phoneKey = normalizePhoneForCoupon(c.phone);
    if (!phoneKey) continue;
    const { row } = await findCustomerCoinRow(prisma, phoneKey);
    if (row) map.set(c.phone, row.balance);
  }
  return map;
}

// --- Customers (role-based visibility) ---
// ROOT_ADMIN: all customers. TENANT_ADMIN: only customers who interacted with their tenant (orders or leads). MARKET_ADMIN: customers in their market.
app.get('/customers', wrapAsync(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const caller = req.user as { role?: string; marketId?: string; tenantId?: string };
  const allCustomers = await repos.customers.findAll();
  const allOrders = (await repos.orders.findAll()) as { customerId?: string; tenantId?: string; createdAt?: string }[];
  const allLeads = getLeads();

  if (isPlatformAdmin(caller.role)) {
    const coinBalances = await buildCustomerCoinBalanceMap(allCustomers);
    const querySlug = (req.query.tenantSlug as string)?.trim();
    if (querySlug) {
      const filterTenantId = await resolveTenantId(querySlug);
      if (!filterTenantId) return res.status(400).json({ error: 'Tenant not found for tenantSlug' });
      const customerIds = new Set<string>();
      allOrders.forEach((o) => {
        if (o.tenantId === filterTenantId && o.customerId) customerIds.add(o.customerId);
      });
      allLeads.forEach((l) => {
        if (l.tenantId === filterTenantId) {
          const cid = (l.metadata as { customerId?: string })?.customerId;
          if (cid) customerIds.add(cid);
        }
      });
      const filtered = allCustomers.filter((c) => customerIds.has(c.id));
      const trustMeta = await getTrustListMeta(prisma, filtered.map((c) => c.id));
      return res.json(
        applyCustomerTrustListFilters(
          enrichAndSortCustomersForAdminList(filtered, allOrders, coinBalances, trustMeta),
          req.query,
        ),
      );
    }
    const trustMeta = await getTrustListMeta(prisma, allCustomers.map((c) => c.id));
    return res.json(
      applyCustomerTrustListFilters(
        enrichAndSortCustomersForAdminList(allCustomers, allOrders, coinBalances, trustMeta),
        req.query,
      ),
    );
  }

  if (caller.role === 'TENANT_ADMIN' && caller.tenantId) {
    const myTenantId = String(caller.tenantId).trim();
    const customerIds = new Set<string>();
    allOrders.forEach((o) => {
      if (o.tenantId === myTenantId && o.customerId) customerIds.add(o.customerId);
    });
    allLeads.forEach((l) => {
      if (l.tenantId === myTenantId) {
        const cid = (l.metadata as { customerId?: string })?.customerId;
        if (cid) customerIds.add(cid);
      }
    });
    const filtered = allCustomers.filter((c) => customerIds.has(c.id));
    return res.json(enrichAndSortCustomersForAdminList(filtered, allOrders));
  }

  if (caller.role === 'MARKET_ADMIN' && caller.marketId) {
    const tenants = await repos.tenants.findAll();
    const marketTenantIds = new Set(tenants.filter((t) => (t as { marketId?: string }).marketId === caller.marketId).map((t) => t.id));
    const customerIds = new Set<string>();
    allOrders.forEach((o) => {
      if (o.tenantId && marketTenantIds.has(o.tenantId) && o.customerId) customerIds.add(o.customerId);
    });
    allLeads.forEach((l) => {
      if (l.tenantId && marketTenantIds.has(l.tenantId)) {
        const cid = (l.metadata as { customerId?: string })?.customerId;
        if (cid) customerIds.add(cid);
      }
    });
    const filtered = allCustomers.filter((c) => customerIds.has(c.id));
    return res.json(enrichAndSortCustomersForAdminList(filtered, allOrders));
  }

  return res.status(403).json({ error: 'Forbidden' });
}));

// --- Merchant Dashboard (TENANT_ADMIN or public with tenantSlug for demo) ---
/** Match lead to tenant by UUID or slug (fallback for legacy leads). Case-insensitive. */
function leadBelongsToTenant(l: { tenantId?: string }, tenantId: string, tenantSlug: string | undefined): boolean {
  if (!l.tenantId) return false;
  const tid = norm(String(l.tenantId));
  const rid = norm(tenantId);
  const rslug = tenantSlug ? norm(tenantSlug) : '';
  return tid === rid || (!!rslug && tid === rslug);
}

app.get('/merchant/dashboard', wrapAsync(async (req, res) => {
  let tenantId: string | undefined;
  let tenantSlug: string | undefined;
  const caller = req.user as { role?: string; tenantId?: string } | undefined;
  if (caller?.role === 'TENANT_ADMIN' && caller.tenantId) {
    tenantId = caller.tenantId;
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === tenantId);
    tenantSlug = (t as { slug?: string })?.slug;
  } else {
    const slug = (req.query.tenantSlug as string)?.trim();
    if (slug) {
      tenantSlug = slug;
      const tenants = await repos.tenants.findAll();
      const t = tenants.find((x) => (x as { slug?: string }).slug === slug);
      tenantId = t?.id;
    }
  }
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantSlug required (or auth as TENANT_ADMIN)' });
  }
  const allCustomers = await repos.customers.findAll();
  const allOrders = (await repos.orders.findAll()) as { customerId?: string; tenantId?: string; customerName?: string; customerPhone?: string; createdAt?: string }[];
  const allLeads = getLeads();
  const customerIds = new Set<string>();
  const recentByCustomer = new Map<string, { name: string; phone: string; lastAt: string }>();
  allOrders.forEach((o) => {
    if (o.tenantId === tenantId && o.customerId) {
      customerIds.add(o.customerId);
      const c = allCustomers.find((x) => x.id === o.customerId);
      const name = c?.name ?? o.customerName ?? '';
      const phone = c?.phone ?? o.customerPhone ?? '';
      const lastAt = o.createdAt ?? '';
      const existing = recentByCustomer.get(o.customerId);
      if (!existing || (lastAt && (!existing.lastAt || lastAt > existing.lastAt))) {
        recentByCustomer.set(o.customerId, { name, phone, lastAt });
      }
    }
  });
  allLeads.forEach((l) => {
    if (leadBelongsToTenant(l, tenantId!, tenantSlug)) {
      const cid = (l.metadata as { customerId?: string })?.customerId;
      if (cid) {
        customerIds.add(cid);
        const c = allCustomers.find((x) => x.id === cid);
        const ts = (l as { timestamp?: string }).timestamp ?? '';
        const existing = recentByCustomer.get(cid);
        if (!existing || (ts && (!existing.lastAt || ts > existing.lastAt))) {
          recentByCustomer.set(cid, { name: c?.name ?? '', phone: c?.phone ?? '', lastAt: ts });
        }
      }
    }
  });
  const recentLogins = Array.from(recentByCustomer.entries())
    .sort((a, b) => (b[1].lastAt || '').localeCompare(a[1].lastAt || ''))
    .slice(0, 10)
    .map(([, v]) => ({ name: v.name || '—', phone: v.phone || '—', lastVisit: v.lastAt }));
  res.json({ totalVisitors: customerIds.size, recentLogins });
}));

/** Professional/Merchant leads by tenantSlug (for storefront dashboard; no auth). Matches tenantId and tenantSlug. */
app.get('/merchant/leads', wrapAsync(async (req, res) => {
  const slug = (req.query.tenantSlug as string)?.trim();
  if (!slug) return res.status(400).json({ error: 'tenantSlug required' });
  const tenantId = await resolveTenantId(slug);
  if (!tenantId) return res.status(404).json({ error: 'Tenant not found' });
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === tenantId);
  const tenantSlug = (t as { slug?: string })?.slug;
  const allLeads = getLeads();
  const list = allLeads.filter((l) => leadBelongsToTenant(l, tenantId, tenantSlug));
  list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  res.json(list.slice(0, 50));
}));

// --- Audit (ROOT only) ---
app.get('/audit-events', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const events = getAuditEvents().slice(-limit).reverse();
  res.json(events);
});

// --- Monitoring (ROOT only) ---
app.get('/monitoring/stats', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  const markets = (await repos.markets.findAll());
  const tenants = (await repos.tenants.findAll());
  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; total?: number; createdAt?: string }[];
  const stats = markets.map((m) => {
    const marketTenants = tenants.filter((t) => t.marketId === m.id);
    const tenantIds = new Set(marketTenants.map((t) => t.id));
    const marketOrders = orders.filter((o) => o.tenantId && tenantIds.has(o.tenantId));
    const revenue = marketOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return {
      marketId: m.id,
      marketName: m.name,
      tenantCount: marketTenants.length,
      orderCount: marketOrders.length,
      revenue,
    };
  });
  res.json(stats);
});

// --- Users (ROOT only) ---
app.get('/users', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  const users = (await repos.users.findAll()).map((u) => ({ ...u, password: undefined }));
  res.json(users);
});

/** Admin: FCM delivery readiness (no fake “success” in UI). */
app.get('/admin/notifications/status', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const tokens = await getAllCustomerFcmTokens();
  const uniqueTokens = Array.from(new Set(tokens.map((tok) => tok.trim()).filter(Boolean)));
  const fcmConfigured = isFCMConfigured();
  res.json({
    fcmConfigured,
    registeredCustomerTokens: uniqueTokens.length,
    pushReady: fcmConfigured && uniqueTokens.length > 0,
    message: !fcmConfigured
      ? 'الإشعارات غير مفعلة بعد — تحتاج ربط FCM (FIREBASE_SERVICE_ACCOUNT_JSON أو PATH)'
      : uniqueTokens.length === 0
        ? 'لا توجد أجهزة عملاء مسجّلة — التطبيق يحتاج حفظ رمز FCM'
        : 'جاهز للإرسال عبر FCM',
  });
}));

/** Admin broadcast: send FCM to customers. Body: { title, body, imageUrl?, route?, marketSlug? }. */
app.post('/admin/notifications/broadcast', wrapAsync(async (req, res) => {
  const user = req.user as { id?: string; role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  const body = req.body as {
    title?: string;
    body?: string;
    imageUrl?: string;
    route?: string;
    marketSlug?: string;
    scheduledAt?: string;
  };
  const t = typeof body.title === 'string' ? body.title.trim() : '';
  const b = typeof body.body === 'string' ? body.body.trim() : '';
  if (!t && !b) return res.status(400).json({ error: 'title or body required' });

  const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt.trim() : '';
  if (scheduledAt) {
    const when = Date.parse(scheduledAt);
    if (!Number.isNaN(when) && when > Date.now()) {
      return res.status(501).json({
        error: 'Scheduled push not implemented yet',
        message: 'الجدولة غير مفعّلة بعد — أرسل الآن أو استخدم cron خارجي',
        scheduledAt,
      });
    }
  }

  if (!isFCMConfigured()) {
    return res.status(503).json({
      error: 'FCM not configured',
      fcmConfigured: false,
      message: 'الإشعارات غير مفعلة بعد — تحتاج ربط FCM',
    });
  }

  let tokens = await getAllCustomerFcmTokens();
  const marketSlug = typeof body.marketSlug === 'string' ? body.marketSlug.trim() : '';
  if (marketSlug) {
    const markets = await repos.markets.findAll();
    const market = markets.find((m) => m.slug === marketSlug);
    if (!market) {
      return res.status(404).json({ error: 'Market not found', marketSlug });
    }
    if (isStorageDb()) {
      const orders = await prisma.order.findMany({
        where: { marketId: market.id },
        select: { payload: true },
      });
      const phones = new Set<string>();
      for (const o of orders) {
        try {
          const p = typeof o.payload === 'string' ? JSON.parse(o.payload) : o.payload;
          const ph = (p as { customerPhone?: string })?.customerPhone;
          if (ph) phones.add(normalizeInternationalPhoneDigits(ph));
        } catch {
          /* skip malformed payload */
        }
      }
      const customers = await repos.customers.findAll();
      const ids = customers
        .filter((c) => phones.has(normalizeInternationalPhoneDigits(c.phone)))
        .map((c) => c.id);
      const rows = await prisma.customerFCMToken.findMany({
        where: { customerId: { in: ids } },
        select: { token: true },
      });
      tokens = rows.map((r) => r.token);
    } else {
      console.warn('[FCM] marketSlug filter requires STORAGE_DRIVER=db — sending to all tokens');
    }
  }
  const uniqueTokens = Array.from(new Set(tokens.map((tok) => tok.trim()).filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return res.status(422).json({
      sent: 0,
      failed: 0,
      totalTokens: 0,
      fcmConfigured: true,
      error: 'No customer FCM tokens registered',
      message: marketSlug
        ? `لا أجهزة مسجّلة لسوق ${marketSlug}`
        : 'لا توجد أجهزة عملاء مسجّلة — لم يُرسل أي إشعار',
    });
  }

  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const route = typeof body.route === 'string' ? body.route.trim() : '';
  const payload = {
    title: t || 'إشعار',
    body: b || '',
    ...(imageUrl ? { imageUrl } : {}),
    data: {
      ...(route ? { route } : {}),
      type: 'admin_broadcast',
    },
  };
  const { successCount, failureCount } = await sendFCMMulticast(uniqueTokens, payload);
  if (successCount === 0) {
    return res.status(502).json({
      sent: 0,
      failed: failureCount,
      totalTokens: uniqueTokens.length,
      fcmConfigured: true,
      error: 'FCM delivery failed for all tokens',
      message: 'فشل إرسال الإشعار لجميع الأجهزة',
    });
  }
  res.json({
    sent: successCount,
    failed: failureCount,
    totalTokens: uniqueTokens.length,
    fcmConfigured: true,
    message:
      failureCount > 0
        ? `تم الإرسال إلى ${successCount} جهاز (فشل ${failureCount})`
        : `تم الإرسال إلى ${successCount} جهاز`,
  });
}));

/** Super Admin: send a manual notification to a single customer by customerId or phone. */
app.post('/admin/notifications/send-to-customer', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  const body = req.body as {
    customerId?: string;
    phone?: string;
    title?: string;
    body?: string;
    imageUrl?: string;
    route?: string;
  };
  const inputPhone = (body.phone ?? '').toString().trim();
  const inputCustomerId = (body.customerId ?? '').toString().trim();
  if (!inputPhone && !inputCustomerId) {
    return res.status(400).json({ error: 'phone or customerId required', message: 'أدخل رقم الهاتف أو معرف العميل' });
  }
  const title = (body.title ?? '').toString().trim() || 'إشعار';
  const msgBody = (body.body ?? '').toString().trim() || '';
  if (!isFCMConfigured()) {
    return res.status(503).json({
      ok: false,
      sent: 0,
      failed: 0,
      fcmConfigured: false,
      error: 'FCM not configured',
      message: 'الإشعارات غير مفعلة بعد — تحتاج ربط FCM',
    });
  }

  const customer = await findCustomerByPhoneOrId({
    phone: inputPhone || undefined,
    customerId: inputCustomerId || undefined,
  });
  const lookupPhone = inputPhone || inputCustomerId;
  const normalized = customer ? normalizePhoneForMatch(customer.phone) : normalizePhoneForMatch(lookupPhone);

  if (!customer) {
    console.log('[ADMIN_PUSH_TARGET]', {
      phone: lookupPhone,
      normalized,
      customerId: '',
      tokens: 0,
      sent: 0,
      failed: 0,
      reason: 'customer_not_found',
    });
    return res.status(404).json({
      ok: false,
      sent: 0,
      failed: 0,
      fcmConfigured: true,
      error: 'Customer not found',
      message: 'لم يتم العثور على زبون بهذا الرقم',
    });
  }

  const customerId = customer.id;
  const tokens = await getCustomerFcmTokens(customerId);

  console.log('[ADMIN_PUSH_TARGET]', {
    phone: lookupPhone,
    normalized,
    customerId,
    tokens: tokens.length,
    sent: 0,
    failed: 0,
  });

  if (tokens.length === 0) {
    return res.status(422).json({
      ok: false,
      sent: 0,
      failed: 0,
      fcmConfigured: true,
      error: 'No FCM token for customer',
      message: 'لا يوجد جهاز مسجل لهذا الزبون',
      customerId,
      normalized,
    });
  }

  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const route = typeof body.route === 'string' ? body.route.trim() : '';
  let sent = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const token of tokens) {
    const result = await sendAdminFCMToToken(
      token,
      {
        title,
        body: msgBody,
        ...(imageUrl ? { imageUrl } : {}),
        data: {
          ...(route ? { route } : {}),
          type: 'admin_direct',
          customerId,
        },
      },
      'customer_notifications',
    );
    if (result.success) sent++;
    else {
      failed++;
      if (result.error) failures.push(result.error);
    }
  }

  console.log('[ADMIN_PUSH_TARGET]', {
    phone: lookupPhone,
    normalized,
    customerId,
    tokens: tokens.length,
    sent,
    failed,
    ...(failures.length ? { failureReason: failures[0] } : {}),
  });

  if (sent <= 0) {
    return res.status(502).json({
      ok: false,
      sent: 0,
      failed,
      totalTokens: tokens.length,
      fcmConfigured: true,
      error: failures[0] ?? 'FCM send failed',
      message: 'فشل إرسال الإشعار للعميل',
      customerId,
    });
  }

  res.json({
    ok: true,
    sent,
    failed,
    totalTokens: tokens.length,
    fcmConfigured: true,
    message: 'تم إرسال الإشعار بنجاح',
    customerId,
    ...(failed > 0 && failures[0] ? { warning: failures[0] } : {}),
  });
}));

/** ROOT_ADMIN: Reset any user. MARKET_ADMIN: Reset only TENANT_ADMIN whose tenant is in their market. */
app.post('/admin/users/:userId/reset-password', async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { userId } = req.params;
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword required (min 6 chars)' });
  }
  const users = await repos.users.findAll();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const target = users[idx];

  if (isPlatformAdmin(caller.role)) {
    // Root can reset anyone
  } else if (caller.role === 'MARKET_ADMIN' && caller.marketId) {
    if (target.role !== 'TENANT_ADMIN' || !target.tenantId) {
      return res.status(403).json({ error: 'Can only reset tenant admin passwords for stores in your market' });
    }
    const tenants = await repos.tenants.findAll();
    const tenant = tenants.find((t) => t.id === target.tenantId);
    if (!tenant || (tenant as { marketId?: string }).marketId !== caller.marketId) {
      return res.status(403).json({ error: 'Store is not in your market' });
    }
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }

  users[idx] = { ...users[idx], password: newPassword, mustChangePassword: true };
  console.log('Updating password for User ID:', userId, 'to:', newPassword);
  await repos.users.setAll(users);
  if (process.env.NODE_ENV !== 'production') {
    console.log('Password updated successfully for tenant:', (target as { tenantId?: string }).tenantId ?? userId);
  }

  appendAuditEvent({
    userId: caller.id,
    role: caller.role,
    marketId: (caller as { marketId?: string }).marketId,
    action: 'update',
    entity: 'user',
    entityId: userId,
    reason: `Password reset by ${caller.email}`,
  });

  res.json({ ok: true });
});

/** MARKET_ADMIN: List tenant admins for a market. ROOT_ADMIN: any market. */
app.get('/markets/:marketId/tenant-admins', async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { marketId } = req.params;
  if (caller.role === 'MARKET_ADMIN' && caller.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = (await repos.users.findAll()).filter(
    (u) => u.role === 'TENANT_ADMIN' && u.tenantId
  );
  const tenants = await repos.tenants.findAll();
  const marketTenantIds = new Set(
    tenants.filter((t) => (t as { marketId?: string }).marketId === marketId).map((t) => t.id)
  );
  const result = users
    .filter((u) => u.tenantId && marketTenantIds.has(u.tenantId))
    .map((u) => ({ ...u, password: undefined }));
  res.json(result);
});

/** Get tenant admin for a specific tenant. ROOT_ADMIN: any. MARKET_ADMIN: only tenants in their market. */
app.get('/tenants/:tenantId/tenant-admin', async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (caller.role === 'MARKET_ADMIN' && (tenant as { marketId?: string }).marketId !== caller.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = await repos.users.findAll();
  const admin = users.find((u) => u.role === 'TENANT_ADMIN' && u.tenantId === tenantId);
  if (!admin) return res.status(404).json({ error: 'No tenant admin found' });
  res.json({ ...admin, password: undefined });
});

/** Create TENANT_ADMIN for an existing tenant (legacy stores). ROOT_ADMIN: any. MARKET_ADMIN: only tenants in their market. */
app.post('/tenants/:tenantId/create-admin', async (req, res) => {
  const caller = req.user;
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  const { tenantId } = req.params;
  const body = req.body as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'email and password required (password min 6 chars)' });
  }
  const tenants = await repos.tenants.findAll();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (caller.role === 'MARKET_ADMIN' && (tenant as { marketId?: string }).marketId !== caller.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = await repos.users.findAll();
  const existingAdmin = users.find((u) => u.role === 'TENANT_ADMIN' && u.tenantId === tenantId);
  if (existingAdmin) {
    return res.status(400).json({ error: 'Tenant already has an admin account' });
  }
  const emailLower = email.toLowerCase();
  if (users.some((u) => u.email?.toLowerCase() === emailLower)) {
    return res.status(400).json({ error: 'Email already in use' });
  }
  const userId = crypto.randomUUID?.() ?? `user-${Date.now()}`;
  users.push({
    id: userId,
    email: emailLower,
    role: 'TENANT_ADMIN',
    tenantId,
    password,
  });
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: caller.id,
    role: caller.role,
    marketId: (caller as { marketId?: string }).marketId,
    action: 'create',
    entity: 'user',
    entityId: userId,
    reason: `Created tenant admin for ${tenant.name}`,
  });
  res.status(201).json({ id: userId, email: emailLower, role: 'TENANT_ADMIN', tenantId });
});

// --- Global Categories (platform-level, for mall homepage) ---
app.get('/global-categories', (_req, res) => {
  res.json(getGlobalCategories());
});

app.get('/config/payment-methods', (_req, res) => {
  const cfg = getGlobalConfig()?.paymentMethods ?? { cash: true, card: true, installments: true };
  res.json({ paymentMethods: cfg });
});

app.put('/config/payment-methods', (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body as { paymentMethods?: Partial<PaymentMethodsToggle> };
  const current = getGlobalConfig()?.paymentMethods ?? { cash: true, card: true, installments: true };
  const next: PaymentMethodsToggle = {
    cash: body.paymentMethods?.cash ?? current.cash,
    card: body.paymentMethods?.card ?? current.card,
    installments: body.paymentMethods?.installments ?? current.installments,
  };
  setGlobalConfig({ paymentMethods: next });
  res.json({ paymentMethods: next });
});

/** Public: customer Support Center reads live config (no rebuild). */
app.get('/config/support', (_req, res) => {
  res.json({ support: getSupportConfig() });
});

/** Super Admin: update Support Center settings immediately. */
app.put('/config/support', (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = (req.body ?? {}) as { support?: Partial<ReturnType<typeof getSupportConfig>> };
  const patch = body.support ?? (body as Partial<ReturnType<typeof getSupportConfig>>);
  const next = setSupportConfig(patch);
  res.json({ support: next });
});

/** Support analytics — event names only; never store message content. */
const SUPPORT_ANALYTICS_EVENTS = new Set([
  'support_page_opened',
  'floating_support_impression',
  'support_hub_opened',
  'whatsapp_click',
  'phone_click',
  'order_support_click',
  'copy_order_number',
]);
const supportAnalyticsCounters: Record<string, number> = {
  support_page_opened: 0,
  floating_support_impression: 0,
  support_hub_opened: 0,
  whatsapp_click: 0,
  phone_click: 0,
  order_support_click: 0,
  copy_order_number: 0,
};

app.post('/analytics/support', (req, res) => {
  const event = String((req.body as { event?: string })?.event ?? '')
    .trim()
    .toLowerCase();
  if (!SUPPORT_ANALYTICS_EVENTS.has(event)) {
    return res.status(400).json({ error: 'Invalid event' });
  }
  supportAnalyticsCounters[event] = (supportAnalyticsCounters[event] ?? 0) + 1;
  // Intentionally ignore message / PII fields if sent
  res.json({ ok: true, event });
});

app.get('/analytics/support', (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  res.json({ events: { ...supportAnalyticsCounters } });
});

/** Alias for Big Admin / tenant select: same data as /global-categories */
app.get('/categories', (_req, res) => {
  res.json(getGlobalCategories());
});

app.post('/global-categories', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body as {
    title: string;
    nameAr?: string;
    icon: string;
    isProfessional?: boolean;
    sortOrder?: number;
    iconUrl?: string;
    /** App route/query as set in admin, e.g. `?pillar=pillar-food` or `/market/slug/rewards` */
    targetPath?: string;
  };
  const id = crypto.randomUUID?.() ?? `cat-${Date.now()}`;
  const cat: GlobalCategory = {
    id,
    title: body.title ?? '',
    nameAr: body.nameAr != null ? String(body.nameAr).trim() || undefined : undefined,
    icon: body.icon ?? '📦',
    iconUrl: body.iconUrl != null && String(body.iconUrl).trim() !== '' ? String(body.iconUrl).trim() : undefined,
    isProfessional: body.isProfessional ?? false,
    sortOrder: body.sortOrder ?? 999,
    targetPath: body.targetPath != null && String(body.targetPath).trim() !== '' ? String(body.targetPath).trim() : undefined,
  };
  const cats = getGlobalCategories();
  cats.push(cat);
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'create',
    entity: 'globalCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: cat,
  });
  res.status(201).json(cat);
});

app.put('/global-categories/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body as Partial<Omit<GlobalCategory, 'id'>>;
  const cats = getGlobalCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  const before = cats[idx];
  cats[idx] = { ...cats[idx], ...body };
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'update',
    entity: 'globalCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: cats[idx],
  });
  res.json(cats[idx]);
});

app.delete('/global-categories/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const cats = getGlobalCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  const removed = cats[idx];
  cats.splice(idx, 1);
  setGlobalCategories(cats);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'delete',
    entity: 'globalCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before: removed,
  });
  res.status(204).send();
});

// --- Pillars & Sub-Categories (storefront sections; admin-managed) ---
app.get('/pillars', (_req, res) => {
  res.json(getPillars());
});

app.post('/pillars', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body as { name: string; nameAr?: string; slug?: string; icon?: string; sortOrder?: number };
  const id = crypto.randomUUID?.() ?? `pillar-${Date.now()}`;
  const slug = (body.slug ?? body.name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || id;
  const pillar: Pillar = {
    id,
    name: body.name ?? '',
    nameAr: body.nameAr != null ? String(body.nameAr).trim() || undefined : undefined,
    slug,
    icon: body.icon,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : getPillars().length,
  };
  const list = getPillars();
  list.push(pillar);
  setPillars(list);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'create',
    entity: 'pillar',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: pillar,
  });
  res.status(201).json(pillar);
});

app.put('/pillars/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body as Partial<Omit<Pillar, 'id'>>;
  const list = getPillars();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Pillar not found' });
  const before = list[idx];
  list[idx] = { ...list[idx], ...body };
  setPillars(list);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'update',
    entity: 'pillar',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: list[idx],
  });
  res.json(list[idx]);
});

app.delete('/pillars/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const list = getPillars();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Pillar not found' });
  const removed = list[idx];
  const subs = getSubCategories().filter((s) => s.pillarId === id);
  if (subs.length > 0) {
    return res.status(400).json({ error: 'Cannot delete pillar: remove or reassign its sub-categories first' });
  }
  list.splice(idx, 1);
  setPillars(list);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'delete',
    entity: 'pillar',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before: removed,
  });
  res.status(204).send();
});

app.get('/sub-categories', (req, res) => {
  const pillarId = (req.query.pillarId as string)?.trim();
  let list = getSubCategories();
  if (pillarId) list = list.filter((s) => s.pillarId === pillarId);
  res.json(list);
});

app.post('/sub-categories', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body as { pillarId: string; name: string; nameAr?: string; slug?: string; sortOrder?: number };
  const pillarId = (body.pillarId ?? '').trim();
  if (!pillarId) return res.status(400).json({ error: 'pillarId is required' });
  const pillars = getPillars();
  if (!pillars.some((p) => p.id === pillarId)) return res.status(400).json({ error: 'Pillar not found' });
  const id = crypto.randomUUID?.() ?? `sub-${Date.now()}`;
  const slug = (body.slug ?? body.name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || id;
  const sub: SubCategory = {
    id,
    pillarId,
    name: body.name ?? '',
    nameAr: body.nameAr != null ? String(body.nameAr).trim() || undefined : undefined,
    slug,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : getSubCategories().length,
  };
  const list = getSubCategories();
  list.push(sub);
  setSubCategories(list);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'create',
    entity: 'subCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: sub,
  });
  res.status(201).json(sub);
});

app.put('/sub-categories/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body as Partial<Omit<SubCategory, 'id'>>;
  const list = getSubCategories();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Sub-category not found' });
  const before = list[idx];
  list[idx] = { ...list[idx], ...body };
  setSubCategories(list);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'update',
    entity: 'subCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: list[idx],
  });
  res.json(list[idx]);
});

app.delete('/sub-categories/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const list = getSubCategories();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Sub-category not found' });
  const removed = list[idx];
  list.splice(idx, 1);
  setSubCategories(list);
  const tenants = await repos.tenants.findAll();
  let changed = false;
  for (let i = 0; i < tenants.length; i++) {
    if (tenants[i].subCategoryId === id) {
      (tenants[i] as RegistryTenant).subCategoryId = null;
      changed = true;
    }
  }
  if (changed) await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'delete',
    entity: 'subCategory',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before: removed,
  });
  res.status(204).send();
});

// --- Category policies (SLA: green/orange/red thresholds per category) ---
app.get('/category-policies', (_req, res) => {
  res.json(getCategoryPolicies());
});

app.patch('/category-policies/:id', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden: platform admin only' });
  if (!requireWriteWithReason(req, res)) return;
  const { id } = req.params;
  const body = req.body as { name?: string; greenMs?: number; orangeMs?: number; redMs?: number; isUrgent?: boolean };
  const policies = getCategoryPolicies();
  const idx = policies.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Category policy not found' });
  const before = { ...policies[idx] };
  if (body.name !== undefined) policies[idx].name = String(body.name).trim() || policies[idx].name;
  if (typeof body.greenMs === 'number' && body.greenMs >= 0) policies[idx].greenMs = body.greenMs;
  if (typeof body.orangeMs === 'number' && body.orangeMs >= 0) policies[idx].orangeMs = body.orangeMs;
  if (typeof body.redMs === 'number' && body.redMs >= 0) policies[idx].redMs = body.redMs;
  if (typeof body.isUrgent === 'boolean') policies[idx].isUrgent = body.isUrgent;
  setCategoryPolicies(policies);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'update',
    entity: 'categoryPolicy',
    entityId: id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    before,
    after: policies[idx],
  });
  res.json(policies[idx]);
});

// --- Markets ---
app.get('/markets', async (req, res) => {
  const user = req.user;
  let markets = (await repos.markets.findAll());
  if (user?.role === 'MARKET_ADMIN' && user.marketId) {
    markets = markets.filter((m) => m.id === user.marketId);
  } else {
    const all = req.query.all === 'true';
    if (!all) markets = markets.filter((m) => m.isActive);
  }
  res.json([...markets].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)));
});

app.post('/markets', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const body = req.body as {
    name: string; slug: string; imageUrl?: string; branding?: unknown; isActive?: boolean; sortOrder?: number;
    adminEmail?: string; adminPassword?: string;
  };
  const id = crypto.randomUUID?.() ?? `market-${Date.now()}`;
  const market: Market = {
    id,
    name: body.name ?? '',
    slug: body.slug ?? id,
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
    branding: body.branding as Market['branding'],
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder,
  };
  const markets = (await repos.markets.findAll());
  markets.push(market);
  await repos.markets.setAll(markets);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    action: 'create',
    entity: 'market',
    entityId: market.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: market,
  });
  const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : '';
  const adminPassword = typeof body.adminPassword === 'string' ? body.adminPassword : '';
  if (adminEmail && adminPassword.length >= 6) {
    const users = (await repos.users.findAll());
    if (!users.some((u) => u.email?.toLowerCase() === adminEmail)) {
      const userId = `user-${crypto.randomUUID?.() ?? Date.now()}`;
      const newUser: User = {
        id: userId,
        email: adminEmail,
        role: 'MARKET_ADMIN',
        marketId: market.id,
        password: adminPassword,
      };
      users.push(newUser);
      await repos.users.setAll(users);
      appendAuditEvent({
        userId: req.user!.id,
        role: req.user!.role,
        marketId: market.id,
        action: 'create',
        entity: 'user',
        entityId: newUser.id,
        reason: getEmergencyReason(req),
        emergencyMode: true,
        after: newUser,
      });
    }
  }
  res.status(201).json(market);
});

app.put('/markets/:id', async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const isRoot = isPlatformAdmin(user?.role);
  const isMarketAdminOwn = user?.role === 'MARKET_ADMIN' && user.marketId === id;
  if (!isRoot && !isMarketAdminOwn) return res.status(403).json({ error: 'Forbidden' });
  if (isRoot && !requireWriteWithReason(req, res)) return;
  const body = req.body as Partial<Omit<Market, 'id'>>;
  const markets = (await repos.markets.findAll());
  const idx = markets.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Market not found' });
  const before = markets[idx];
  if (isMarketAdminOwn && !isRoot) {
    const { name, sortOrder, ...rest } = body;
    if (name !== undefined || sortOrder !== undefined) return res.status(403).json({ error: 'Forbidden: only Super Admin can change display name and sort order' });
    Object.assign(markets[idx], rest);
  } else {
    markets[idx] = { ...markets[idx], ...body };
  }
  try {
    // Persists to PostgreSQL when STORAGE_DRIVER=db (imageUrl, name, etc.). GET /markets returns same data so frontend shows update immediately.
    await repos.markets.setAll(markets);
  } catch (err) {
    console.error('[markets] Failed to persist (check file permissions, e.g. /data):', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Failed to save market', code: 'PERSIST_ERROR' });
  }
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    action: 'update',
    entity: 'market',
    entityId: id,
    reason: isRoot ? getEmergencyReason(req) : undefined,
    emergencyMode: isRoot,
    before,
    after: markets[idx],
  });
  res.json(markets[idx]);
});

app.get('/markets/by-slug/:slug', async (req, res) => {
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const market = (await repos.markets.findAll()).find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!market.isActive) return res.status(404).json({ error: 'Market not found' });
  res.json(market);
});

app.get('/markets/by-slug/:slug/banners', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const market = (await repos.markets.findAll()).find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const banners = getBannersForMarket(slugNorm);
  res.json(banners);
});

app.get('/markets/by-slug/:slug/layout', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const market = (await repos.markets.findAll()).find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const layout = getLayoutForMarket(slugNorm);
  res.json(layout);
});

app.get('/markets/by-slug/:slug/feed-campaigns', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const market = (await repos.markets.findAll()).find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const all = req.query.all === '1' || req.query.admin === '1';
  try {
    if (all) {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== market.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const shape = getFeedCampaignsConfigShape();
    const rows = all
      ? getFeedCampaignsForMarketAdmin(slugNorm)
      : getFeedCampaignsForMarket(slugNorm);
    const list = Array.isArray(rows) ? rows : [];
    console.log(`[FEED_CAMPAIGNS_API] slug=${slugNorm} shape=${shape} count=${list.length}`);
    return res.json(list);
  } catch (err) {
    console.error('[FEED_CAMPAIGNS_API] GET failed — returning []', err);
    return res.json([]);
  }
});

app.get('/markets/by-slug/:slug/home-feed-settings', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const market = (await repos.markets.findAll()).find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  res.json(getHomeFeedSettingsForMarket(slugNorm));
});

app.put('/markets/by-slug/:slug/home-feed-settings', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== market.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body as Partial<HomeFeedSettings>;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'home feed settings must be an object' });
  }
  setHomeFeedSettingsForMarket(slugNorm, body as HomeFeedSettings);
  res.json(getHomeFeedSettingsForMarket(slugNorm));
});

app.put('/markets/by-slug/:slug/feed-campaigns', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== market.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body as unknown;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'feed campaigns payload must be an array' });
  }
  const campaigns = body as MarketFeedCampaign[];
  console.log(`[FEED_CAMPAIGNS_API] PUT slug=${slugNorm} count=${campaigns.length}`);
  setFeedCampaignsForMarket(slugNorm, campaigns);
  const saved = getFeedCampaignsForMarketAdmin(slugNorm);
  console.log(`[FEED_CAMPAIGNS_API] PUT saved count=${Array.isArray(saved) ? saved.length : 0}`);
  res.json(saved);
});

app.get('/markets/by-slug/:slug/modifier-icons', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const market = (await repos.markets.findAll()).find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const all = req.query.all === '1' || req.query.admin === '1';
  try {
    if (all) {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      if (!isPlatformAdmin(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const list = getModifierIconsForMarketAdmin(slugNorm);
      return res.json(Array.isArray(list) ? list : []);
    }
    const list = getModifierIconsForMarket(slugNorm);
    return res.json(Array.isArray(list) ? list : []);
  } catch (err) {
    console.error('[MODIFIER_ICONS_API] GET failed — returning []', err);
    return res.json([]);
  }
});

app.put('/markets/by-slug/:slug/modifier-icons', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!isPlatformAdmin(user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const body = req.body as unknown;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'modifier icons payload must be an array' });
  }
  const icons = body as ModifierIcon[];
  console.log(`[MODIFIER_ICONS_API] PUT slug=${slugNorm} count=${icons.length}`);
  setModifierIconsForMarket(slugNorm, icons);
  const saved = getModifierIconsForMarketAdmin(slugNorm);
  res.json(Array.isArray(saved) ? saved : []);
});

app.get('/markets/by-slug/:slug/home-page-blocks', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const market = (await repos.markets.findAll()).find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const all = req.query.all === '1' || req.query.admin === '1';
  try {
    if (all) {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== market.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const list = getHomePageBlocksForMarketAdmin(slugNorm);
      logHomePageBlocksGet(slugNorm, list, true);
      return res.json(Array.isArray(list) ? list : []);
    }
    const list = getHomePageBlocksForMarket(slugNorm);
    logHomePageBlocksGet(slugNorm, list, false);
    return res.json(Array.isArray(list) ? list : []);
  } catch (err) {
    console.error('[HOME_PAGE_BLOCKS_API] GET failed — returning []', err);
    return res.json([]);
  }
});

app.put('/markets/by-slug/:slug/home-page-blocks', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== market.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body as unknown;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'home page blocks payload must be an array' });
  }
  const blocks = body as HomePageBlock[];
  const validationErrors = validateHomePageBlocks(
    blocks.map((b, i) => ({ ...b, sortOrder: i })),
  );
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: validationErrors.join(' · ') });
  }
  try {
    setHomePageBlocksForMarket(slugNorm, blocks);
    const saved = getHomePageBlocksForMarketAdmin(slugNorm);
    return res.json(Array.isArray(saved) ? saved : []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save home page blocks';
    return res.status(400).json({ error: msg });
  }
});

app.put('/markets/by-slug/:slug/banners', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== market.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const banners = req.body as unknown;
  if (!Array.isArray(banners)) {
    return res.json(getBannersForMarket(slugNorm));
  }
  setBannersForMarket(slugNorm, banners);
  res.json(banners);
});

app.put('/markets/by-slug/:slug/layout', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const slugNorm = normalizeMarketSlugForConfig(req.params.slug);
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.slug === slugNorm || m.slug === req.params.slug.trim());
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!isPlatformAdmin(user.role) && (user.role !== 'MARKET_ADMIN' || user.marketId !== market.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const raw = req.body as unknown;
  let layout: MarketSection[];
  if (Array.isArray(raw)) {
    layout = raw;
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'layout' in raw && Array.isArray((raw as { layout: unknown }).layout)) {
    layout = (raw as { layout: MarketSection[] }).layout;
  } else if (raw && typeof raw === 'object' && '_meta' in raw) {
    const obj = raw as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => k !== '_meta' && /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    layout = keys.map((k) => obj[k]).filter((x): x is MarketSection => x != null && typeof x === 'object' && 'id' in x && Array.isArray((x as MarketSection).storeIds));
  } else {
    return res.status(400).json({ error: 'layout must be an array' });
  }
  const normalizedLayout = layout.map((s) => ({
    ...s,
    type: (s as MarketSection & { type?: string }).type === 'MARKET_GROUP' ? 'MARKET_GROUP' : 'SLIDER',
  }));
  setLayoutForMarket(slugNorm, normalizedLayout);

  const storeIdsInMarketGroup = new Set<string>();
  for (const section of normalizedLayout) {
    if (section.type === 'MARKET_GROUP') {
      for (const id of section.storeIds) {
        if (id && typeof id === 'string') storeIdsInMarketGroup.add(id.trim());
      }
    }
  }
  // IMPORTANT: Never remove or clear existing tenant.marketId assignments when saving layout.
  // Layout should only *add* marketId for tenants explicitly included in MARKET_GROUP sections.
  if (storeIdsInMarketGroup.size > 0) {
    const tenants = await repos.tenants.findAll();
    let changed = false;
    for (const t of tenants) {
      const inGroup = storeIdsInMarketGroup.has(t.id) || storeIdsInMarketGroup.has(t.slug ?? '');
      if (inGroup && t.marketId !== market.id) {
        (t as { marketId?: string }).marketId = market.id;
        changed = true;
      }
    }
    if (changed) await repos.tenants.setAll(tenants);
  }

  res.json(normalizedLayout);
});

app.get('/markets/:id', async (req, res) => {
  const market = (await repos.markets.findAll()).find((m) => m.id === req.params.id);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== market.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(market);
});

app.get('/markets/:marketId/admins', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const admins = (await repos.users.findAll()).filter((u) => u.role === 'MARKET_ADMIN' && u.marketId === marketId);
  res.json(admins);
});

app.post('/markets/:marketId/admins', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { marketId } = req.params;
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const users = (await repos.users.findAll());
  const existing = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'User with this email already exists' });
  const id = `user-${crypto.randomUUID?.() ?? Date.now()}`;
  const newUser: User = {
    id,
    email: email.trim().toLowerCase(),
    role: 'MARKET_ADMIN',
    marketId,
    ...(typeof password === 'string' && password.length >= 6 ? { password } : {}),
  };
  users.push(newUser);
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    marketId,
    action: 'create',
    entity: 'user',
    entityId: newUser.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: newUser,
  });
  res.status(201).json(newUser);
});

/** Update market admin login (email and/or password). ROOT_ADMIN only. Updates first MARKET_ADMIN for this market; creates one if none. */
app.put('/markets/:marketId/admin-credentials', async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!requireWriteWithReason(req, res)) return;
  const { marketId } = req.params;
  const { email, password } = req.body as { email?: string; password?: string };
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const users = (await repos.users.findAll());
  const marketAdmins = users.filter((u) => u.role === 'MARKET_ADMIN' && u.marketId === marketId);
  const target = marketAdmins[0];
  if (target) {
    const newEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    const newPassword = typeof password === 'string' && password.length >= 6 ? password : undefined;
    if (!newEmail && !newPassword) return res.status(400).json({ error: 'email or password required' });
    const idx = users.findIndex((u) => u.id === target.id);
    if (idx === -1) return res.status(404).json({ error: 'Admin not found' });
    if (newEmail) {
      const existing = users.find((u) => u.id !== target.id && u.email?.toLowerCase() === newEmail);
      if (existing) return res.status(409).json({ error: 'User with this email already exists' });
      users[idx] = { ...users[idx], email: newEmail };
    }
    if (newPassword) users[idx] = { ...users[idx], password: newPassword };
    await repos.users.setAll(users);
    appendAuditEvent({
      userId: req.user!.id,
      role: req.user!.role,
      marketId,
      action: 'update',
      entity: 'user',
      entityId: target.id,
      reason: getEmergencyReason(req),
      emergencyMode: true,
      after: { ...users[idx], password: undefined },
    });
    return res.json({ ...users[idx], password: undefined });
  }
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'email and password required (password min 6 chars) when creating first admin' });
  }
  const adminEmail = email.trim().toLowerCase();
  if (users.some((u) => u.email?.toLowerCase() === adminEmail)) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }
  const id = `user-${crypto.randomUUID?.() ?? Date.now()}`;
  const newUser: User = { id, email: adminEmail, role: 'MARKET_ADMIN', marketId, password };
  users.push(newUser);
  await repos.users.setAll(users);
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    marketId,
    action: 'create',
    entity: 'user',
    entityId: newUser.id,
    reason: getEmergencyReason(req),
    emergencyMode: true,
    after: newUser,
  });
  res.status(201).json({ ...newUser, password: undefined });
});

app.get('/markets/:marketId/tenants', async (req, res) => {
  const { marketId } = req.params;
  const categoryId = (req.query.categoryId as string)?.trim() || (req.query.marketCategory as string)?.trim();
  const allMarkets = await repos.markets.findAll();
  let market = allMarkets.find((m) => m.id === marketId);
  if (!market && marketId) {
    const slugNorm = marketId.toLowerCase().replace(/^market-/, '');
    market = allMarkets.find(
      (m) => m.slug === marketId || m.slug === slugNorm || (m.slug === 'dabburiyya' && (marketId === 'daburiyya' || marketId === 'dabburiyya'))
    );
  }
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const resolvedMarketId = market.id;
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== resolvedMarketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const marketTenantIds = buildMarketTenantIdSet(
    market as { tenantIds?: string[] },
    resolvedMarketId,
    market.slug,
    marketId
  );
  const allTenants = await repos.tenants.findAll();
  let tenants = allTenants.filter(
    (t) =>
      tenantMatchesMarketMembership(t, resolvedMarketId, marketId, market.slug, marketTenantIds) &&
      t.enabled !== false &&
      (t.isListedInMarket !== false)
  );
  const pillarIdFilter =
    (req.query.pillarId as string | undefined)?.trim() || (req.query.pillar_id as string | undefined)?.trim();
  if (pillarIdFilter) {
    tenants = tenants.filter((t) => (t as RegistryTenant).pillarId === pillarIdFilter);
  }
  const subCategoryIdFilter =
    (req.query.subCategoryId as string | undefined)?.trim() ||
    (req.query.sub_category_id as string | undefined)?.trim();
  if (subCategoryIdFilter) {
    tenants = tenants.filter((t) => (t as RegistryTenant).subCategoryId === subCategoryIdFilter);
  } else {
    const subCategoryNameFilter = (req.query.sub_category as string | undefined)?.trim();
    if (subCategoryNameFilter && pillarIdFilter) {
      const subs = getSubCategories().filter((s) => s.pillarId === pillarIdFilter);
      const subMatch = subs.find((s) => {
        const ar = (s.nameAr ?? '').trim();
        const en = (s.name ?? '').trim();
        return subCategoryNameFilter === ar || subCategoryNameFilter === en;
      });
      if (subMatch) {
        tenants = tenants.filter((t) => (t as RegistryTenant).subCategoryId === subMatch.id);
      }
    }
  }
  if (categoryId) {
    const norm = (s: string) => (s ?? '').toLowerCase();
    const globalCats = getGlobalCategories();
    tenants = tenants.filter((t) => {
      const mc = (t.marketCategory ?? '').trim();
      if (norm(mc) === norm(categoryId)) return true;
      const cat = globalCats.find((c) => norm(c.id) === norm(categoryId));
      if (cat?.legacyCode && norm(mc) === norm(cat.legacyCode)) return true;
      return false;
    });
  }
  tenants = tenants
    .sort((a, b) => {
      const orderA = (a as { sortOrder?: number }).sortOrder ?? 999;
      const orderB = (b as { sortOrder?: number }).sortOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      const soA = a.marketSortOrder ?? 999;
      const soB = b.marketSortOrder ?? 999;
      if (soA !== soB) return soA - soB;
      return (a.name ?? '').localeCompare(b.name ?? '');
    })
    .map((t) => {
      const n = normalizeTenantResponse(t);
      return {
        id: n.id,
        slug: n.slug,
        name: n.name,
        type: (n.type === 'CLOTHING' || n.type === 'FOOD') ? n.type : 'GENERAL',
        branding: {
          logoUrl: n.logoUrl ?? '',
          primaryColor: n.primaryColor ?? '#7C3AED',
          secondaryColor: n.secondaryColor ?? '#d4a574',
          fontFamily: n.fontFamily ?? '"Cairo", system-ui, sans-serif',
          radiusScale: n.radiusScale ?? 1,
          layoutStyle: n.layoutStyle ?? 'default',
          hero: n.hero,
          banners: n.banners ?? [],
          whatsappPhone: (n as RegistryTenant).whatsappPhone ?? '',
          phone: (n as RegistryTenant).phone ?? '',
        },
        isActive: n.enabled,
        marketCategory: n.marketCategory ?? 'GENERAL',
        operationalStatus: customerOperationalStatus(n),
        orderPolicy: (n as RegistryTenant).orderPolicy,
        businessHours: (n as RegistryTenant).businessHours,
        openTime: n.openTime,
        closeTime: n.closeTime,
        forceClosed: n.forceClosed,
        overrideStatus: (n as RegistryTenant).overrideStatus ?? undefined,
        pillarId: (n as RegistryTenant).pillarId ?? null,
        subCategoryId: (n as RegistryTenant).subCategoryId ?? null,
        categoryName: resolveTenantCategoryName(t) ?? null,
      };
    });
  console.log('[GET /markets/:marketId/tenants]', {
    marketIdParam: marketId,
    resolvedMarketId,
    marketSlug: market.slug,
    totalTenantsInDb: allTenants.length,
    returning: tenants.length,
  });
  res.json(tenants);
});

app.post('/markets/:marketId/tenants', async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;
  if (user.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const body = req.body as Omit<RegistryTenant, 'id' | 'createdAt' | 'marketId'> & { adminEmail?: string; adminPassword?: string };
  const { adminEmail, adminPassword, ...input } = body;
  const name = (input.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Store name is required' });
  const slug = (input.slug ?? name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `store-${Date.now()}`;
  const existingTenants = await repos.tenants.findAll();
  if (existingTenants.some((t) => t.slug === slug)) {
    return res.status(400).json({ error: `Slug "${slug}" already exists. Use a unique slug.` });
  }
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const hero = input.hero ?? { ...DEFAULT_HERO, title: name };
  const tenant: RegistryTenant = {
    ...input,
    id,
    slug,
    name,
    marketId,
    createdAt: new Date().toISOString(),
    logoUrl: input.logoUrl ?? '',
    primaryColor: input.primaryColor ?? '#0f766e',
    secondaryColor: input.secondaryColor ?? '#d4a574',
    fontFamily: input.fontFamily ?? '"Cairo", system-ui, sans-serif',
    radiusScale: input.radiusScale ?? 1,
    layoutStyle: (input.layoutStyle as RegistryTenant['layoutStyle']) ?? 'default',
    enabled: input.enabled ?? true,
    hero: normalizeHero(hero),
    banners: input.banners ?? [],
    isListedInMarket: input.isListedInMarket ?? true,
    type: (input.type === 'CLOTHING' || input.type === 'FOOD') ? input.type : 'GENERAL',
    marketCategory: input.marketCategory ?? 'GENERAL',
    tenantType: input.tenantType ?? (input.type === 'FOOD' ? 'RESTAURANT' : 'SHOP'),
    deliveryProviderMode: input.deliveryProviderMode ?? 'TENANT',
    allowMarketCourierFallback: input.allowMarketCourierFallback ?? true,
    financialConfig: input.financialConfig ?? { commissionType: 'PERCENTAGE', commissionValue: 10, deliveryFeeModel: 'TENANT' },
    paymentCapabilities: input.paymentCapabilities ?? { cash: true, card: false, allowInstallments: false, installmentOptions: [3, 6, 12] },
    paymentMethods: input.paymentMethods ?? { cash: true, card: false, installments: false },
    collections: input.collections ?? [],
  };
  if (adminEmail && adminPassword && adminPassword.length >= 6) {
    const users = await repos.users.findAll();
    const emailLower = adminEmail.trim().toLowerCase();
    if (users.some((u) => u.email?.toLowerCase() === emailLower)) {
      return res.status(400).json({ error: 'Email already in use for another user' });
    }
  }
  const tenants = [...existingTenants, tenant];
  await repos.tenants.setAll(tenants);
  const cat = await repos.catalog.getCatalog(tenant.id);
  await repos.catalog.setCatalog(tenant.id, cat);
  const existingDelivery = await repos.delivery.getSettings(tenant.id);
  if (!existingDelivery) {
    await repos.delivery.setSettings(tenant.id, {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: [],
    });
  }
  if (adminEmail && adminPassword && adminPassword.length >= 6) {
    const users = await repos.users.findAll();
    const emailLower = adminEmail.trim().toLowerCase();
    const userId = crypto.randomUUID?.() ?? `user-${Date.now()}`;
    users.push({
      id: userId,
      email: emailLower,
      role: 'TENANT_ADMIN',
      tenantId: tenant.id,
      password: adminPassword,
    });
    await repos.users.setAll(users);
  }
  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId,
    action: 'create',
    entity: 'tenant',
    entityId: tenant.id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user.role),
    after: tenant,
  });
  res.status(201).json(normalizeTenantResponse(tenant));
});

// --- Tenants ---
app.get('/tenants', async (req, res) => {
  let tenants = (await repos.tenants.findAll());
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    tenants = tenants.filter((t) => t.marketId === req.user!.marketId);
  }
  tenants = tenants.sort((a, b) => ((a as { sortOrder?: number }).sortOrder ?? 999) - ((b as { sortOrder?: number }).sortOrder ?? 999));
  res.json(tenants.map(normalizeTenantResponse));
});

/** Storefront/Market: list ALL active tenants (no marketId filter) so every store stays visible. Includes marketId for grouping. */
app.get('/storefront/tenants', async (_req, res) => {
  const tenants = (await repos.tenants.findAll())
    .filter((t) => t.enabled)
    .sort((a, b) => ((a as { sortOrder?: number }).sortOrder ?? 0) - ((b as { sortOrder?: number }).sortOrder ?? 0))
    .map((t) => {
      const n = normalizeTenantResponse(t);
      return {
        id: n.id,
        slug: n.slug,
        name: n.name,
        type: (n.type === 'CLOTHING' || n.type === 'FOOD') ? n.type : 'GENERAL',
        branding: {
          logoUrl: n.logoUrl ?? '',
          primaryColor: n.primaryColor ?? '#7C3AED',
          secondaryColor: n.secondaryColor ?? '#d4a574',
          fontFamily: n.fontFamily ?? '"Cairo", system-ui, sans-serif',
          radiusScale: n.radiusScale ?? 1,
          layoutStyle: n.layoutStyle ?? 'default',
          hero: n.hero,
          banners: n.banners ?? [],
          whatsappPhone: (n as RegistryTenant).whatsappPhone ?? '',
          phone: (n as RegistryTenant).phone ?? '',
        },
        isActive: n.enabled,
        marketCategory: n.marketCategory ?? 'GENERAL',
        marketId: (t as { marketId?: string | null }).marketId ?? null,
        operationalStatus: customerOperationalStatus(n),
        orderPolicy: (n as RegistryTenant).orderPolicy,
        businessHours: (n as RegistryTenant).businessHours,
        openTime: n.openTime,
        closeTime: n.closeTime,
        forceClosed: n.forceClosed,
        overrideStatus: (n as RegistryTenant).overrideStatus ?? undefined,
        pillarId: (n as RegistryTenant).pillarId ?? null,
        subCategoryId: (n as RegistryTenant).subCategoryId ?? null,
        categoryName: resolveTenantCategoryName(t) ?? null,
      };
    });
  res.json(tenants);
});

app.post('/tenants', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;
  const input = req.body as Omit<RegistryTenant, 'id' | 'createdAt'> & { marketId?: string };
  let marketId: string | undefined;
  if (user.role === 'MARKET_ADMIN' && user.marketId) {
    marketId = user.marketId;
    if (input.marketId && input.marketId !== user.marketId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } else {
    marketId = input.marketId;
    if (!marketId || !marketId.trim()) {
      return res.status(400).json({ error: 'marketId is required', code: 'MARKET_ID_REQUIRED' });
    }
    const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
    if (!market) return res.status(400).json({ error: 'Invalid marketId' });
  }
  const id = crypto.randomUUID?.() ?? `t-${Date.now()}`;
  const tenant: RegistryTenant = {
    ...input,
    id,
    marketId: marketId!,
    createdAt: new Date().toISOString(),
    hero: input.hero ?? DEFAULT_HERO,
    banners: input.banners ?? [],
  };
  const tenants = (await repos.tenants.findAll());
  tenants.push(tenant);
  await repos.tenants.setAll(tenants);
  // Ensure catalog entry
  const cat = await repos.catalog.getCatalog(tenant.id);
  await repos.catalog.setCatalog(tenant.id, cat);
  // Ensure delivery entry
  const existingDelivery = await repos.delivery.getSettings(tenant.id);
  if (!existingDelivery) {
    await repos.delivery.setSettings(tenant.id, {
      tenantId: tenant.id,
      modes: { pickup: true, delivery: true },
      deliveryFee: 5,
      zones: [],
    });
  }
  appendAuditEvent({
    userId: req.user!.id,
    role: req.user!.role,
    marketId: tenant.marketId,
    action: 'create',
    entity: 'tenant',
    entityId: tenant.id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user.role),
    after: tenant,
  });
  res.status(201).json(tenant);
});

function normalizeId(s: string | undefined | null): string {
  return String(s ?? '').trim();
}

async function handleTenantUpdate(req: express.Request, res: express.Response): Promise<void> {
  const { id } = req.params;
  let updates = req.body as Partial<Omit<RegistryTenant, 'id' | 'createdAt'>>;
  const user = req.user;
  let updatedAdminPayload: { tenantId: string; email: string } | undefined;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const tenants = (await repos.tenants.findAll());
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  const tenant = tenants[idx];
  const rawUpdates = req.body as Record<string, unknown>;

  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;

  if (user.role === 'MARKET_ADMIN') {
    const callerMarketId = normalizeId(user.marketId);
    const tenantMarketId = normalizeId(tenant.marketId);
    const assigningToCallerMarket = tenantMarketId === '' && normalizeId(updates.marketId) === callerMarketId;
    const tenantBelongsToCallerMarket =
      callerMarketId && (tenantMarketId === callerMarketId || assigningToCallerMarket);
    if (!tenantBelongsToCallerMarket) {
      res.status(403).json({ error: 'Not authorized for this tenant: tenant must belong to your market' });
      return;
    }
    // MARKET_ADMIN can only update: marketCategory, isListedInMarket, marketSortOrder, marketId, pillarId, subCategoryId, adminEmail, supportsWeightSelling, overrideStatus
    const allowed = ['marketCategory', 'isListedInMarket', 'marketSortOrder', 'marketId', 'pillarId', 'subCategoryId', 'adminEmail', 'supportsWeightSelling', 'overrideStatus'] as const;
    updates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k as (typeof allowed)[number]))
    ) as Partial<RegistryTenant>;
    if (rawUpdates.pillarId !== undefined) {
      (updates as Record<string, unknown>).pillarId = rawUpdates.pillarId === null || rawUpdates.pillarId === '' ? null : String(rawUpdates.pillarId);
    }
    if (rawUpdates.subCategoryId !== undefined) {
      (updates as Record<string, unknown>).subCategoryId = rawUpdates.subCategoryId === null || rawUpdates.subCategoryId === '' ? null : String(rawUpdates.subCategoryId);
    }
    if (updates.marketId !== undefined && normalizeId(updates.marketId) !== callerMarketId) {
      updates = { ...updates, marketId: user.marketId as string };
    }
    delete (updates as Record<string, unknown>).adminEmail;
  }

  if (user.role === 'TENANT_ADMIN') {
    if ((user as { tenantId?: string }).tenantId !== id) {
      res.status(403).json({ error: 'Forbidden: can only update your own store' });
      return;
    }
    updates = applyTenantPatchRoleFilter(user.role, rawUpdates) as Partial<RegistryTenant>;
  } else if (!isPlatformAdmin(user.role) && user.role !== 'MARKET_ADMIN') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // adminEmail is stored on User (TENANT_ADMIN), not Tenant. Apply for both ROOT_ADMIN and MARKET_ADMIN so it persists in Postgres when STORAGE_DRIVER=db.
  const newAdminEmail = typeof rawUpdates.adminEmail === 'string' ? rawUpdates.adminEmail.trim().toLowerCase() : undefined;
  if (newAdminEmail !== undefined && (user.role === 'MARKET_ADMIN' || isPlatformAdmin(user.role))) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PUT /tenants/:id] adminEmail received:', newAdminEmail, 'for tenantId:', id);
    }
    const users = await repos.users.findAll();
    const tenantAdminUser = users.find((u) => (u as { tenantId?: string }).tenantId === id && (u as { role?: string }).role === 'TENANT_ADMIN');
    if (!tenantAdminUser) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PUT /tenants/:id] No TENANT_ADMIN user found for tenantId:', id);
      }
      res.status(400).json({ error: 'لا يوجد حساب مدير لهذا المحل لتحديث بريده' });
      return;
    }
    if (users.some((u) => u.id !== tenantAdminUser.id && u.email?.toLowerCase() === newAdminEmail)) {
      res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل لحساب آخر' });
      return;
    }
    (tenantAdminUser as { email?: string }).email = newAdminEmail;
    await repos.users.setAll(users);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PUT /tenants/:id] Updated tenant admin email for tenantId:', id, '(Postgres User table when STORAGE_DRIVER=db)');
    }
    updatedAdminPayload = { tenantId: id, email: newAdminEmail };
  }
  delete (updates as Record<string, unknown>).adminEmail;

  const before = { ...tenants[idx] };
  if (updates.banners !== undefined && !Array.isArray(updates.banners)) delete (updates as Record<string, unknown>).banners;
  if (updates.hero !== undefined && (typeof updates.hero !== 'object' || updates.hero === null)) delete (updates as Record<string, unknown>).hero;
  if (
    updates.financialConfig !== undefined &&
    typeof updates.financialConfig === 'object' &&
    isPlatformAdmin(user.role)
  ) {
    const merged = {
      ...(tenants[idx].financialConfig ?? {}),
      ...updates.financialConfig,
    } as RegistryTenant['financialConfig'];
    if (merged && (merged as { orderSubmissionDelaySeconds?: unknown }).orderSubmissionDelaySeconds !== undefined) {
      (merged as { orderSubmissionDelaySeconds?: number }).orderSubmissionDelaySeconds =
        normalizeOrderSubmissionDelaySeconds((merged as { orderSubmissionDelaySeconds?: unknown }).orderSubmissionDelaySeconds);
    }
    updates.financialConfig = merged;
  } else {
    delete (updates as Record<string, unknown>).financialConfig;
  }
  if (updates.overrideStatus !== undefined) {
    const persisted = updates.overrideStatus;
    console.log(`[STORE_STATUS_SAVE] tenantId=${id} payload=overrideStatus:${updates.overrideStatus ?? 'AUTO'} persisted=${persisted ?? 'AUTO'}`);
  }
  tenants[idx] = { ...tenants[idx], ...updates };
  // Persists to PostgreSQL when STORAGE_DRIVER=db (marketId transfer, pillarId, etc. are permanent)
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: tenant.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  const response = normalizeTenantResponse(tenants[idx]) as Record<string, unknown>;
  if (updatedAdminPayload) {
    response.updatedAdmin = updatedAdminPayload;
  }
  res.json(response);
}

app.put('/tenants/:id', handleTenantUpdate);
app.patch('/tenants/:id', handleTenantUpdate);

app.post('/tenants/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = (await repos.tenants.findAll());
  const idx = tenants.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  const tenant = tenants[idx];
  if (user?.role === 'MARKET_ADMIN' && tenant.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], enabled: !tenants[idx].enabled };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: tenant.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

app.get('/tenants/by-id/:id', async (req, res) => {
  const requestedId = req.params.id;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === requestedId);
  const uid = (req.user as { id?: string; role?: string; tenantId?: string; marketId?: string } | undefined);
  if (!tenant) {
    console.log('[Tenant] GET /tenants/by-id/' + requestedId + ' → 404 (tenant not found). req.user id=', uid?.id, 'tenantId=', uid?.tenantId);
    return res.status(404).json({ error: 'Tenant not found' });
  }
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== requestedId) {
    console.log('[Tenant] GET /tenants/by-id/' + requestedId + ' → 403 (TENANT_ADMIN user.tenantId=' + req.user.tenantId + ' != requested id)');
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    console.log('[Tenant] GET /tenants/by-id/' + requestedId + ' → 403 (MARKET_ADMIN marketId mismatch)');
    return res.status(403).json({ error: 'Forbidden' });
  }
  // deliveryZones strictly scoped to this tenant; normalize so centerLat/centerLng/radiusKm are always present
  const deliveryZones = sortZones(await repos.deliveryZones.getByTenant(tenant.id)).map(normalizeZoneForResponse);
  res.json({ ...normalizeTenantResponse(tenant), deliveryZones });
});

app.get('/tenants/by-slug/:slug', async (req, res) => {
  const slug = req.params.slug;
  let tenant = (await repos.tenants.findAll()).find((t) => t.slug === slug);
  if (!tenant && slug === 'top-market') {
    tenant = (await repos.tenants.findAll()).find((t) => t.id === TOP_MARKET_TENANT_ID);
  }
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // deliveryZones strictly scoped to this tenant; normalize so centerLat/centerLng/radiusKm are always present
  const deliveryZones = sortZones(await repos.deliveryZones.getByTenant(tenant.id)).map(normalizeZoneForResponse);
  res.json({ ...normalizeTenantResponse(tenant), deliveryZones });
});

app.put('/tenants/:id/branding', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  console.log('[Branding] Incoming Config:', req.body);
  const tenants = (await repos.tenants.findAll());
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'TENANT_ADMIN' && (user as { tenantId?: string }).tenantId !== id) {
    return res.status(403).json({ error: 'Forbidden: can only update your own store branding' });
  }
  if (user?.role === 'MARKET_ADMIN' && t.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body as {
    logoUrl?: string;
    hero?: StorefrontHero;
    banners?: StorefrontBanner[];
    whatsappPhone?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    radiusScale?: number;
    layoutStyle?: string;
  };
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  if (body.logoUrl !== undefined) tenants[idx].logoUrl = body.logoUrl;
  if (body.hero !== undefined) {
    tenants[idx].hero = normalizeHero(body.hero);
    // Sync: when hero.title is updated, also update tenant.name so Store Settings and Branding stay in sync
    if (body.hero.title != null && String(body.hero.title).trim()) {
      const title = String(body.hero.title).trim();
      if (title.length <= 50) tenants[idx].name = title;
    }
  }
  if (body.banners !== undefined && Array.isArray(body.banners)) tenants[idx].banners = body.banners;
  if (body.whatsappPhone !== undefined) {
    const cleaned = typeof body.whatsappPhone === 'string' ? body.whatsappPhone.replace(/\D/g, '') : '';
    tenants[idx].whatsappPhone = cleaned || undefined;
    (tenants[idx] as RegistryTenant).phone = cleaned || undefined;
  }
  if (body.primaryColor !== undefined) tenants[idx].primaryColor = body.primaryColor;
  if (body.secondaryColor !== undefined) tenants[idx].secondaryColor = body.secondaryColor;
  if (body.fontFamily !== undefined) tenants[idx].fontFamily = body.fontFamily;
  if (body.radiusScale !== undefined) tenants[idx].radiusScale = body.radiusScale;
  if (body.layoutStyle !== undefined) tenants[idx].layoutStyle = body.layoutStyle as RegistryTenant['layoutStyle'];
  const before = { ...tenants[idx] };
  await repos.tenants.setAll(tenants);
  console.log('[Branding] Persisted tenant', id, process.env.STORAGE_DRIVER === 'db' ? 'to database' : 'to store');
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: t.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

app.put('/tenants/:id/collections', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'MARKET_ADMIN' && t.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const body = req.body as { collections?: import('@nmd/core').HomeCollection[] };
  const collections = Array.isArray(body.collections) ? body.collections : [];
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  const before = { ...tenants[idx] };
  (tenants[idx] as RegistryTenant).collections = collections;
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: t.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

/** Updates name, about, storeType, officeHours, etc. Banners and hero are never read or written here; updating name/about does not wipe banners. */
app.put('/tenants/:id/operational-settings', async (req, res) => {
  const { id } = req.params;
  const user = req.user as { role?: string; marketId?: string; tenantId?: string } | undefined;
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'MARKET_ADMIN' && (t as { marketId?: string }).marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== id) {
    return res.status(403).json({ error: 'Forbidden: can only update your own store' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const body = req.body as {
    operationalStatus?: 'open' | 'closed' | 'busy';
    overrideStatus?: 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED';
    orderPolicy?: 'accept_always' | 'accept_only_when_open';
    businessHours?: Record<string, { open: string; close: string; isClosedDay: boolean }>;
    busyBannerEnabled?: boolean;
    busyBannerText?: string;
    bookingEnabled?: boolean;
    about?: string;
    officeHours?: string;
    openTime?: string;
    closeTime?: string;
    forceClosed?: boolean;
    name?: string;
    phone?: string;
    whatsappPhone?: string;
    storeType?: 'RESTAURANT' | 'PROFESSIONAL';
    addressLine?: string;
    location?: { lat: number; lng: number };
    supportsWeightSelling?: boolean;
    allowInstallments?: boolean;
    installmentOptions?: number[];
    paymentMethods?: Partial<PaymentMethodsToggle>;
    orderSubmissionDelaySeconds?: number;
  };
  const idx = tenants.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tenant not found' });
  if (body.name !== undefined) {
    const trimmed = String(body.name).trim();
    if (trimmed.length === 0) return res.status(400).json({ error: 'Store name cannot be empty' });
    if (trimmed.length > 50) return res.status(400).json({ error: 'Store name must be 50 characters or less' });
    tenants[idx].name = trimmed;
    // Sync: when name is updated in Store Settings, also update hero.title so Branding and Store Settings stay in sync
    const existingHero = tenants[idx].hero ?? DEFAULT_HERO;
    tenants[idx].hero = normalizeHero({ ...existingHero, title: trimmed });
  }
  if (body.operationalStatus !== undefined) {
    (tenants[idx] as RegistryTenant).operationalStatus = body.operationalStatus;
    console.log(`[STORE_STATUS_SAVE] tenantId=${id} payload=${body.operationalStatus} persisted=${body.operationalStatus}`);
  }
  if (body.overrideStatus !== undefined) {
    const val = body.overrideStatus;
    const persisted = (val === 'FORCE_OPEN' || val === 'FORCE_CLOSED') ? val : undefined;
    (tenants[idx] as RegistryTenant).overrideStatus = persisted;
    console.log(`[STORE_STATUS_SAVE] tenantId=${id} payload=overrideStatus:${val} persisted=${persisted ?? 'AUTO'}`);
  }
  if (body.orderPolicy !== undefined) (tenants[idx] as RegistryTenant).orderPolicy = body.orderPolicy;
  if (body.businessHours !== undefined) (tenants[idx] as RegistryTenant).businessHours = body.businessHours;
  if (body.busyBannerEnabled !== undefined) (tenants[idx] as RegistryTenant).busyBannerEnabled = body.busyBannerEnabled;
  if (body.busyBannerText !== undefined) (tenants[idx] as RegistryTenant).busyBannerText = body.busyBannerText;
  if (body.bookingEnabled !== undefined) (tenants[idx] as RegistryTenant).bookingEnabled = body.bookingEnabled;
  if (body.about !== undefined) (tenants[idx] as RegistryTenant).about = body.about;
  if (body.officeHours !== undefined) (tenants[idx] as RegistryTenant).officeHours = body.officeHours;
  if (body.openTime !== undefined) (tenants[idx] as RegistryTenant).openTime = body.openTime;
  if (body.closeTime !== undefined) (tenants[idx] as RegistryTenant).closeTime = body.closeTime;
  if (body.forceClosed !== undefined) {
    (tenants[idx] as RegistryTenant).forceClosed = body.forceClosed;
    console.log(`[STORE_STATUS_SAVE] tenantId=${id} payload=forceClosed:${body.forceClosed} persisted=${body.forceClosed}`);
  }
  if (body.phone !== undefined) {
    const cleaned = String(body.phone).replace(/\D/g, '');
    (tenants[idx] as RegistryTenant).phone = cleaned || undefined;
    if (!(tenants[idx] as RegistryTenant).whatsappPhone) (tenants[idx] as RegistryTenant).whatsappPhone = cleaned || undefined;
  }
  if (body.whatsappPhone !== undefined) {
    const cleaned = String(body.whatsappPhone).replace(/\D/g, '');
    (tenants[idx] as RegistryTenant).whatsappPhone = cleaned || undefined;
    (tenants[idx] as RegistryTenant).phone = cleaned || undefined;
  }
  if (body.storeType !== undefined) {
    (tenants[idx] as RegistryTenant).storeType = body.storeType;
  }
  if (body.addressLine !== undefined) (tenants[idx] as RegistryTenant).addressLine = body.addressLine;
  if (body.location !== undefined) (tenants[idx] as RegistryTenant).location = body.location;
  if (body.supportsWeightSelling !== undefined) (tenants[idx] as RegistryTenant).supportsWeightSelling = body.supportsWeightSelling;
  if (body.paymentMethods !== undefined) {
    const current = (tenants[idx] as RegistryTenant).paymentMethods ?? {
      cash: ((tenants[idx] as RegistryTenant).paymentCapabilities?.cash ?? true) !== false,
      card: (tenants[idx] as RegistryTenant).paymentCapabilities?.card === true,
      installments: Boolean(((tenants[idx] as RegistryTenant).paymentCapabilities as { allowInstallments?: boolean } | undefined)?.allowInstallments),
    };
    (tenants[idx] as RegistryTenant).paymentMethods = {
      cash: body.paymentMethods.cash ?? current.cash,
      card: body.paymentMethods.card ?? current.card,
      installments: body.paymentMethods.installments ?? current.installments,
    };
  }
  if (body.allowInstallments !== undefined || body.installmentOptions !== undefined) {
    const current = ((tenants[idx] as RegistryTenant).paymentCapabilities ?? { cash: true, card: true }) as {
      cash: boolean;
      card: boolean;
      allowInstallments?: boolean;
      installmentOptions?: number[];
    };
    const normalizedOptions = Array.isArray(body.installmentOptions)
      ? [...new Set(body.installmentOptions.map((n) => Math.floor(Number(n))).filter((n) => n >= 2 && n <= 36))].sort((a, b) => a - b)
      : (current.installmentOptions ?? [3, 6, 12]);
    (tenants[idx] as RegistryTenant).paymentCapabilities = {
      ...current,
      allowInstallments: body.allowInstallments ?? current.allowInstallments ?? false,
      installmentOptions: normalizedOptions,
    };
    const pm = (tenants[idx] as RegistryTenant).paymentMethods ?? {
      cash: current.cash !== false,
      card: current.card === true,
      installments: Boolean(current.allowInstallments),
    };
    (tenants[idx] as RegistryTenant).paymentMethods = {
      ...pm,
      installments: body.allowInstallments ?? pm.installments,
    };
  }
  if (body.orderSubmissionDelaySeconds !== undefined) {
    const delay = normalizeOrderSubmissionDelaySeconds(body.orderSubmissionDelaySeconds);
    const fc = { ...((tenants[idx] as RegistryTenant).financialConfig ?? {
      commissionType: 'PERCENTAGE' as const,
      commissionValue: 10,
      deliveryFeeModel: 'TENANT' as const,
    }) };
    fc.orderSubmissionDelaySeconds = delay;
    (tenants[idx] as RegistryTenant).financialConfig = fc;
  }
  const before = { ...tenants[idx] };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: t.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(normalizeTenantResponse(tenants[idx]));
});

/** Deep delete tenant and all related data. Atomic: payments → orders → catalog → delivery → zones → tenant-scoped couriers → tenant. */
app.delete('/tenants/:id', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === 'TENANT_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: only SUPER_ADMIN or MARKET_ADMIN can delete a store' });
  }
  const tenants = await repos.tenants.findAll();
  const t = tenants.find((x) => x.id === id);
  if (!t) return res.status(404).json({ error: 'Tenant not found' });
  if (user.role === 'MARKET_ADMIN' && t.marketId !== user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user.role) && !requireWriteWithReason(req, res)) return;

  const orderIds = ((await repos.orders.findAll()) as { id?: string; tenantId?: string }[])
    .filter((o) => o.tenantId === id)
    .map((o) => o.id!)
    .filter(Boolean);
  await repos.payments.deleteForOrderIds(orderIds);
  await repos.orders.deleteByTenantId(id);
  await repos.catalog.setCatalog(id, { categories: [], products: [], optionGroups: [] });
  await repos.delivery.deleteSettings(id);
  await repos.deliveryZones.setAll(id, []);
  const couriers = (await repos.couriers.findAll()).filter(
    (c) => !(c.scopeType === 'TENANT' && c.scopeId === id)
  );
  await repos.couriers.setAll(couriers);
  const remainingTenants = tenants.filter((x) => x.id !== id);
  await repos.tenants.setAll(remainingTenants);

  appendAuditEvent({
    userId: user.id,
    role: user.role,
    marketId: t.marketId,
    action: 'delete',
    entity: 'tenant',
    entityId: id,
    reason: isPlatformAdmin(user.role) ? getEmergencyReason(req) : 'full store delete',
    emergencyMode: isPlatformAdmin(user.role),
    before: t,
    after: null,
  });
  res.status(204).send();
});

// --- Upload ---
/** Base URL for image links. Set PUBLIC_URL=https://nmd.marketing/api in production so Storefront gets absolute URLs. */
const UPLOAD_BASE = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
app.post('/upload', async (req, res) => {
  const files = (req as { files?: Express.Multer.File[] }).files ?? [];
  const base = UPLOAD_BASE;
  const urls: string[] = [];
  for (const f of files) {
    const fullPath = join(UPLOADS_DIR, f.filename);
    const name = existsSync(fullPath) ? await compressNewUploadToWebP(fullPath) : f.filename;
    urls.push(`${base}/uploads/${name}`);
  }
  console.log('[Upload] Success:', files.length, 'files (WebP q75), base:', base);
  res.json({ urls });
});

/** Banner image upload: saves to public/uploads/banners as WebP (q75), returns relative path for storage. Max 10MB, WebP/JPG/PNG only. */
app.post('/upload/banner', async (req, res) => {
  const file = (req as { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const fullPath = join(UPLOADS_BANNERS_DIR, file.filename);
  const name = existsSync(fullPath) ? await compressNewUploadToWebP(fullPath) : file.filename;
  const base = UPLOAD_BASE;
  const relativePath = `/uploads/banners/${name}`;
  const fullUrl = `${base}${relativePath}`;
  console.log('[Upload/banner] Saved:', name, '(WebP q75)');
  res.json({ urls: [fullUrl], relativePath });
});

// --- Catalog ---
/** Catalog is keyed by tenant id. Resolve slug to id when client sends GET /catalog/buffalo. */
async function resolveCatalogTenantId(param: string): Promise<string> {
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  if (uuidLike) return param;
  const tenant = (await repos.tenants.findAll()).find((t) => t.slug === param);
  return tenant?.id ?? param;
}

async function resolveTenantPricingContext(tenantId: string): Promise<MarketplacePricingContext> {
  const tenants = (await repos.tenants.findAll()) as RegistryTenant[];
  const tenant = tenants.find((t) => t.id === tenantId);
  const markets = (await repos.markets.findAll()) as Market[];
  const market = tenant?.marketId ? markets.find((m) => m.id === tenant.marketId) : undefined;
  return {
    marketFeeConfig: market?.platformFeeConfig,
    tenantFeeOverride: tenant?.financialConfig?.platformFee,
    featureFlagEnabled: isPlatformFeeEnabled(),
  };
}

function enrichOptionItemForCustomer(
  item: { priceDelta?: number; priceModifier?: number; [key: string]: unknown },
  ctx: MarketplacePricingContext,
  markupExempt = false
) {
  if (!isPlatformFeeEnabled()) return item;
  const delta = Number(item.priceDelta ?? item.priceModifier ?? 0);
  if (!Number.isFinite(delta) || delta === 0) return item;
  const displayDelta = markupExempt
    ? Math.ceil(Math.max(0, delta))
    : displayMarketplaceUnitPrice(delta, ctx, false);
  return {
    ...item,
    displayPriceDelta: displayDelta,
  };
}

async function buildCatalogExemptionMaps(tenantId: string): Promise<{
  categoryExemptById: Map<string, boolean>;
  productCategoryById: Map<string, string>;
}> {
  const catalog = await repos.catalog.getCatalog(tenantId);
  const categoryExemptById = new Map<string, boolean>();
  for (const c of catalog.categories ?? []) {
    const cat = c as { id?: string; markupExempt?: boolean };
    if (cat.id) categoryExemptById.set(cat.id, cat.markupExempt === true);
  }
  const productCategoryById = new Map<string, string>();
  for (const p of catalog.products ?? []) {
    const prod = p as { id?: string; categoryId?: string };
    if (prod.id && prod.categoryId) productCategoryById.set(prod.id, prod.categoryId);
  }
  return { categoryExemptById, productCategoryById };
}

async function applySettlementToOrderIfEligible(
  order: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!isSettlementEligibleStatus(String(order.status ?? ''))) return order;
  const tenantId = String(order.tenantId ?? '');
  if (!tenantId) return order;
  const pricingCtx = await resolveTenantPricingContext(tenantId);
  const { categoryExemptById, productCategoryById } = await buildCatalogExemptionMaps(tenantId);
  return postOrderSettlement(order, pricingCtx, categoryExemptById, productCategoryById);
}

/** Phase 1 driver payroll: append-only ledger entries on COMPLETED delivery orders. */
async function applyCourierPayrollIfEligible(order: Record<string, unknown>): Promise<void> {
  try {
    await postCourierEarningsIfEligible(order);
  } catch (err) {
    console.warn('[courier-payroll] accrual failed', { orderId: order.id, err });
  }
}

/** Products often embed stale optionGroups; merge canonical modifierIconKey from catalog.optionGroups. */
function hydrateProductOptionGroupsFromCanonical<
  T extends {
    products?: Array<{ optionGroups?: Array<{ id?: string; items?: unknown[] }>; [key: string]: unknown }>;
    optionGroups?: Array<{ id?: string; items?: unknown[]; [key: string]: unknown }>;
  },
>(catalog: T): T {
  const canonicalById = new Map<string, { id?: string; items?: unknown[]; [key: string]: unknown }>();
  for (const g of catalog.optionGroups ?? []) {
    const id = String((g as { id?: string }).id ?? '').trim();
    if (id) canonicalById.set(id, g as { id?: string; items?: unknown[]; [key: string]: unknown });
  }
  const products = (catalog.products ?? []).map((p) => {
    const embedded = p.optionGroups;
    if (!Array.isArray(embedded) || embedded.length === 0) return p;
    const hydrated = embedded.map((eg) => {
      const groupId = String((eg as { id?: string }).id ?? '').trim();
      const canon = groupId ? canonicalById.get(groupId) : undefined;
      if (!canon) return eg;
      const items = (canon.items ?? []) as Array<Record<string, unknown>>;
      for (const it of items) {
        const modifierId = String(it.id ?? '').trim();
        const iconKey = String(it.modifierIconKey ?? it.modifier_icon_key ?? '').trim();
        const iconUrl = String(it.iconUrl ?? it.icon_url ?? '').trim();
        if (iconKey) {
          console.log('[MODIFIER_ICON]', {
            modifierId,
            iconKey,
            iconUrl: iconUrl || null,
            source: 'catalog.optionGroups',
          });
        }
      }
      return canon;
    });
    return { ...p, optionGroups: hydrated };
  });
  return { ...catalog, products };
}

function enrichCatalogForCustomerView(
  catalog: {
    categories?: unknown[];
    products?: Array<{ basePrice?: number; compareAtPrice?: number; optionGroups?: Array<{ items?: unknown[] }>; [key: string]: unknown }>;
    optionGroups?: Array<{ items?: unknown[]; [key: string]: unknown }>;
    optionItems?: unknown[];
  },
  ctx: MarketplacePricingContext
) {
  if (!isPlatformFeeEnabled()) {
    return { ...catalog, marketplaceRepricing: false };
  }
  const exemptByCategoryId = new Map<string, boolean>();
  for (const c of catalog.categories ?? []) {
    const cat = c as { id?: string; markupExempt?: boolean };
    if (cat.id) exemptByCategoryId.set(cat.id, cat.markupExempt === true);
  }
  const enrichGroups = (
    groups: Array<{ items?: unknown[]; [key: string]: unknown }> | undefined,
    markupExempt: boolean
  ) =>
    (groups ?? []).map((g) => ({
      ...g,
      items: (g.items ?? []).map((it) =>
        enrichOptionItemForCustomer(it as { priceDelta?: number; priceModifier?: number }, ctx, markupExempt)
      ),
    }));
  const products = (catalog.products ?? []).map((p) => {
    const catExempt = exemptByCategoryId.get(String(p.categoryId ?? '')) === true;
    const pricing = enrichProductDisplayPricing(
      {
        basePrice: Number(p.basePrice) || 0,
        compareAtPrice: (p as { compareAtPrice?: number }).compareAtPrice,
        markupExempt: catExempt,
      },
      ctx
    );
    return {
      ...p,
      ...pricing,
      markupExempt: catExempt,
      optionGroups: enrichGroups(p.optionGroups as Array<{ items?: unknown[] }> | undefined, catExempt),
    };
  });
  return {
    ...catalog,
    products,
    optionGroups: enrichGroups(catalog.optionGroups as Array<{ items?: unknown[] }> | undefined, false),
    optionItems: (catalog.optionItems ?? []).map((it) =>
      enrichOptionItemForCustomer(it as { priceDelta?: number; priceModifier?: number }, ctx, false)
    ),
    marketplaceRepricing: true,
  };
}

app.get('/catalog/:tenantId', wrapAsync(async (req, res) => {
  try {
    const tenantId = await resolveCatalogTenantId(req.params.tenantId);
    const catalog = await repos.catalog.getCatalog(tenantId);
    const pricingCtx = await resolveTenantPricingContext(tenantId);
    const sortByOrder = (a: { sortOrder?: number }, b: { sortOrder?: number }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    const products = [...(catalog.products ?? [])].sort(sortByOrder);
    const hydrated = hydrateProductOptionGroupsFromCanonical({
      ...catalog,
      categories: [...(catalog.categories ?? [])].sort(sortByOrder),
      products,
    });
    const sorted = enrichCatalogForCustomerView(hydrated, pricingCtx);
    res.json(sorted);
  } catch (err) {
    console.error('[catalog] getCatalog failed:', err instanceof Error ? err.message : err);
    res.status(200).json({ categories: [], products: [], optionGroups: [], optionItems: [] });
  }
}));

function normalizeProductForCompat(p: { imageUrl?: string; images?: { url: string }[] }) {
  const images = p.images ?? [];
  if (images.length > 0) {
    return { ...p, imageUrl: images[0].url };
  }
  return p;
}

/** Bulk update sortOrder for categories or products (merchant reorder). */
app.post('/bulk-sort', wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body as { entity: 'categories' | 'products'; tenantId: string; items: { id: string; sortOrder: number }[] };
  const { entity, tenantId: rawTenantId, items } = body;
  if (!entity || !rawTenantId || !Array.isArray(items)) {
    return res.status(400).json({ error: 'entity, tenantId, and items (array of { id, sortOrder }) required' });
  }
  const tenantId = await resolveCatalogTenantId(rawTenantId);
  const tenants = await repos.tenants.findAll();
  const catalogTenant = tenants.find((t) => t.id === tenantId);
  if (
    !assertCatalogTenantAccess(
      user as { role?: string; tenantId?: string; marketId?: string },
      tenantId,
      catalogTenant?.marketId,
      res
    )
  ) {
    return;
  }
  const catalog = await repos.catalog.getCatalog(tenantId);
  const orderMap = new Map(items.map((i) => [i.id, i.sortOrder]));
  if (entity === 'categories') {
    const categories = (catalog.categories ?? []).map((c) => {
      const rec = c as Record<string, unknown>;
      const id = rec.id as string;
      const so = orderMap.get(id);
      return so !== undefined ? { ...rec, sortOrder: so } : rec;
    });
    await repos.catalog.setCatalog(tenantId, { ...catalog, categories });
  } else if (entity === 'products') {
    const products = (catalog.products ?? []).map((p) => {
      const rec = p as Record<string, unknown>;
      const id = rec.id as string;
      const so = orderMap.get(id);
      return so !== undefined ? { ...rec, sortOrder: so } : rec;
    });
    await repos.catalog.setCatalog(tenantId, { ...catalog, products });
  } else {
    return res.status(400).json({ error: 'entity must be categories or products' });
  }
  const updated = await repos.catalog.getCatalog(tenantId);
  res.json(updated);
}));

app.put('/catalog/:tenantId', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string; tenantId?: string; marketId?: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const tenantId = await resolveCatalogTenantId(req.params.tenantId);
  const tenants = await repos.tenants.findAll();
  const catalogTenant = tenants.find((t) => t.id === tenantId);
  if (!assertCatalogTenantAccess(user, tenantId, catalogTenant?.marketId, res)) return;
  const existingCatalog = await repos.catalog.getCatalog(tenantId);
  const catalog = sanitizeCatalogPayloadForRole(user.role, req.body as TenantCatalog, existingCatalog);
  const rawProducts = ((catalog.products ?? []) as { imageUrl?: string; images?: { url: string }[]; id?: string; name?: string }[]).map((p) =>
    normalizeProductForCompat(p)
  );
  // Measurement V2: validate each product; reject catalog write on INVALID_MEASUREMENT_CONFIG
  const products: Record<string, unknown>[] = [];
  for (const p of rawProducts) {
    const m = normalizeAndValidateMeasurementForWrite(p as Record<string, unknown>);
    if (!m.ok) {
      return res.status(400).json({
        ...m.error,
        productId: (p as { id?: string }).id,
        productName: (p as { name?: string }).name,
      });
    }
    products.push({ ...(p as Record<string, unknown>), ...m.api });
  }
  const optionGroups = ((catalog.optionGroups ?? []) as Array<Record<string, unknown> & { tenantId?: string }>).map(
    (g) => ({ ...g, tenantId: g.tenantId ?? tenantId })
  );
  const normalized = { ...catalog, products, optionGroups };
  try {
    await repos.catalog.setCatalog(tenantId, normalized);
  } catch (err) {
    // Defense in depth: repository also fail-closes before mutating
    if (isInvalidMeasurementConfigError(err)) {
      return res.status(400).json(err.toJSON());
    }
    throw err;
  }
  const updated = await repos.catalog.getCatalog(tenantId);
  res.json(updated);
}));

/** Option templates (reusable library) for a tenant. TENANT_ADMIN: own tenant; MARKET_ADMIN: tenants in market. */
app.get('/tenants/:tenantId/option-templates', wrapAsync(async (req, res) => {
  const tenantId = await resolveCatalogTenantId(req.params.tenantId);
  const user = req.user as { role?: string; tenantId?: string; marketId?: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });
  if (user.role === 'MARKET_ADMIN') {
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === tenantId);
    if (!t || (t as { marketId?: string }).marketId !== user.marketId) return res.status(403).json({ error: 'Forbidden' });
  }
  const list = getOptionTemplates(tenantId);
  res.json(list);
}));

/** Save one option group to templates (and catalog) so it appears in "Add from Templates". */
app.post('/tenants/:tenantId/option-templates', wrapAsync(async (req, res) => {
  const tenantId = await resolveCatalogTenantId(req.params.tenantId);
  const user = req.user as { role?: string; tenantId?: string; marketId?: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });
  if (user.role === 'MARKET_ADMIN') {
    const tenants = await repos.tenants.findAll();
    const t = tenants.find((x) => x.id === tenantId);
    if (!t || (t as { marketId?: string }).marketId !== user.marketId) return res.status(403).json({ error: 'Forbidden' });
  }
  const group = req.body as Record<string, unknown>;
  if (!group || typeof group !== 'object') return res.status(400).json({ error: 'Body must be an option group object' });
  addOptionTemplate(tenantId, group);
  const list = getOptionTemplates(tenantId);
  res.status(201).json(list);
}));

// --- Orders ---
/** Real customer orders only — excludes accidental/migrated lead-* rows from order listings. */
function isRealCustomerOrder(order: { id?: string }): boolean {
  const id = String(order.id ?? '').trim();
  return id !== '' && !id.startsWith('lead-');
}

function onlyRealCustomerOrders<T extends { id?: string }>(orders: T[]): T[] {
  return orders.filter(isRealCustomerOrder);
}

function isDeliveryLeadRecord(lead: { type?: string; contactType?: string }): boolean {
  const type = String(lead.type ?? '');
  if (type === 'whatsapp' || type === 'call' || type === 'PROFESSIONAL_CONTACT') return true;
  const contactType = String(lead.contactType ?? '');
  return contactType === 'whatsapp' || contactType === 'call' || contactType === 'whatsapp_order';
}

async function getMarketTenantIds(marketId: string): Promise<Set<string>> {
  const tenants = await repos.tenants.findAll();
  return new Set(tenants.filter((t) => t.marketId === marketId).map((t) => t.id));
}

app.get('/orders', wrapAsync(async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined;
  let orders = onlyRealCustomerOrders((await repos.orders.findAll()) as { id?: string; tenantId?: string }[]);
  if (req.user?.role === 'TENANT_ADMIN') {
    const ownTenantId = req.user.tenantId;
    if (!ownTenantId) return res.status(403).json({ error: 'Forbidden' });
    if (tenantId && tenantId !== ownTenantId) return res.status(403).json({ error: 'Forbidden' });
    orders = orders.filter((o) => o.tenantId === ownTenantId);
  } else if (tenantId) {
    orders = orders.filter((o) => o.tenantId === tenantId);
  }
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    const allowed = await getMarketTenantIds(req.user.marketId);
    orders = orders.filter((o) => o.tenantId && allowed.has(o.tenantId));
  }
  if (req.user?.role === 'TENANT_ADMIN' || req.user?.role === 'MARKET_ADMIN') {
    orders = orders.filter((o) => isOrderVisibleToMerchant(o as OrderRecord));
  }
  await enrichOrdersWithCustomerTrust(prisma, orders as Array<Record<string, unknown>>);
  res.json(orders);
}));

/** Tenant-scoped orders: TENANT_ADMIN own only; MARKET_ADMIN tenants in market; ROOT_ADMIN any. Query: from, to (ISO date), search (customer name/phone). */
app.get('/tenants/:tenantId/orders', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const search = (req.query.search as string || '').trim().toLowerCase();
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  let orders = onlyRealCustomerOrders(
    (await repos.orders.findAll()) as { id?: string; tenantId?: string; createdAt?: string; customerName?: string; customerPhone?: string }[]
  ).filter((o) => o.tenantId === tenantId);
  // Submission gate: merchant must not see orders until submitted
  orders = orders.filter((o) => isOrderVisibleToMerchant(o as OrderRecord));
  if (from || to) {
    const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
    orders = orders.filter((o) => {
      const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return t >= fromMs && t <= toMs;
    });
  }
  if (search) {
    const searchDigits = search.replace(/\D/g, '');
    orders = orders.filter((o) => {
      const name = (o.customerName ?? '').toLowerCase();
      const phone = (o.customerPhone ?? '').replace(/\D/g, '');
      return name.includes(search) || (searchDigits.length >= 4 && phone.includes(searchDigits));
    });
  }
  orders.forEach(enrichOrderWithMerchantAmount);
  const couriers = (await repos.couriers.findAll()) as { id?: string; name?: string; phone?: string }[];
  for (const o of orders) {
    await enrichOrderWithCourierInfo(o as Record<string, unknown>, couriers);
  }
  const pmRaw = String(req.query.paymentMethod ?? '').trim().toUpperCase();
  if (pmRaw && pmRaw !== 'ALL') {
    orders = orders.filter((o) => {
      const ch = orderPaymentChannel(o as Record<string, unknown>);
      if (pmRaw === 'CASH') return ch === 'CASH';
      if (pmRaw === 'CARD' || pmRaw === 'CREDIT_CARD' || pmRaw === 'ONLINE') return ch === 'CARD';
      return true;
    });
  }
  await enrichOrdersWithCustomerTrust(prisma, orders as Array<Record<string, unknown>>);
  res.json(orders);
}));

/** Tenant merchant: sales breakdown CASH vs card for completed/delivered/paid orders in the selected window. */
app.get('/merchant/stats', wrapAsync(async (req, res) => {
  const customer = (req as express.Request & { customer?: { id: string; phone: string } }).customer;
  if (customer) {
    const normalized = normalizePhoneForCoupon(customer.phone);
    const normalizedFallbackIntl = normalizePhoneForCoupon(FALLBACK_CUSTOMER_PHONE);
    const normalizedFallbackLocal = normalizePhoneForCoupon('0546111668');
    if (
      normalized === normalizedFallbackIntl ||
      normalized === normalizedFallbackLocal ||
      normalized.endsWith('546111668')
    ) {
      const tr = String(req.query.timeRange ?? 'day').toLowerCase() as MerchantTimeRange;
      const timeRange: MerchantTimeRange = tr === 'week' || tr === 'month' ? tr : 'day';
      const now = new Date();
      const { start, end } = dateRangeForMerchant(timeRange, now);
      return res.json({
        timeRange,
        start: start.toISOString(),
        end: end.toISOString(),
        totalSales: 1250,
        cashSales: 700,
        onlineSales: 550,
        orderCount: 8,
        cashOrderCount: 5,
        onlineOrderCount: 3,
      });
    }
  }
  if (!req.user || req.user.role !== 'TENANT_ADMIN' || !req.user.tenantId) {
    return res.status(403).json({ error: 'Forbidden', code: 'TENANT_ADMIN_ONLY' });
  }
  const tenantId = req.user.tenantId;
  const tr = String(req.query.timeRange ?? 'day').toLowerCase() as MerchantTimeRange;
  const timeRange: MerchantTimeRange = tr === 'week' || tr === 'month' ? tr : 'day';
  const all = (await repos.orders.findAll()) as Record<string, unknown>[];
  const mine = all
    .filter((o) => String(o.tenantId ?? '') === tenantId)
    .filter((o) => isOrderVisibleToMerchant(o as OrderRecord));
  const payload = aggregateMerchantStats(mine, timeRange);
  res.json(payload);
}));

app.post('/orders', wrapAsync(async (req, res) => {
  const order = req.body as {
    tenantId?: string;
    status?: string;
    prepTimeMin?: number;
    readyAt?: string;
    deliveryAssignmentMode?: string;
    fulfillmentType?: string;
    createdAt?: string;
    couponId?: string;
    [key: string]: unknown;
  };
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const tenant = order.tenantId ? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) : undefined;
  const tenantType = tenant?.tenantType ?? (tenant?.type === 'FOOD' ? 'RESTAURANT' : 'SHOP');
  const deliveryMode = tenant?.deliveryProviderMode ?? 'MARKET';

  const now = new Date().toISOString();
  const created = { ...order, createdAt: order.createdAt ?? now };
  // Ensure every new order has the store's marketId so GET /courier/orders/available includes it
  if (tenant != null) (created as { marketId?: string }).marketId = tenant.marketId;
  const customer = (req as express.Request & { customer?: { id: string } }).customer;
  if (customer) (created as Record<string, unknown>).customerId = customer.id;

  if (created.fulfillmentType === 'PICKUP' || deliveryMode === 'PICKUP_ONLY') {
    created.status = created.status ?? 'PREPARING';
    created.deliveryAssignmentMode = undefined;
  } else {
    // Mandatory market drivers: all delivery orders go to global dispatch pool (MARKET)
    created.deliveryAssignmentMode = 'MARKET';
    if (tenantType === 'RESTAURANT') {
      const prepMin = order.prepTimeMin ?? tenant?.defaultPrepTimeMin ?? 30;
      created.status = 'PREPARING';
      created.prepTimeMin = prepMin;
      const readyDate = new Date(created.createdAt ?? now);
      readyDate.setMinutes(readyDate.getMinutes() + prepMin);
      created.readyAt = readyDate.toISOString();
    } else {
      created.status = created.status ?? 'PREPARING';
      created.readyAt = created.createdAt ?? now;
    }
  }

  let orderSubtotal = (created as { subtotal?: number }).subtotal ?? (created as { items?: { totalPrice?: number }[] }).items?.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0) ?? 0;
  const orderDeliveryFee = (created as { delivery?: { fee?: number } }).delivery?.fee ?? 0;
  let couponDiscount = 0;
  const orderCouponId = (order as { couponId?: string }).couponId;
  const clientCouponDiscount = Number((order as { couponDiscountAmount?: number }).couponDiscountAmount);
  if (orderCouponId) {
    if (clientCouponDiscount > 0) {
      couponDiscount = Math.min(clientCouponDiscount, orderSubtotal + orderDeliveryFee);
    } else {
      const coupon = await prisma.coupon.findUnique({ where: { id: orderCouponId } });
      if (coupon && !coupon.usedAt && (!coupon.expiresAt || coupon.expiresAt > now)) {
        if (!coupon.tenantId || coupon.tenantId === created.tenantId) {
          const customerPhoneNorm = normalizePhoneForCoupon((created as { customerPhone?: string }).customerPhone ?? (req as express.Request & { customer?: { phone?: string } }).customer?.phone);
          if (!coupon.oneTimeUse || !coupon.winnerPhone || normalizePhoneForCoupon(coupon.winnerPhone) === customerPhoneNorm) {
            if (coupon.type === 'FIXED') couponDiscount = Math.min(Number(coupon.value), orderSubtotal);
            else if (coupon.type === 'PERCENT') couponDiscount = Math.min((orderSubtotal * Number(coupon.value)) / 100, orderSubtotal);
          }
        }
      }
    }
  }
  const legacyTotal = Math.max(0, orderSubtotal + orderDeliveryFee - couponDiscount);
  const orderItems = (created as { items?: { quantity?: number; totalPrice?: number }[] }).items ?? [];
  const itemCount = orderItems.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
  const marketForFee = tenant?.marketId
    ? ((await repos.markets.findAll()) as Market[]).find((m) => m.id === tenant.marketId)
    : undefined;
  const pricingCtx: MarketplacePricingContext = {
    marketFeeConfig: marketForFee?.platformFeeConfig,
    tenantFeeOverride: tenant?.financialConfig?.platformFee,
    featureFlagEnabled: isPlatformFeeEnabled(),
  };
  const tenantIdForCatalog = created.tenantId ?? '';
  const { categoryExemptById, productCategoryById } = tenantIdForCatalog
    ? await buildCatalogExemptionMaps(tenantIdForCatalog)
    : { categoryExemptById: new Map<string, boolean>(), productCategoryById: new Map<string, string>() };
  const displayLines = orderItems.map((i, idx) => {
    const item = i as { productId?: string; categoryId?: string; totalPrice?: number; quantity?: number };
    const catId =
      item.categoryId ||
      (item.productId ? productCategoryById.get(String(item.productId)) : undefined);
    const markupExempt = catId ? categoryExemptById.get(String(catId)) === true : false;
    return {
      lineId: String(idx),
      baseAmount: roundMoney(Number(item.totalPrice) || 0),
      quantity: Math.max(1, Number(item.quantity) || 1),
      itemCount: Math.max(0, Math.floor(Number(item.quantity) || 1)),
      markupExempt,
      categoryId: catId,
    };
  });
  const displayPricing = computeMarketplaceDisplayPricing(displayLines, pricingCtx, {
    discountAmount: couponDiscount,
  });
  const feeResult = computePlatformFee({
    itemsSubtotal: orderSubtotal,
    discountAmount: couponDiscount,
    itemCount,
    deliveryFee: orderDeliveryFee,
    marketFeeConfig: marketForFee?.platformFeeConfig,
    tenantFeeOverride: tenant?.financialConfig?.platformFee,
    featureFlagEnabled: isPlatformFeeEnabled(),
  });
  const finalTotal = isPlatformFeeEnabled()
    ? ceilShekel(displayPricing.displayMerchandiseTotal + orderDeliveryFee)
    : legacyTotal;
  if (isPlatformFeeEnabled()) {
    feeResult.platformFee = displayPricing.platformFee;
    feeResult.merchantPayout = displayPricing.merchantPayout;
    feeResult.feeBase = displayPricing.feeBase;
    feeResult.customerTotal = finalTotal;
  }

  (created as Record<string, unknown>).subtotal = orderSubtotal;
  (created as Record<string, unknown>).total = finalTotal;
  (created as Record<string, unknown>).discountAmount = couponDiscount;
  (created as Record<string, unknown>).platformFee = feeResult.platformFee;
  (created as Record<string, unknown>).platformFeeBase = feeResult.feeBase;
  (created as Record<string, unknown>).platformFeeConfigSnapshot = feeResult.configSnapshot;
  (created as Record<string, unknown>).merchantPayout = feeResult.merchantPayout;
  (created as Record<string, unknown>).customerTotal = finalTotal;
  (created as Record<string, unknown>).platformDeliveryFee = orderDeliveryFee;

  const method = ((created as { paymentMethod?: string }).paymentMethod === 'CARD' ? 'CARD' : 'CASH') as 'CASH' | 'CARD';
  const deliveryFeeModel = tenant?.financialConfig?.deliveryFeeModel ?? 'TENANT';
  let paymentBase: Awaited<ReturnType<typeof computePaymentForOrder>> | ReturnType<typeof buildPlatformFeePayment>;
  if (isPlatformFeeEnabled()) {
    paymentBase = buildPlatformFeePayment(feeResult, deliveryFeeModel);
    (created as Record<string, unknown>).merchantAmount = feeResult.merchantPayout;
  } else {
    const legacyOrderForPayment = {
      ...(created as { items?: { totalPrice?: number }[]; subtotal?: number; total?: number; delivery?: { fee?: number } }),
      total: legacyTotal,
    };
    const legacyPayment = await computePaymentForOrder(legacyOrderForPayment, created.tenantId ?? '');
    paymentBase = enrichLegacyPaymentWithSnapshot(legacyPayment, feeResult);
    (created as Record<string, unknown>).merchantAmount = legacyPayment.breakdown.itemsTotal;
  }
  const payment = { ...paymentBase, method };
  (created as Record<string, unknown>).payment = payment;

  (created as Record<string, unknown>).id = (created as { id?: string }).id ?? crypto.randomUUID?.() ?? `order-${Date.now()}`;
  (created as Record<string, unknown>).orderType = (created as { orderType?: string }).orderType ?? 'PRODUCT';

  // Submission gate metadata (before persist). delay=0 → submit immediately after save.
  const delaySeconds = getTenantOrderSubmissionDelaySeconds(tenant as RegistryTenant | undefined);
  const gated = applySubmissionGateMetadata(created as OrderRecord, delaySeconds, now);
  Object.assign(created, gated.order);

  await repos.orders.addOrderWithPayment(created, {
    method,
    status: payment.status,
    amount: payment.financials.gross,
    currency: payment.currency,
  });

  const couponId = (order as { couponId?: string }).couponId;
  if (couponId) {
    await prisma.coupon.updateMany({ where: { id: couponId }, data: { usedAt: now } }).catch(() => {});
  }

  if (gated.shouldSubmitNow) {
    const result = await submitOrderToMerchant(
      created as OrderRecord,
      tenant as RegistryTenant | undefined,
      repos,
      merchantSubmitDeps
    );
    if (result.order) Object.assign(created, result.order);
    // CARD unpaid → AWAITING_PAYMENT; poller/Hyp complete will submit later
  } else if (gated.fireAtMs != null) {
    const oid = String((created as { id?: string }).id ?? '');
    console.log(
      `[order-submission-gate] deferred merchant submit order=${oid} delay=${delaySeconds}s until=${gated.order.submissionScheduledAt}`
    );
  }

  res.status(201).json(created);
}));

app.get('/orders/:orderId', wrapAsync(async (req, res) => {
  const order = ((await repos.orders.findAll()) as { id?: string; tenantId?: string }[]).find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  enrichOrderWithMerchantAmount(order);
  // Merchant/admin only: attach operational trust summary (never on public/customer endpoints).
  if (req.user && req.user.role !== 'CUSTOMER' && req.user.role !== 'COURIER') {
    await enrichOrdersWithCustomerTrust(prisma, [order as Record<string, unknown>]);
  }
  res.json(order);
}));

/** Public order status: no auth. Returns safe fields for customer order confirmation + courier for tracking. */
app.get('/public/orders/:orderId', wrapAsync(async (req, res) => {
  const order = ((await repos.orders.findAll()) as Record<string, unknown>[]).find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const tenant = (order.tenantId as string)
    ? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)
    : undefined;
  let assignedDriver: { name: string; phone: string } | undefined;
  if (order.courierId) {
    const courier = (await repos.couriers.findAll()).find((c) => c.id === order.courierId);
    if (courier) assignedDriver = { name: courier.name ?? '', phone: courier.phone ?? '' };
  }
  const safe: Record<string, unknown> = {
    id: order.id,
    status: order.status,
    total: order.total,
    currency: order.currency,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    platformFee: order.platformFee,
    items: order.items,
    createdAt: order.createdAt,
    fulfillmentType: order.fulfillmentType,
    delivery: order.delivery,
    deliveryAddress: order.deliveryAddress,
    deliveryLocation: order.deliveryLocation,
    courierLocation: (order as { courierLocation?: { lat: number; lng: number } }).courierLocation,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    notes: order.notes,
    tenantId: order.tenantId,
    tenantSlug: tenant?.slug,
    assignedDriver,
    revision: order.revision,
    adminModifiedAt: order.adminModifiedAt,
    adminModifiedRevision: order.adminModifiedRevision,
  };
  res.json(safe);
}));

async function bumpCourierOnAdminDelivery(courierId: string): Promise<void> {
  const couriers = await repos.couriers.findAll();
  const cIdx = couriers.findIndex((c) => c.id === courierId);
  if (cIdx >= 0) {
    couriers[cIdx] = {
      ...couriers[cIdx],
      isAvailable: true,
      deliveryCount: (couriers[cIdx].deliveryCount ?? 0) + 1,
    };
    await repos.couriers.setAll(couriers);
  }
}

/** Internal: used by whatsapp-service bot to update order status (reply 1/2/3). Requires X-Internal-Secret if INTERNAL_API_SECRET is set. */
app.post('/internal/orders/:orderId/status', wrapAsync(async (req, res) => {
  if (INTERNAL_API_SECRET && req.headers['x-internal-secret'] !== INTERNAL_API_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const orderId = req.params.orderId;
  const { status } = req.body as { status: string };
  if (!status || !['CONFIRMED', 'READY', 'COMPLETED', 'DELIVERED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const orders = (await repos.orders.findAll()) as { id?: string; status?: string; tenantId?: string; courierId?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  const prevStatusForLoyaltyInternal = order.status as string | undefined;
  let updated: Record<string, unknown>;
  if (status === 'DELIVERED') {
    updated = syncAdminDeliveredOrder(orders[idx] as Record<string, unknown>) as Record<string, unknown>;
    if (order.courierId) await bumpCourierOnAdminDelivery(order.courierId);
  } else {
    updated = { ...orders[idx], status };
  }
  orders[idx] = updated;
  await repos.orders.upsert(updated as OrderRecord);
  const notifyStatus = String(updated.status ?? status);
  if (['CONFIRMED', 'READY', 'COMPLETED'].includes(notifyStatus)) {
    const tenantForNotify = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) as { name?: string } | undefined;
    triggerStatusNotification(updated as { id?: string; customerName?: string; customerPhone?: string; [key: string]: unknown }, notifyStatus, tenantForNotify?.name);
    (updated as Record<string, unknown>).lastStatusNotification = { status: notifyStatus, at: new Date().toISOString() };
    orders[idx] = updated;
    await repos.orders.upsert(updated as OrderRecord);
  }
  try {
    const orderWithCustomer = updated as { customerPhone?: string; customerId?: string };
    let customerPhone = orderWithCustomer.customerPhone;
    if (!customerPhone && orderWithCustomer.customerId) {
      const customers = await repos.customers.findAll();
      const customer = customers.find((c) => c.id === orderWithCustomer.customerId);
      customerPhone = customer?.phone;
    }
    if (customerPhone) notifyCustomerOrderStatusPush(customerPhone, notifyStatus);
  } catch {
    // do not break order update if push lookup/send fails
  }
  await runLoyaltyAwardForOrderAtIndex(orders as Record<string, unknown>[], idx, prevStatusForLoyaltyInternal);
  orders[idx] = await applySettlementToOrderIfEligible(orders[idx] as Record<string, unknown>);
  await repos.orders.upsert(orders[idx] as OrderRecord);
  await applyCourierPayrollIfEligible(orders[idx] as Record<string, unknown>);
  res.json(orders[idx]);
}));

app.patch('/orders/:orderId/status', wrapAsync(async (req, res) => {
  const { status } = req.body as { status: string };
  const orders = (await repos.orders.findAll()) as { id?: string; status?: string; tenantId?: string; courierId?: string }[];
  const idx = orders.findIndex((o) => o.id === req.params.orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  const prevStatusForLoyaltyPatch = order.status as string | undefined;
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId) {
    const tenant = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId);
    if (!tenant || tenant.marketId !== req.user.marketId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId) {
    if (order.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden: order does not belong to your store' });
    }
  }
  let updated: Record<string, unknown>;
  if (status === 'DELIVERED') {
    updated = syncAdminDeliveredOrder(orders[idx] as Record<string, unknown>) as Record<string, unknown>;
    if (order.courierId) await bumpCourierOnAdminDelivery(order.courierId);
  } else {
    updated = { ...orders[idx], status };
  }
  orders[idx] = updated;
  await repos.orders.upsert(updated as OrderRecord);

  const notifyStatus = String(updated.status ?? status);
  if (['CONFIRMED', 'READY', 'COMPLETED'].includes(notifyStatus)) {
    const tenantForNotify = (await repos.tenants.findAll()).find((t) => t.id === order.tenantId) as { name?: string } | undefined;
    triggerStatusNotification(updated as { id?: string; customerName?: string; customerPhone?: string; [key: string]: unknown }, notifyStatus, tenantForNotify?.name);
    (updated as Record<string, unknown>).lastStatusNotification = { status: notifyStatus, at: new Date().toISOString() };
    orders[idx] = updated;
    await repos.orders.upsert(updated as OrderRecord);
  }

  try {
    const orderWithCustomer = updated as { customerPhone?: string; customerId?: string; id?: string };
    let customerPhone = orderWithCustomer.customerPhone;
    const customerId = orderWithCustomer.customerId;
    const customers = await repos.customers.findAll();
    const customer = customerId ? customers.find((c) => c.id === customerId) : undefined;
    if (!customerPhone && customer) customerPhone = customer.phone;
    if (customerPhone) notifyCustomerOrderStatusPush(customerPhone, notifyStatus);
    if (customerId && orderWithCustomer.id && ['CONFIRMED', 'READY', 'COMPLETED', 'DELIVERED'].includes(notifyStatus)) {
      const fcmToken = await getCustomerFcmToken(customerId);
      if (fcmToken) sendFCMToCustomerToken(fcmToken, notifyStatus, orderWithCustomer.id);
    }
    // Customer-facing FCM notification on key status changes
    if (customerId && ['COMPLETED', 'CANCELLED'].includes(notifyStatus)) {
      const title = 'تحديث حالة طلبك';
      const body = notifyStatus === 'COMPLETED' ? 'طلبك جاهز! استمتع بوجبتك.' : 'نعتذر، تم إلغاء طلبك.';
      await sendFCMNotification(customerId, title, body);
    }
  } catch {
    // do not break order update if push lookup/send fails
  }

  await runLoyaltyAwardForOrderAtIndex(orders as Record<string, unknown>[], idx, prevStatusForLoyaltyPatch);
  orders[idx] = await applySettlementToOrderIfEligible(orders[idx] as Record<string, unknown>);
  await repos.orders.upsert(orders[idx] as OrderRecord);
  await applyCourierPayrollIfEligible(orders[idx] as Record<string, unknown>);
  res.json(orders[idx]);
}));

/**
 * Manually run loyalty award for an order (testing / recovery).
 * Persists COMPLETED first if needed, then runs the same award path as courier/admin completion.
 * Auth: TENANT_ADMIN (own store), MARKET_ADMIN (same market), ROOT_ADMIN / SUPER_ADMIN (any).
 */
app.post('/orders/:orderId/loyalty-force-award', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string; marketId?: string; tenantId?: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const orderId = req.params.orderId;
  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const row = orders[idx] as { tenantId?: string; status?: string };
  const isPlatform = user.role === 'ROOT_ADMIN' || user.role === 'SUPER_ADMIN';
  if (!isPlatform) {
    if (user.role === 'MARKET_ADMIN' && user.marketId) {
      const tenant = (await repos.tenants.findAll()).find((t) => t.id === row.tenantId);
      if (!tenant || tenant.marketId !== user.marketId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (user.role === 'TENANT_ADMIN' && user.tenantId) {
      if (row.tenantId !== user.tenantId) {
        return res.status(403).json({ error: 'Forbidden: order does not belong to your store' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const prevStatus = row.status;
  const st = String(row.status ?? '').toUpperCase();
  if (st !== 'COMPLETED' && st !== 'DELIVERED') {
    orders[idx] = { ...orders[idx], status: 'COMPLETED' };
    await repos.orders.restore(orders[idx] as OrderRecord);
  }
  await runLoyaltyAwardForOrderAtIndex(orders, idx, prevStatus);
  await repos.orders.upsert(orders[idx] as OrderRecord);
  res.json({ ok: true, order: orders[idx] });
}));

/** Hard delete order (and cascade: payment, etc.).
 *  ROOT_ADMIN / SUPER_ADMIN: any order.
 *  MARKET_ADMIN: orders whose tenant belongs to the same market.
 *  TENANT_ADMIN: orders for their store only.
 */
app.delete('/orders/:orderId/hard-delete', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string; marketId?: string; tenantId?: string; id?: string } | undefined;
  console.log('HARD-DELETE-ATTEMPT:', req.user);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const orderId = req.params.orderId;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  const orders = await repos.orders.findAll();
  const order = orders.find((o) => (o as { id?: string }).id === orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const orderTenantId = (order as { tenantId?: string }).tenantId;
  const tenants = await repos.tenants.findAll();
  const orderTenant = orderTenantId ? tenants.find((t) => t.id === orderTenantId) : undefined;
  const orderMarketId = (orderTenant as { marketId?: string | null } | undefined)?.marketId ?? undefined;

  const role = user.role;
  let allowed = false;
  if (isPlatformAdmin(role)) {
    allowed = true;
  } else if (role === 'MARKET_ADMIN' && user.marketId && orderMarketId && orderMarketId === user.marketId) {
    allowed = true;
  } else if (role === 'TENANT_ADMIN' && user.tenantId && orderTenantId && orderTenantId === user.tenantId) {
    allowed = true;
  }

  if (!allowed) {
    return res.status(403).json({
      error: 'Forbidden: hard delete requires platform admin, market admin (same market), or tenant admin (same store)',
    });
  }

  await repos.orders.deleteById(orderId);
  res.status(204).send();
}));

/**
 * Super Admin order management — add/remove/edit line items, modifiers, notes.
 * Auth: ROOT_ADMIN | SUPER_ADMIN only. Status-gated. Reason required.
 * Transactional: revision CAS + append-only OrderModification + optional Idempotency-Key.
 */
app.patch('/admin/orders/:orderId/manage', wrapAsync(async (req, res) => {
  const user = req.user as { id?: string; role?: string; email?: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!canManageOrderItems(user.role)) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      error: 'Only SUPER_ADMIN may manage order items',
      messageAr: 'إدارة أصناف الطلب متاحة لمدير المنصة فقط.',
    });
  }

  const orderId = String(req.params.orderId ?? '').trim();
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  const row = await prisma.order.findUnique({ where: { id: orderId } });
  if (!row) return res.status(404).json({ error: 'Order not found' });

  const tenants = await repos.tenants.findAll();
  const tenant = tenants.find((t) => t.id === row.tenantId) as RegistryTenant | undefined;
  const tenantId = String(row.tenantId ?? '');
  if (!tenantId) return res.status(400).json({ error: 'Order has no tenant' });

  const catalog = await repos.catalog.getCatalog(tenantId);
  const body = req.body as {
    reason?: unknown;
    reasonDetail?: string;
    operations?: unknown;
    expectedRevision?: number;
    idempotencyKey?: string;
  };
  const idempotencyKey =
    (typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) ||
    (typeof req.headers['idempotency-key'] === 'string' ? String(req.headers['idempotency-key']).trim() : '') ||
    undefined;

  const result = await executeManageOrderTransaction({
    orderId,
    actor: { id: String(user.id ?? ''), role: String(user.role ?? ''), email: user.email },
    reason: body.reason,
    reasonDetail: body.reasonDetail,
    rawOperations: body.operations,
    expectedRevision:
      body.expectedRevision != null && Number.isFinite(Number(body.expectedRevision))
        ? Number(body.expectedRevision)
        : undefined,
    idempotencyKey,
    tenant,
    catalog,
    repos,
    onCommittedVisibleUpdate: async ({ order, modification, tenantId: tid }) => {
      // One authoritative lightweight event per successful manage (no audit snapshot)
      await sendFCMToTenantForOrderUpdated(tid, {
        orderId: String(order.id ?? orderId),
        orderGroupId: typeof order.orderGroupId === 'string' ? order.orderGroupId : undefined,
        revision: typeof order.revision === 'number' ? order.revision : undefined,
        totalBefore: modification.before.total,
        totalAfter: modification.after.total,
      });
      // Customer push (best-effort) when we have a customer id
      const customerId = typeof order.customerId === 'string' ? order.customerId : undefined;
      if (customerId) {
        try {
          const fcmToken = await getCustomerFcmToken(customerId);
          if (fcmToken) {
            await sendFCMToCustomerToken(fcmToken, 'ORDER_UPDATED', String(order.id ?? orderId));
          }
        } catch {
          /* non-fatal */
        }
      }
    },
  });

  if (!result.ok) return res.status(result.status).json(result.body);
  res.status(result.status).json(result.body);
}));

/** Read Super Admin modification history (append-only OrderModification table). */
app.get('/admin/orders/:orderId/modifications', wrapAsync(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!canManageOrderItems(user.role)) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      error: 'Only SUPER_ADMIN may view order modifications',
    });
  }
  const orderId = String(req.params.orderId ?? '').trim();
  const row = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true } });
  if (!row) return res.status(404).json({ error: 'Order not found' });
  const modifications = await listOrderModifications(orderId);
  res.json({
    orderId,
    status: row.status,
    editable: isOrderManagementEditable(row.status ?? undefined),
    blockReason: getOrderManagementBlockReason(row.status ?? undefined),
    modifications,
    persistence: 'order_modifications',
  });
}));

// --- Campaigns ---
app.get('/campaigns', async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined;
  let campaigns = getCampaigns() as { tenantId?: string }[];
  if (tenantId) campaigns = campaigns.filter((c) => c.tenantId === tenantId);
  res.json(campaigns);
});

app.post('/campaigns', async (req, res) => {
  const campaign = req.body;
  const campaigns = getCampaigns();
  campaigns.push(campaign);
  setCampaigns(campaigns);
  res.status(201).json(campaign);
});

app.put('/campaigns/:id', async (req, res) => {
  const campaigns = getCampaigns() as { id?: string }[];
  const idx = campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
  campaigns[idx] = { ...campaigns[idx], ...req.body };
  setCampaigns(campaigns);
  res.json(campaigns[idx]);
});

app.delete('/campaigns/:id', async (req, res) => {
  const campaigns = getCampaigns() as { id?: string }[];
  const next = campaigns.filter((c) => c.id !== req.params.id);
  if (next.length === campaigns.length) return res.status(404).json({ error: 'Campaign not found' });
  setCampaigns(next);
  res.json({ deleted: true });
});

// --- Delivery ---
app.get('/delivery/:tenantId', wrapAsync(async (req, res) => {
  const settings = await repos.delivery.getSettings(req.params.tenantId);
  res.json(settings);
}));

app.put('/delivery/:tenantId', wrapAsync(async (req, res) => {
  const tenantId = req.params.tenantId;
  const settings = { ...req.body, tenantId };
  await repos.delivery.setSettings(tenantId, settings);
  res.json(settings);
}));

// --- Delivery Zones ---
const DEFAULT_ZONE_CENTER = { lat: 32.08, lng: 34.78 };
const DEFAULT_RADIUS_KM = 2;

/** Ensure each zone has centerLat, centerLng, radiusKm so the map and storefront can use them. */
function normalizeZoneForResponse(z: DeliveryZoneRecord): DeliveryZoneRecord {
  return {
    ...z,
    centerLat: z.centerLat ?? DEFAULT_ZONE_CENTER.lat,
    centerLng: z.centerLng ?? DEFAULT_ZONE_CENTER.lng,
    radiusKm: z.radiusKm ?? DEFAULT_RADIUS_KM,
  };
}

function sortZones(zones: DeliveryZoneRecord[]): DeliveryZoneRecord[] {
  return [...zones].sort((a, b) => {
    const soA = a.sortOrder ?? 999;
    const soB = b.sortOrder ?? 999;
    if (soA !== soB) return soA - soB;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
}

app.get('/tenants/:tenantId/delivery-zones', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const sorted = sortZones(zones);
  res.json(sorted.map(normalizeZoneForResponse));
}));

function requirePlatformAdminForDelivery(req: express.Request, res: express.Response): boolean {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    res.status(403).json({ error: 'Forbidden: only platform admin (ROOT_ADMIN/SUPER_ADMIN) can manage delivery zones' });
    return false;
  }
  return true;
}

app.post('/tenants/:tenantId/delivery-zones', wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId } = req.params;
  const body = req.body as Omit<DeliveryZoneRecord, 'id' | 'tenantId'>;
  const id = crypto.randomUUID?.() ?? `dz-${Date.now()}`;
  const zone: DeliveryZoneRecord = {
    id,
    tenantId,
    name: body.name ?? '',
    fee: body.fee ?? 0,
    etaMinutes: body.etaMinutes,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder,
    centerLat: body.centerLat,
    centerLng: body.centerLng,
    radiusKm: body.radiusKm,
  };
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  zones.push(zone);
  await repos.deliveryZones.setAll(tenantId, zones);
  res.status(201).json(normalizeZoneForResponse(zone));
}));

app.put('/tenants/:tenantId/delivery-zones/:zoneId', wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const body = req.body as Partial<Omit<DeliveryZoneRecord, 'id' | 'tenantId'>>;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: 'Zone not found' });
  zones[idx] = { ...zones[idx], ...body };
  await repos.deliveryZones.setAll(tenantId, zones);
  res.json(normalizeZoneForResponse(zones[idx]));
}));

app.patch('/tenants/:tenantId/delivery-zones/:zoneId', wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const body = req.body as Partial<Pick<DeliveryZoneRecord, 'isActive' | 'name' | 'fee' | 'etaMinutes' | 'sortOrder' | 'centerLat' | 'centerLng' | 'radiusKm'>>;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const idx = zones.findIndex((z) => z.id === zoneId);
  if (idx === -1) return res.status(404).json({ error: 'Zone not found' });
  zones[idx] = { ...zones[idx], ...body };
  await repos.deliveryZones.setAll(tenantId, zones);
  res.json(normalizeZoneForResponse(zones[idx]));
}));

app.delete('/tenants/:tenantId/delivery-zones/:zoneId', wrapAsync(async (req, res) => {
  if (!requirePlatformAdminForDelivery(req, res)) return;
  const { tenantId, zoneId } = req.params;
  const zones = await repos.deliveryZones.getByTenant(tenantId);
  const filtered = zones.filter((z) => z.id !== zoneId);
  if (filtered.length === zones.length) return res.status(404).json({ error: 'Zone not found' });
  await repos.deliveryZones.setAll(tenantId, filtered);
  res.json({ deleted: true });
}));

/** Sync delivery zones from one store to all other stores in the same market. ROOT_ADMIN: any market; MARKET_ADMIN: own market only. */
app.post('/markets/:marketId/sync-delivery', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const body = req.body as { sourceTenantId?: string };
  const sourceTenantId = typeof body?.sourceTenantId === 'string' ? body.sourceTenantId.trim() : undefined;
  if (!sourceTenantId) {
    return res.status(400).json({ error: 'sourceTenantId is required', code: 'SOURCE_TENANT_REQUIRED' });
  }
  const user = req.user as { role?: string; marketId?: string } | undefined;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role !== 'ROOT_ADMIN' && user.role !== 'SUPER_ADMIN') {
    if (user.role !== 'MARKET_ADMIN' || user.marketId !== marketId) {
      return res.status(403).json({ error: 'Forbidden: only platform admin or market admin for this market can sync delivery' });
    }
  }
  const markets = await repos.markets.findAll();
  const market = markets.find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  const tenantIds = await getMarketTenantIds(marketId);
  if (!tenantIds.has(sourceTenantId)) {
    return res.status(400).json({ error: 'Source tenant is not in this market', code: 'SOURCE_NOT_IN_MARKET' });
  }
  const sourceZones = await repos.deliveryZones.getByTenant(sourceTenantId);
  const templateZones = sourceZones.map((z) => ({
    name: z.name,
    fee: z.fee,
    etaMinutes: z.etaMinutes,
    isActive: z.isActive ?? true,
    sortOrder: z.sortOrder,
    centerLat: z.centerLat,
    centerLng: z.centerLng,
    radiusKm: z.radiusKm,
  }));
  const synced: string[] = [];
  for (const tid of tenantIds) {
    if (tid === sourceTenantId) continue;
    const newZones: DeliveryZoneRecord[] = templateZones.map((t, i) => ({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `dz-sync-${tid}-${Date.now()}-${i}`,
      tenantId: tid,
      name: t.name,
      fee: t.fee,
      etaMinutes: t.etaMinutes,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      centerLat: t.centerLat,
      centerLng: t.centerLng,
      radiusKm: t.radiusKm,
    }));
    await repos.deliveryZones.setAll(tid, newZones);
    synced.push(tid);
  }
  res.json({ synced: synced.length, tenantIds: synced });
}));

// --- Tenant delivery settings (PATCH) ---
app.patch('/tenants/:tenantId/settings/delivery', async (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  const tenants = (await repos.tenants.findAll());
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { tenantType?: string; deliveryProviderMode?: string; allowMarketCourierFallback?: boolean; defaultPrepTimeMin?: number };
  const updates: Partial<RegistryTenant> = {};
  if (body.tenantType !== undefined) updates.tenantType = body.tenantType as 'RESTAURANT' | 'SHOP' | 'SERVICE';
  if (body.deliveryProviderMode !== undefined) updates.deliveryProviderMode = body.deliveryProviderMode as 'TENANT' | 'MARKET' | 'PICKUP_ONLY';
  if (body.allowMarketCourierFallback !== undefined) updates.allowMarketCourierFallback = body.allowMarketCourierFallback;
  if (body.defaultPrepTimeMin !== undefined) updates.defaultPrepTimeMin = body.defaultPrepTimeMin;

  const idx = tenants.findIndex((t) => t.id === tenantId);
  const before = { ...tenants[idx] };
  tenants[idx] = { ...tenants[idx], ...updates };
  await repos.tenants.setAll(tenants);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId: tenant.marketId,
    action: 'update',
    entity: 'tenant',
    entityId: tenantId,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: tenants[idx],
  });
  res.json(tenants[idx]);
});

// --- Mark order READY (restaurant) ---
app.post('/tenants/:tenantId/orders/:orderId/ready', async (req, res) => {
  const { tenantId, orderId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  if (orders[idx].tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });

  const now = new Date().toISOString();
  const updated = { ...orders[idx], status: 'READY', readyAt: now } as OrderRecord & Record<string, unknown>;
  orders[idx] = updated;
  await repos.orders.upsert(updated);

  triggerStatusNotification(updated as { id?: string; customerName?: string; customerPhone?: string; [key: string]: unknown }, 'READY', (tenant as { name?: string })?.name);
  (updated as Record<string, unknown>).lastStatusNotification = { status: 'READY', at: now };
  orders[idx] = updated;
  await repos.orders.upsert(updated);

  try {
    const orderWithCustomer = updated as { customerPhone?: string; customerId?: string; id?: string };
    let customerPhone = orderWithCustomer.customerPhone;
    const customers = await repos.customers.findAll();
    const customer = orderWithCustomer.customerId ? customers.find((c) => c.id === orderWithCustomer.customerId) : undefined;
    if (!customerPhone && customer) customerPhone = customer.phone;
    if (customerPhone) notifyCustomerOrderStatusPush(customerPhone, 'READY');
    if (orderWithCustomer.customerId && orderWithCustomer.id) {
      const fcmToken = await getCustomerFcmToken(orderWithCustomer.customerId);
      if (fcmToken) sendFCMToCustomerToken(fcmToken, 'READY', orderWithCustomer.id);
    }
  } catch {
    // do not break order update
  }

  const fulfillmentType = (updated as { fulfillmentType?: string }).fulfillmentType;
  if (fulfillmentType === 'DELIVERY') {
    const marketId = (tenant as { marketId?: string }).marketId;
    if (marketId) {
      const couriers = (await repos.couriers.findAll()) as { id?: string; scopeType?: string; scopeId?: string; marketId?: string }[];
      emitOrderReadyForMarket(marketId, orderId, couriers);
    }
  }

  res.json(orders[idx]);
});

/** Merchant marks order as handed to driver (sync point for courier "Start Delivery"). */
app.post('/tenants/:tenantId/orders/:orderId/handed-to-driver', wrapAsync(async (req, res) => {
  const { tenantId, orderId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) return res.status(403).json({ error: 'Forbidden' });
  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; courierId?: string; status?: string; deliveryTimeline?: Record<string, unknown> }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  if (order.tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });
  if (!order.courierId) return res.status(400).json({ error: 'Order has no driver assigned', code: 'BAD_REQUEST' });
  if (order.status !== 'READY') return res.status(400).json({ error: 'Order must be READY', code: 'BAD_REQUEST' });
  const now = new Date().toISOString();
  const tl = { ...(order.deliveryTimeline || {}), handedToDriverAt: (order.deliveryTimeline as { handedToDriverAt?: string })?.handedToDriverAt ?? now };
  orders[idx] = { ...order, deliveryTimeline: tl };
  await repos.orders.upsert(orders[idx] as OrderRecord);
  res.json(orders[idx]);
}));

/** Helper: courier's market ID (for MARKET-scoped couriers) */
function courierMarketId(c: { scopeType?: string; scopeId?: string; marketId?: string }): string | undefined {
  if (c.scopeType !== 'MARKET') return undefined;
  return c.marketId ?? c.scopeId;
}

function sanitizeCourier<T extends { password?: string }>(courier: T): Omit<T, 'password'> {
  const { password: _password, ...safe } = courier;
  return safe;
}

/** SLA threshold (minutes) for onTimeRate: delivery within this = on time */
const SLA_OK_MIN = 30;

/** Pure gamification: input = delivered orders in period, output = points, badges, rankScore. Uses UTC boundaries. */
function computeGamification(
  orders: { deliveryTimeline?: { deliveredAt?: string; durations?: { totalMinutes?: number } } }[],
  period: 'day' | 'week'
): { points: number; badges: string[]; rankScore: number } {
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const cutoff = period === 'day' ? todayStart : weekStart;
  const filtered = orders.filter((o) => {
    const at = o.deliveryTimeline?.deliveredAt;
    if (!at) return false;
    return new Date(at).getTime() >= cutoff;
  });

  let points = 0;
  const badges: string[] = [];

  for (const o of filtered) {
    points += 10;
    const totalMin = o.deliveryTimeline?.durations?.totalMinutes;
    if (totalMin != null && totalMin < SLA_OK_MIN) points += 5;
  }

  const onTimeCount = filtered.filter((o) => {
    const m = o.deliveryTimeline?.durations?.totalMinutes;
    return m != null && m < SLA_OK_MIN;
  }).length;
  const count = filtered.length;
  const allOnTime = count > 0 && onTimeCount === count;

  if (period === 'day') {
    if (count >= 3 && allOnTime) badges.push('سريع');
  } else {
    if (count >= 5) badges.push('بطل الأسبوع');
    if (count >= 5 && allOnTime) badges.push('دقيق');
    if (count >= 10) badges.push('مثابر');
  }

  return { points, badges, rankScore: points };
}

type DeliveredOrderForMetrics = {
  deliveryTimeline?: { deliveredAt?: string; durations?: { totalMinutes?: number; pickedUpToDelivered?: number } };
};

/** Compute courier performance metrics + gamification from delivered orders in market. UTC boundaries. */
async function computeCourierMetrics(marketId: string, courierId: string): Promise<{
  deliveredCountToday: number;
  deliveredCountWeek: number;
  avgTotalMin: number | null;
  avgPickupToDeliveredMin: number | null;
  onTimeRate: number | null;
  pointsToday: number;
  pointsWeek: number;
  badgesWeek: string[];
}> {
  const tenantIds = await getMarketTenantIds(marketId);
  const orders = ((await repos.orders.findAll()) as (DeliveredOrderForMetrics & { tenantId?: string; courierId?: string; status?: string; fulfillmentType?: string })[]).filter(
    (o) =>
      o.fulfillmentType === 'DELIVERY' &&
      o.courierId === courierId &&
      o.status === 'DELIVERED' &&
      o.tenantId &&
      tenantIds.has(o.tenantId)
  );
  const withDeliveredAt = orders.filter((o) => o.deliveryTimeline?.deliveredAt) as DeliveredOrderForMetrics[];
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  let deliveredCountToday = 0;
  let deliveredCountWeek = 0;
  const totalMins: number[] = [];
  const pickupMins: number[] = [];
  let onTimeCount = 0;
  let withDurationCount = 0;
  for (const o of withDeliveredAt) {
    const t = new Date(o.deliveryTimeline!.deliveredAt!).getTime();
    if (t >= todayStart) deliveredCountToday++;
    if (t >= weekStart) deliveredCountWeek++;
    const dur = o.deliveryTimeline?.durations;
    if (dur?.totalMinutes != null) {
      totalMins.push(dur.totalMinutes);
      withDurationCount++;
      if (dur.totalMinutes < SLA_OK_MIN) onTimeCount++;
    }
    if (dur?.pickedUpToDelivered != null) pickupMins.push(dur.pickedUpToDelivered);
  }
  const gamificationDay = computeGamification(withDeliveredAt, 'day');
  const gamificationWeek = computeGamification(withDeliveredAt, 'week');
  return {
    deliveredCountToday,
    deliveredCountWeek,
    avgTotalMin: totalMins.length ? Math.round(totalMins.reduce((a, b) => a + b, 0) / totalMins.length) : null,
    avgPickupToDeliveredMin: pickupMins.length ? Math.round(pickupMins.reduce((a, b) => a + b, 0) / pickupMins.length) : null,
    onTimeRate: withDurationCount > 0 ? Math.round((onTimeCount / withDurationCount) * 100) : null,
    pointsToday: gamificationDay.points,
    pointsWeek: gamificationWeek.points,
    badgesWeek: gamificationWeek.badges,
  };
}

// --- Market couriers ---
app.get('/markets/:marketId/couriers', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot access couriers from another market', code: 'CROSS_MARKET_ACCESS' });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const users = await repos.users.findAll();
  const emailByCourierId = new Map(users.filter((u) => u.role === 'COURIER' && u.courierId).map((u) => [u.courierId as string, u.email ?? '']));
  res.json(couriers.map((c) => ({ ...sanitizeCourier(c), email: emailByCourierId.get(c.id) ?? undefined })));
});

/** Courier performance stats. MARKET_ADMIN scoped. Same access rules as GET /couriers. */
app.get('/markets/:marketId/couriers/stats', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot access couriers from another market', code: 'CROSS_MARKET_ACCESS' });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const list = await Promise.all(couriers.map(async (c) => ({
    ...sanitizeCourier(c),
    ...(await computeCourierMetrics(marketId, c.id)),
  })));
  res.json(list);
});

/** Weekly leaderboard. MARKET_ADMIN: own market; COURIER: own market only; TENANT_ADMIN: 403. */
app.get('/markets/:marketId/leaderboard', async (req, res) => {
  const { marketId } = req.params;
  const period = (req.query.period as string) || 'week';
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot access leaderboard from another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (req.user?.role === 'COURIER' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Courier can only access own market leaderboard', code: 'CROSS_MARKET_ACCESS' });
  }
  if (period !== 'week') return res.status(400).json({ error: 'period=week only' });

  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const withMetrics = await Promise.all(couriers.map(async (c) => ({
    courierId: c.id,
    name: c.name,
    ...(await computeCourierMetrics(marketId, c.id)),
  })));
  withMetrics.sort((a, b) => {
    const pa = a.pointsWeek ?? 0;
    const pb = b.pointsWeek ?? 0;
    if (pa !== pb) return pb - pa;
    const oa = a.onTimeRate ?? -1;
    const ob = b.onTimeRate ?? -1;
    if (oa !== ob) return ob - oa;
    const ma = a.avgTotalMin ?? 9999;
    const mb = b.avgTotalMin ?? 9999;
    return ma - mb;
  });
  const leaderboard = withMetrics.map((row, i) => ({
    courierId: row.courierId,
    name: row.name,
    pointsWeek: row.pointsWeek ?? 0,
    badgesWeek: row.badgesWeek ?? [],
    avgTotalMin: row.avgTotalMin,
    onTimeRate: row.onTimeRate,
    rank: i + 1,
  }));
  const myCourierId = req.user?.role === 'COURIER' ? req.user.courierId : undefined;
  const myRow = myCourierId ? leaderboard.find((r) => r.courierId === myCourierId) : undefined;
  res.json({
    leaderboard,
    myRank: myRow?.rank ?? null,
  });
});

app.post('/markets/:marketId/couriers', async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot create couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { name?: string; phone?: string; email?: string; password?: string; allowedStoreIds?: string[] };
  const allowedStoreIds = Array.isArray(body.allowedStoreIds)
    ? [...new Set(body.allowedStoreIds.map((x) => String(x).trim()).filter(Boolean))]
    : undefined;
  const password = typeof body.password === 'string' && body.password.trim().length >= 6 ? body.password.trim() : '123456';
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });
  const users = await repos.users.findAll();
  const duplicate = users.find((u) => u.email?.toLowerCase() === email);
  if (duplicate) return res.status(409).json({ error: 'Email already in use', code: 'EMAIL_EXISTS' });
  const id = `courier-${crypto.randomUUID?.() ?? Date.now()}`;
  const courier: Courier = {
    id,
    scopeType: 'MARKET',
    scopeId: marketId,
    marketId,
    name: body.name ?? '',
    phone: body.phone,
    password,
    isActive: true,
    isOnline: false,
    capacity: 3,
    isAvailable: true,
    deliveryCount: 0,
    allowedStoreIds,
  };
  const couriers = (await repos.couriers.findAll());
  couriers.push(courier);
  await repos.couriers.setAll(couriers);
  const userId = `user-courier-${id}`;
  await repos.users.setAll([
    ...users,
    { id: userId, email, role: 'COURIER', marketId, courierId: id, password },
  ]);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'create',
    entity: 'courier',
    entityId: id,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    after: courier,
  });
  res.status(201).json({ ...sanitizeCourier(courier), email });
});

app.patch('/markets/:marketId/couriers/:courierId', async (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot update couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const couriers = (await repos.couriers.findAll());
  const idx = couriers.findIndex((c) => c.id === courierId && courierMarketId(c) === marketId);
  if (idx === -1) {
    const other = couriers.find((c) => c.id === courierId);
    if (other && courierMarketId(other) && courierMarketId(other) !== marketId) {
      return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
    }
    return res.status(404).json({ error: 'Courier not found' });
  }
  const before = { ...couriers[idx] };
  const body = req.body as Partial<Pick<Courier, 'name' | 'phone' | 'isActive' | 'isOnline' | 'isAvailable' | 'capacity'>> & { allowedStoreIds?: string[]; email?: string };
  const normalizedAllowedStoreIds = Array.isArray(body.allowedStoreIds)
    ? [...new Set(body.allowedStoreIds.map((x) => String(x).trim()).filter(Boolean))]
    : undefined;
  const users = await repos.users.findAll();
  const uIdx = users.findIndex((u) => u.role === 'COURIER' && u.courierId === courierId);
  const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
  if (requestedEmail) {
    const collision = users.find((u, i) => i !== uIdx && u.email?.toLowerCase() === requestedEmail);
    if (collision) return res.status(409).json({ error: 'Email already in use', code: 'EMAIL_EXISTS' });
  }
  couriers[idx] = { ...couriers[idx], ...body, ...(normalizedAllowedStoreIds ? { allowedStoreIds: normalizedAllowedStoreIds } : {}) };
  await repos.couriers.setAll(couriers);
  if (requestedEmail) {
    if (uIdx >= 0) {
      users[uIdx] = { ...users[uIdx], email: requestedEmail };
    } else {
      users.push({
        id: `user-courier-${courierId}`,
        email: requestedEmail,
        role: 'COURIER',
        marketId,
        courierId,
        password: couriers[idx].password ?? '123456',
      });
    }
    await repos.users.setAll(users);
  }
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'update',
    entity: 'courier',
    entityId: courierId,
    reason: isPlatformAdmin(user!.role) ? getEmergencyReason(req) : undefined,
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: couriers[idx],
  });
  const currentEmail = users.find((u) => u.role === 'COURIER' && u.courierId === courierId)?.email;
  res.json({ ...sanitizeCourier(couriers[idx]), email: currentEmail ?? undefined });
});

/** Admin override: reset/change a courier password. */
app.post('/markets/:marketId/couriers/:courierId/change-password', async (req, res) => {
  const { marketId, courierId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) return res.status(403).json({ error: 'Cannot update courier in another market', code: 'CROSS_MARKET_ACCESS' });
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;
  const body = req.body as { newPassword?: string };
  const newPassword = String(body?.newPassword ?? '').trim();
  if (newPassword.length < 6) return res.status(400).json({ error: 'newPassword min 6 chars required' });
  const couriers = await repos.couriers.findAll();
  const idx = couriers.findIndex((c) => c.id === courierId && courierMarketId(c) === marketId);
  if (idx === -1) return res.status(404).json({ error: 'Courier not found' });
  couriers[idx] = { ...couriers[idx], password: newPassword };
  await repos.couriers.setAll(couriers);
  res.json({ ok: true });
});

/** Global external manual orders report for Super Admin. */
app.get('/admin/external-orders', wrapAsync(async (req, res) => {
  if (!isPlatformAdmin(req.user?.role)) return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  const rows = await prisma.order.findMany({
    where: { isExternal: true },
    select: {
      id: true,
      marketId: true,
      tenantId: true,
      manualStoreName: true,
      courierId: true,
      total: true,
      externalDestination: true,
      createdAt: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const [couriers, tenants, markets] = await Promise.all([
    prisma.courier.findMany({ select: { id: true, name: true, phone: true } }),
    prisma.tenant.findMany({ select: { id: true, name: true } }),
    prisma.market.findMany({ select: { id: true, name: true } }),
  ]);
  const courierMap = new Map(couriers.map((c) => [c.id, c]));
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const marketMap = new Map(markets.map((m) => [m.id, m]));
  res.json(rows.map((o) => {
    const c = o.courierId ? courierMap.get(o.courierId) : undefined;
    const t = o.tenantId ? tenantMap.get(o.tenantId) : undefined;
    const m = o.marketId ? marketMap.get(o.marketId) : undefined;
    return {
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      marketId: o.marketId,
      marketName: m?.name ?? o.marketId ?? null,
      courierId: o.courierId,
      courierName: c?.name ?? null,
      courierPhone: c?.phone ?? null,
      tenantId: o.tenantId,
      tenantName: t?.name ?? null,
      manualStoreName: o.manualStoreName ?? null,
      storeDisplayName: t?.name ?? o.manualStoreName ?? 'Other',
      externalDestination: o.externalDestination ?? null,
      deliveryFee: o.total ?? 0,
      isExternal: true,
    };
  }));
}));

app.delete('/markets/:marketId/couriers/:courierId', async (req, res) => {
  const { marketId, courierId } = req.params;
  const cascade = String(req.query.cascade ?? '').toLowerCase();
  const shouldCascade = cascade === '1' || cascade === 'true' || cascade === 'yes';
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot delete couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const couriers = (await repos.couriers.findAll());
  const idx = couriers.findIndex((c) => c.id === courierId && courierMarketId(c) === marketId);
  if (idx === -1) {
    const other = couriers.find((c) => c.id === courierId);
    if (other && courierMarketId(other) && courierMarketId(other) !== marketId) {
      return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
    }
    return res.status(404).json({ error: 'Courier not found' });
  }
  const before = { ...couriers[idx] };
  if (shouldCascade) {
    await repos.orders.deleteByCourierId(courierId);
    await prisma.courierExpense.deleteMany({ where: { courierId } });
  } else {
    await repos.orders.unassignCourier(courierId);
  }
  const remaining = couriers.filter((_, i) => i !== idx);
  await repos.couriers.setAll(remaining);
  // Remove linked courier-auth users to prevent stale logins to deleted courier accounts.
  const users = await repos.users.findAll();
  const nextUsers = users.filter((u) => u.courierId !== courierId);
  if (nextUsers.length !== users.length) await repos.users.setAll(nextUsers);
  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'delete',
    entity: 'courier',
    entityId: courierId,
    reason: isPlatformAdmin(user!.role)
      ? getEmergencyReason(req)
      : shouldCascade
      ? 'driver deleted with cascade wipe (orders + expenses)'
      : 'driver deleted and unassigned from orders',
    emergencyMode: isPlatformAdmin(user!.role),
    before,
    after: null,
  });
  res.json({ ...sanitizeCourier(before), cascade: shouldCascade });
});

/** Courier financial stats view: app revenue, external revenue, expenses, net. */
app.get('/markets/:marketId/couriers/:courierId/stats', wrapAsync(async (req, res) => {
  const { marketId, courierId } = req.params;
  const from = String(req.query.from ?? '').trim();
  const to = String(req.query.to ?? '').trim();
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) return res.status(403).json({ error: 'Forbidden' });
  const courier = (await repos.couriers.findAll()).find((c) => c.id === courierId && courierMarketId(c) === marketId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });

  const allOrders = (await repos.orders.findAll()) as { courierId?: string; marketId?: string; createdAt?: string; total?: number; isExternal?: boolean }[];
  const inRange = (dt?: string) => {
    if (!dt) return false;
    if (from && dt < from) return false;
    if (to && dt > `${to}T23:59:59.999Z`) return false;
    return true;
  };
  const orders = allOrders.filter((o) => o.courierId === courierId && (o.marketId === marketId || !o.marketId) && inRange(o.createdAt));
  let appRevenue = 0;
  let externalRevenue = 0;
  for (const o of orders) {
    const amount = Number(o.total) || 0;
    if (o.isExternal) externalRevenue += amount;
    else appRevenue += amount;
  }
  const expenses = await prisma.courierExpense.findMany({
    where: {
      courierId,
      marketId,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: `${to}T23:59:59.999Z` } : {}),
            },
          }
        : {}),
    },
    select: { amount: true },
  });
  const expensesTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const net = appRevenue + externalRevenue - expensesTotal;
  res.json({
    courierId,
    marketId,
    from: from || null,
    to: to || null,
    appRevenue,
    externalRevenue,
    expenses: expensesTotal,
    net,
  });
}));

// --- Tenant couriers ---
app.get('/tenants/:tenantId/couriers', async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const couriers = (await repos.couriers.findAll()).filter((c) => c.scopeType === 'TENANT' && c.scopeId === tenantId);
  res.json(couriers.map((c) => sanitizeCourier(c)));
});

app.post('/tenants/:tenantId/couriers', async (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { name?: string; phone?: string };
  const id = `courier-${crypto.randomUUID?.() ?? Date.now()}`;
  const courier: Courier = {
    id,
    scopeType: 'TENANT',
    scopeId: tenantId,
    name: body.name ?? '',
    phone: body.phone,
    isActive: true,
    isOnline: false,
    capacity: 3,
  };
  const couriers = (await repos.couriers.findAll());
  couriers.push(courier);
  await repos.couriers.setAll(couriers);
  res.status(201).json(sanitizeCourier(courier));
});

app.patch('/tenants/:tenantId/couriers/:courierId', async (req, res) => {
  const { tenantId, courierId } = req.params;
  const user = req.user;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (user?.role === 'TENANT_ADMIN' && user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== tenant.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const couriers = (await repos.couriers.findAll());
  const idx = couriers.findIndex((c) => c.id === courierId && c.scopeType === 'TENANT' && c.scopeId === tenantId);
  if (idx === -1) return res.status(404).json({ error: 'Courier not found' });
  const body = req.body as Partial<Pick<Courier, 'name' | 'phone' | 'isActive' | 'isOnline' | 'capacity'>>;
  couriers[idx] = { ...couriers[idx], ...body };
  await repos.couriers.setAll(couriers);
  res.json(sanitizeCourier(couriers[idx]));
});

/** Market orders: all orders from tenants in this market. Requires MARKET_ADMIN or ROOT_ADMIN. */
app.get('/markets/:marketId/orders', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const orders = onlyRealCustomerOrders(
    (await repos.orders.findAll()) as { id?: string; tenantId?: string }[]
  )
    .filter((o) => o.tenantId && tenantIds.has(o.tenantId))
    .filter((o) =>
      req.user?.role === 'MARKET_ADMIN' ? isOrderVisibleToMerchant(o as OrderRecord) : true
    );
  orders.forEach(enrichOrderWithMerchantAmount);
  const couriers = (await repos.couriers.findAll()) as { id?: string; name?: string; phone?: string }[];
  for (const o of orders) {
    await enrichOrderWithCourierInfo(o as Record<string, unknown>, couriers);
  }
  await enrichOrdersWithCustomerTrust(prisma, orders as Array<Record<string, unknown>>);
  res.json(orders);
}));

type OrderWithPayment = {
  id?: string;
  tenantId?: string;
  courierId?: string;
  status?: string;
  fulfillmentType?: string;
  deliveryStatus?: string;
  createdAt?: string;
  total?: number;
  subtotal?: number;
  items?: { totalPrice?: number }[];
  delivery?: { fee?: number };
  payment?: {
    method?: string;
    status?: string;
    breakdown?: {
      itemsTotal?: number;
      deliveryFee?: number;
      discountAmount?: number;
      platformFee?: number;
      platformFeeBase?: number;
      customerTotal?: number;
    };
    financials?: {
      gross?: number;
      commission?: number;
      platformFee?: number;
      netToMerchant?: number;
      netToMarket?: number;
      merchantPayout?: number;
      customerTotal?: number;
    };
    platformFeeConfigSnapshot?: { source?: string };
    cashLedger?: { collected?: boolean };
  };
  platformFee?: number;
  merchantPayout?: number;
  paymentMethod?: string;
};

function ordersInDateRange(orders: OrderWithPayment[], from?: string, to?: string): OrderWithPayment[] {
  if (!from && !to) return orders;
  const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
  const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
  return orders.filter((o) => {
    const t = o.createdAt ? new Date(o.createdAt).getTime() : 0;
    return t >= fromMs && t <= toMs;
  });
}

/** Ensure order has merchantAmount and platformDeliveryFee (for API responses). Mutates order in place. */
function enrichOrderWithMerchantAmount(o: OrderWithPayment | Record<string, unknown>): void {
  if (o == null) return;
  const rec = o as Record<string, unknown>;
  if (rec.merchantAmount != null && rec.platformDeliveryFee != null) return;
  const f = computeOrderFinancials(o as OrderWithPayment);
  if (rec.merchantAmount == null) rec.merchantAmount = f.itemsTotal;
  if (rec.platformDeliveryFee == null) rec.platformDeliveryFee = f.deliveryFee;
}

/** Enrich order with assignedDriver { name, phone } when courierId is set. Mutates order in place. */
async function enrichOrderWithCourierInfo(
  o: Record<string, unknown>,
  couriers: { id?: string; name?: string; phone?: string }[]
): Promise<void> {
  if (o == null) return;
  const courierId = o.courierId as string | undefined;
  if (!courierId) return;
  const courier = couriers.find((c) => c.id === courierId);
  if (courier) o.assignedDriver = { name: courier.name ?? 'سائق', phone: courier.phone };
}

/** Safely compute financial values from order. Handles legacy orders missing payment fields. Never throws. */
function computeOrderFinancials(o: OrderWithPayment | null | undefined): {
  gross: number;
  itemsTotal: number;
  deliveryFee: number;
  commission: number;
  platformFee: number;
  netToMerchant: number;
  isCash: boolean;
  isCashCollected: boolean;
} {
  if (!o) {
    return { gross: 0, itemsTotal: 0, deliveryFee: 0, commission: 0, platformFee: 0, netToMerchant: 0, isCash: true, isCashCollected: false };
  }
  const pay = o.payment;
  const rec = o as Record<string, unknown>;
  const safeNum = (v: unknown): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
  const items = Array.isArray(rec?.items) ? rec.items as { totalPrice?: number }[] : [];
  const itemsSum = items.reduce((s: number, i: { totalPrice?: number }) => s + safeNum(i?.totalPrice), 0);
  const subtotal = safeNum(o?.subtotal) || itemsSum;
  const total = safeNum(o?.total) || (subtotal + safeNum(o?.delivery?.fee));
  const deliveryFee = safeNum(pay?.breakdown?.deliveryFee) || safeNum(o?.delivery?.fee);

  const gross = safeNum(pay?.financials?.customerTotal) || safeNum(pay?.financials?.gross) || safeNum(rec.customerTotal) || total;
  const itemsTotal = safeNum(pay?.breakdown?.itemsTotal) || subtotal;
  const platformFee =
    safeNum(pay?.financials?.platformFee) ||
    safeNum(pay?.breakdown?.platformFee) ||
    safeNum(rec.platformFee) ||
    0;
  const commission = platformFee > 0 ? platformFee : safeNum(pay?.financials?.commission);
  const netToMerchant =
    safeNum(pay?.financials?.netToMerchant) ||
    safeNum(pay?.financials?.merchantPayout) ||
    safeNum(rec.merchantPayout) ||
    safeNum(rec.merchantAmount) ||
    0;

  const method = pay?.method ?? o?.paymentMethod;
  const isCash = method === 'CASH' || method === undefined || method === null;
  const isCashCollected = Boolean(pay?.cashLedger?.collected);

  return { gross, itemsTotal, deliveryFee, commission, platformFee, netToMerchant, isCash, isCashCollected };
}

/** Market finance summary. MARKET_ADMIN: own market; ROOT_ADMIN: read-only. */
app.get('/markets/:marketId/finance/summary', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);

  let gross = 0;
  let itemsTotal = 0;
  let deliveryFees = 0;
  let commission = 0;
  let netToMerchants = 0;
  let cashCollected = 0;
  let outstandingCash = 0;
  let totalOrders = orders.length;
  let deliveredOrders = 0;
  let activeDeliveryOrders = 0;
  let cashOrders = 0;

  for (const o of orders) {
    const f = computeOrderFinancials(o);
    if (f.isCash) cashOrders++;
    const isDelivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';
    if (isDelivered) deliveredOrders++;
    const isActiveDelivery = o.fulfillmentType === 'DELIVERY' && !['DELIVERED', 'COMPLETED', 'CANCELED'].includes(o.status ?? '');
    if (isActiveDelivery) activeDeliveryOrders++;

    gross += f.gross;
    itemsTotal += f.itemsTotal;
    deliveryFees += f.deliveryFee;
    commission += f.commission;
    netToMerchants += f.netToMerchant;
    if (f.isCash) {
      if (f.isCashCollected) cashCollected += f.gross;
      else if (isDelivered) outstandingCash += f.gross;
    }
  }

  res.json({
    gross,
    itemsTotal,
    deliveryFees,
    commission,
    netToMerchants,
    cashCollected,
    outstandingCash,
    totalOrders,
    deliveredOrders,
    activeDeliveryOrders,
    cashOrders,
  });
}));

/** Tenant dashboard stats: revenue and breakdown from completed orders. TENANT_ADMIN own only; MARKET/ROOT read as for orders. */
app.get('/tenants/:tenantId/dashboard-stats', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId) as { id: string; marketId?: string; financialConfig?: { commissionType?: string; commissionValue?: number } } | undefined;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user?.role === 'TENANT_ADMIN' && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'MARKET_ADMIN' && tenant.marketId !== req.user.marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const allOrders = (await repos.orders.findAll()) as OrderWithPayment[];
  const tenantOrders = allOrders.filter((o) => o.tenantId === tenantId);
  const completed = tenantOrders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED');
  const nonCancelled = tenantOrders.filter((o) => o.status !== 'CANCELLED');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const todayEnd = todayStart;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const ordersToday = ordersInDateRange(completed, todayStart, todayEnd);
  const ordersThisMonth = ordersInDateRange(completed, monthStart, monthEnd);

  const commissionPercent = tenant?.financialConfig?.commissionValue ?? 0;

  function applyCommissionFallback(
    f: { gross: number; commission: number; netToMerchant: number },
    percent: number
  ): { commission: number; netToMerchant: number } {
    if (f.commission > 0 || f.netToMerchant > 0) return { commission: f.commission, netToMerchant: f.netToMerchant };
    if (f.gross <= 0) return { commission: 0, netToMerchant: 0 };
    const commission = Math.round(f.gross * (percent / 100) * 100) / 100;
    const netToMerchant = Math.round((f.gross - commission) * 100) / 100;
    return { commission, netToMerchant };
  }

  let dailyRevenue = 0;
  let monthlyRevenue = 0;
  let dailyCommission = 0;
  let monthlyCommission = 0;
  let dailyNet = 0;
  let monthlyNet = 0;
  for (const o of ordersToday) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    dailyRevenue += f.itemsTotal;
    dailyCommission += commissionOnItems;
    dailyNet += f.itemsTotal - commissionOnItems;
  }
  for (const o of ordersThisMonth) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    monthlyRevenue += f.itemsTotal;
    monthlyCommission += commissionOnItems;
    monthlyNet += f.itemsTotal - commissionOnItems;
  }

  let totalSales = 0;
  let totalPlatformFee = 0;
  let totalMerchantBalance = 0;
  for (const o of nonCancelled) {
    const f = computeOrderFinancials(o);
    const commissionOnItems = Math.round(f.itemsTotal * (commissionPercent / 100) * 100) / 100;
    totalSales += f.itemsTotal;
    totalPlatformFee += commissionOnItems;
    totalMerchantBalance += f.itemsTotal - commissionOnItems;
  }

  res.json({
    dailyRevenue,
    monthlyRevenue,
    orderCountToday: ordersToday.length,
    orderCountMonth: ordersThisMonth.length,
    totalSales: totalSales,
    platformFee: totalPlatformFee,
    merchantBalance: totalMerchantBalance,
    platformCommissionPercent: commissionPercent,
  });
}));

function settlementDateRange(req: express.Request): { from: string; to: string } {
  const preset = String(req.query.preset ?? '').toLowerCase();
  if (preset === 'today' || preset === 'week' || preset === 'month') {
    return dateRangePreset(preset);
  }
  const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
  const to = (req.query.to as string) || from;
  return { from, to };
}

function canAccessTenantSettlement(req: express.Request, tenantId: string, tenantMarketId?: string): boolean {
  if (!req.user) return false;
  if (req.user.role === 'ROOT_ADMIN' || req.user.role === 'SUPER_ADMIN') return true;
  if (req.user.role === 'TENANT_ADMIN' && req.user.tenantId === tenantId) return true;
  if (req.user.role === 'MARKET_ADMIN' && req.user.marketId && tenantMarketId === req.user.marketId) return true;
  return false;
}

/** Merchant + Super Admin: store settlement summary for date range. */
app.get('/tenants/:tenantId/settlement/summary', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (!canAccessTenantSettlement(req, tenantId, tenant.marketId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { from, to } = settlementDateRange(req);
  const allOrders = (await repos.orders.findAll()) as Record<string, unknown>[];
  const report = await computeSettlementReport(tenantId, from, to, allOrders);
  const isMerchant = req.user?.role === 'TENANT_ADMIN';
  if (isMerchant) {
    return res.json({
      period: report.period,
      pickupCommissionOwed: report.pickupCommissionOwedByStore,
      paymentsMade: report.storePaymentsToPlatform,
      remainingBalance: report.remainingStoreBalance,
      currency: 'ILS',
    });
  }
  res.json(report);
}));

/** Settlement ledger entries for a store. */
app.get('/tenants/:tenantId/settlement/ledger', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (!canAccessTenantSettlement(req, tenantId, tenant.marketId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { from, to } = settlementDateRange(req);
  const entries = await prisma.storeSettlementLedgerEntry.findMany({
    where: {
      tenantId,
      occurredAt: { gte: from, lte: `${to}T23:59:59.999Z` },
    },
    orderBy: { occurredAt: 'desc' },
  });
  const isMerchant = req.user?.role === 'TENANT_ADMIN';
  const filtered = isMerchant
    ? entries.filter((e) =>
        ['PICKUP_COMMISSION_DEBIT', 'STORE_PAYMENT_CREDIT', 'ADJUSTMENT'].includes(e.entryType)
      )
    : entries;
  res.json(filtered);
}));

/** Manual settlement payments list. */
app.get('/tenants/:tenantId/settlement/payments', wrapAsync(async (req, res) => {
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (!canAccessTenantSettlement(req, tenantId, tenant.marketId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user?.role === 'TENANT_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: manual settlement payments are platform-only' });
  }
  const { from, to } = settlementDateRange(req);
  const payments = await prisma.storeSettlementPayment.findMany({
    where: {
      tenantId,
      paidAt: { gte: from, lte: `${to}T23:59:59.999Z` },
    },
    orderBy: { paidAt: 'desc' },
  });
  res.json(payments);
}));

/** Super Admin: record manual store ↔ platform payment. */
app.post('/admin/settlement/stores/:tenantId/payments', wrapAsync(async (req, res) => {
  if (req.user?.role !== 'ROOT_ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  const body = req.body as {
    amount?: number;
    paidAt?: string;
    paymentMethod?: string;
    note?: string;
    direction?: string;
    periodFrom?: string;
    periodTo?: string;
  };
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount required' });
  }
  const direction =
    body.direction === 'PLATFORM_TO_STORE' ? 'PLATFORM_TO_STORE' : 'STORE_TO_PLATFORM';
  const result = await recordManualSettlementPayment({
    tenantId,
    amount,
    paidAt: body.paidAt || new Date().toISOString().slice(0, 10),
    paymentMethod: body.paymentMethod || 'CASH',
    note: body.note,
    createdBy: req.user?.id,
    direction,
    periodFrom: body.periodFrom,
    periodTo: body.periodTo,
  });
  res.status(201).json(result);
}));

/** Market finance by tenant. MARKET_ADMIN: own market; ROOT_ADMIN: read-only. */
app.get('/markets/:marketId/finance/tenants', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const tenants = (await repos.tenants.findAll());

  const byTenant = new Map<string, { gross: number; itemsTotal: number; deliveryFees: number; commission: number; netToMerchant: number; orderCount: number; deliveredCount: number }>();

  for (const o of orders) {
    const tid = o.tenantId ?? '';
    if (!tid) continue;
    let row = byTenant.get(tid);
    if (!row) {
      row = { gross: 0, itemsTotal: 0, deliveryFees: 0, commission: 0, netToMerchant: 0, orderCount: 0, deliveredCount: 0 };
      byTenant.set(tid, row);
    }
    row.orderCount++;
    const isDelivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';
    if (isDelivered) row.deliveredCount++;

    const f = computeOrderFinancials(o);
    row.gross += f.gross;
    row.itemsTotal += f.itemsTotal;
    row.deliveryFees += f.deliveryFee;
    row.commission += f.commission;
    row.netToMerchant += f.netToMerchant;
  }

  const result = Array.from(byTenant.entries()).map(([tenantId, row]) => {
    const t = tenants.find((x) => x.id === tenantId);
    return {
      tenantId,
      tenantName: t?.name ?? tenantId,
      ...row,
    };
  });
  res.json(result);
}));

/** Market finance by courier. deliveredCount, cashCollectedGross, outstandingGross. MARKET_ADMIN: own market; ROOT_ADMIN: read-only. */
app.get('/markets/:marketId/finance/couriers', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId) && o.courierId
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);

  const ACTIVE_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'PICKED_UP']);
  type CourierFinanceRow = {
    deliveredCount: number;
    cashCollectedGross: number;
    outstandingGross: number;
    activeUncollectedGross: number;
    deliveryFeesTotal: number;
    platformCommissionTotal: number;
    driverCollectionTotal: number;
    outstandingCollection: number;
    externalOrders: number;
    appOrders: number;
  };
  const byCourier = new Map<string, CourierFinanceRow>();
  for (const o of orders) {
    const cid = o.courierId ?? '';
    if (!cid) continue;
    let row = byCourier.get(cid);
    if (!row) {
      row = {
        deliveredCount: 0,
        cashCollectedGross: 0,
        outstandingGross: 0,
        activeUncollectedGross: 0,
        deliveryFeesTotal: 0,
        platformCommissionTotal: 0,
        driverCollectionTotal: 0,
        outstandingCollection: 0,
        externalOrders: 0,
        appOrders: 0,
      };
      byCourier.set(cid, row);
    }
    const f = computeOrderFinancials(o);
    const isDelivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';
    const deliveryStatus = o.deliveryStatus ?? '';
    if (isDelivered) row.deliveredCount++;
    if (f.isCash) {
      if (f.isCashCollected) row.cashCollectedGross += f.gross;
      else if (isDelivered) row.outstandingGross += f.gross;
      else if (ACTIVE_STATUSES.has(deliveryStatus)) row.activeUncollectedGross += f.gross;
    }
    // V2: Now Market collection (delivery + platform commission) — not restaurant total.
    if (isDriverCollectionCountable(o as Record<string, unknown>)) {
      const col = enrichOrderWithDriverCollection(o as Record<string, unknown>);
      row.deliveryFeesTotal += col.deliveryFee;
      row.platformCommissionTotal += col.platformCommission;
      row.driverCollectionTotal += col.driverCollectionAmount;
      if (col.settlementStatus === 'PENDING') {
        row.outstandingCollection += col.driverCollectionAmount;
      }
      if (col.isExternal) row.externalOrders += 1;
      else row.appOrders += 1;
    }
  }

  const result = couriers.map((c) => {
    const row = (byCourier.get(c.id) ?? {
      deliveredCount: 0,
      cashCollectedGross: 0,
      outstandingGross: 0,
      activeUncollectedGross: 0,
      deliveryFeesTotal: 0,
      platformCommissionTotal: 0,
      driverCollectionTotal: 0,
      outstandingCollection: 0,
      externalOrders: 0,
      appOrders: 0,
    }) as CourierFinanceRow;
    return {
      courierId: c.id,
      courierName: c.name ?? c.id,
      ...row,
      deliveryFeesTotal: Math.round(row.deliveryFeesTotal * 100) / 100,
      platformCommissionTotal: Math.round(row.platformCommissionTotal * 100) / 100,
      driverCollectionTotal: Math.round(row.driverCollectionTotal * 100) / 100,
      outstandingCollection: Math.round(row.outstandingCollection * 100) / 100,
    };
  });
  res.json(result);
}));

// --- Reports & driver settlement ---

/** Daily summary: total orders (delivery vs pickup), total revenue, daily cash flow. */
app.get('/markets/:marketId/reports/daily-summary', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) return res.status(403).json({ error: 'Forbidden' });
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);

  let totalOrders = orders.length;
  let deliveryOrders = 0;
  let pickupOrders = 0;
  let totalRevenue = 0;
  let totalMerchantSales = 0;
  let totalDeliveryFees = 0;
  let dailyCashFlow = 0;

  for (const o of orders) {
    const f = computeOrderFinancials(o);
    if ((o.fulfillmentType ?? '') === 'DELIVERY') deliveryOrders++;
    else pickupOrders++;
    totalRevenue += f.gross;
    totalMerchantSales += f.itemsTotal;
    totalDeliveryFees += f.deliveryFee;
    if (f.isCash) dailyCashFlow += f.gross;
  }

  res.json({
    totalOrders,
    deliveryOrders,
    pickupOrders,
    totalRevenue,
    totalMerchantSales,
    totalDeliveryFees,
    dailyCashFlow,
  });
}));

/** Merchant performance: each store's orders and sales (product price only; delivery fee tracked separately). */
app.get('/markets/:marketId/reports/merchant-performance', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) return res.status(403).json({ error: 'Forbidden' });
  const tenantIds = await getMarketTenantIds(marketId);
  const tenants = (await repos.tenants.findAll()).filter((t) => tenantIds.has(t.id));
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId)
  );
  const orders = ordersInDateRange(allOrders, from, to);

  const byTenant = new Map<string, { orderCount: number; sales: number; deliveryFees: number }>();
  for (const t of tenants) {
    byTenant.set(t.id, { orderCount: 0, sales: 0, deliveryFees: 0 });
  }
  for (const o of orders) {
    const f = computeOrderFinancials(o);
    const row = byTenant.get(o.tenantId ?? '');
    if (row) {
      row.orderCount++;
      row.sales += f.itemsTotal;
      row.deliveryFees += f.deliveryFee;
    }
  }

  const result = tenants.map((t) => {
    const row = byTenant.get(t.id) ?? { orderCount: 0, sales: 0, deliveryFees: 0 };
    return {
      tenantId: t.id,
      tenantName: t.name ?? t.id,
      ...row,
    };
  });
  res.json(result);
}));

/** Driver leaderboard: ranked by delivery count (for the market). */
app.get('/markets/:marketId/reports/driver-leaderboard', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) return res.status(403).json({ error: 'Forbidden' });
  const tenantIds = await getMarketTenantIds(marketId);
  const allOrders = ((await repos.orders.findAll()) as OrderWithPayment[]).filter(
    (o) => o.tenantId && tenantIds.has(o.tenantId) && o.fulfillmentType === 'DELIVERY' && (o.status === 'DELIVERED' || o.status === 'COMPLETED')
  );
  const orders = ordersInDateRange(allOrders, from, to);
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);

  const deliveryCountByCourier = new Map<string, number>();
  const totalCashCollectedByCourier = new Map<string, number>();
  for (const o of orders) {
    const cid = o.courierId ?? '';
    if (cid) {
      deliveryCountByCourier.set(cid, (deliveryCountByCourier.get(cid) ?? 0) + 1);
      const f = computeOrderFinancials(o);
      if (f.isCash) {
        totalCashCollectedByCourier.set(cid, (totalCashCollectedByCourier.get(cid) ?? 0) + f.gross);
      }
    }
  }

  const rows = couriers.map((c) => ({
    courierId: c.id,
    courierName: c.name ?? c.id,
    phone: c.phone,
    deliveryCount: deliveryCountByCourier.get(c.id) ?? 0,
    initialFloat: c.initialFloat ?? 300,
    totalCashCollected: totalCashCollectedByCourier.get(c.id) ?? 0,
  }));
  rows.sort((a, b) => b.deliveryCount - a.deliveryCount);
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  res.json(ranked);
}));

/** Settlement log: history of driver shift settlements for the market. */
app.get('/markets/:marketId/reports/settlement-log', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) return res.status(403).json({ error: 'Forbidden' });
  const couriers = (await repos.couriers.findAll()).filter((c) => courierMarketId(c) === marketId);
  const courierIds = new Set(couriers.map((c) => c.id));
  const allLogs = getSettlementLogs();
  const marketLogs = allLogs.filter(
    (e) => e.courierId && courierIds.has(e.courierId) && (e.marketId === marketId || !e.marketId)
  );
  marketLogs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const withNames = marketLogs.map((e) => {
    const c = couriers.find((x) => x.id === e.courierId);
    return { ...e, courierName: c?.name ?? e.courierId };
  });
  res.json(withNames);
}));

/** Shift settlement: admin logs driver handover (Coba). Platform admin or market admin for that courier's market. */
app.post('/admin/couriers/:id/settle', wrapAsync(async (req, res) => {
  const courierId = req.params.id;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role !== 'MARKET_ADMIN' && !isPlatformAdmin(user.role)) return res.status(403).json({ error: 'Forbidden' });

  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  const cMarketId = courierMarketId(courier);
  if (user.role === 'MARKET_ADMIN' && user.marketId !== cMarketId) return res.status(403).json({ error: 'Forbidden' });

  const body = req.body as { totalCollected?: number };
  const totalCollected = typeof body.totalCollected === 'number' ? body.totalCollected : 0;

  const entry: SettlementLogEntry = {
    id: `settle-${Date.now()}-${courierId}`,
    courierId,
    adminId: user.id,
    totalCollected,
    timestamp: new Date().toISOString(),
    marketId: cMarketId,
  };
  appendSettlementLog(entry);

  res.status(201).json(entry);
}));

// --- Driver Collections V2 (platform cash: deliveryFee + platformCommission) ---

function parseCollectionDatePreset(preset: string | undefined): { from?: string; to?: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'yesterday') {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    const y = d.toISOString().slice(0, 10);
    return { from: y, to: y };
  }
  return {};
}

/** Dashboard cards — never restaurant revenue. Empty dataset → zeros, not error. */
app.get('/admin/driver-collections/dashboard', wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
    res.json(computeCollectionsDashboard(orders ?? [], today));
  } catch (e) {
    console.error('[driver-collections/dashboard]', e);
    const today = new Date().toISOString().slice(0, 10);
    res.json(computeCollectionsDashboard([], today));
  }
}));

/** Settlement history (append-only). Empty → []. */
app.get('/admin/driver-collections/settlements', wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  try {
    const courierId = req.query.courierId ? String(req.query.courierId) : undefined;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const rows = await listCollectionSettlements({ courierId, from, to });
    const couriers = await repos.couriers.findAll();
    const byId = new Map(couriers.map((c) => [c.id, c]));
    res.json(
      (rows ?? []).map((r) => ({
        ...r,
        courierName: byId.get(r.courierId)?.name ?? r.courierId,
      }))
    );
  } catch (e) {
    console.error('[driver-collections/settlements]', e);
    res.json([]);
  }
}));

/** Per-driver summaries for Super Admin driver accounting. Empty → zeros + []. */
app.get('/admin/driver-collections', wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const today = new Date().toISOString().slice(0, 10);
  try {
    const preset = req.query.preset ? String(req.query.preset) : undefined;
    const presetRange = parseCollectionDatePreset(preset);
    const from = req.query.from ? String(req.query.from) : presetRange.from;
    const to = req.query.to ? String(req.query.to) : presetRange.to;
    const courierId = req.query.courierId ? String(req.query.courierId) : undefined;
    const marketId = req.query.marketId ? String(req.query.marketId) : undefined;
    const settlementStatus = (req.query.settlementStatus
      ? String(req.query.settlementStatus).toUpperCase()
      : 'ALL') as 'PENDING' | 'SETTLED' | 'ALL';
    const currentShift = req.query.currentShift === '1' || req.query.currentShift === 'true';

    const couriers = (await repos.couriers.findAll()).map((c) => ({
      id: c.id,
      name: c.name,
      marketId: courierMarketId(c),
    }));
    const courierIds = couriers.map((c) => c.id);
    const shiftStarts = await listActiveShiftStarts(courierIds);
    const orders = (await repos.orders.findAll()) as Record<string, unknown>[];

    const filters = {
      from,
      to,
      courierId,
      marketId,
      settlementStatus,
      shiftStart: undefined as string | undefined,
    };

    // When currentShift filter: restrict each courier to their active shift window.
    let summaries = aggregateDriverCollections(orders ?? [], couriers ?? [], {
      filters: { ...filters, settlementStatus: 'ALL' },
      today,
      shiftStartByCourier: shiftStarts,
    });

    if (currentShift) {
      summaries = summaries.map((s) => ({
        ...s,
        // Surface shift collection as the primary total when filtering current shift
        driverCollectionTotal: s.currentShiftCollection,
        deliveryFeesTotal: s.deliveryFeesTotal, // already filtered by date; shift shown separately
      }));
    }

    if (settlementStatus === 'PENDING') {
      summaries = summaries.filter((s) => s.outstandingCollection > 0 || s.pendingOrders > 0);
    } else if (settlementStatus === 'SETTLED') {
      summaries = summaries.filter((s) => s.settledOrders > 0);
    }

    res.json({
      today,
      settlementMode: getDriverSettlementMode(),
      filters: { from, to, courierId, marketId, settlementStatus, currentShift },
      drivers: summaries ?? [],
      dashboard: computeCollectionsDashboard(orders ?? [], today),
    });
  } catch (e) {
    console.error('[driver-collections]', e);
    res.json({
      today,
      settlementMode: getDriverSettlementMode(),
      filters: {},
      drivers: [],
      dashboard: computeCollectionsDashboard([], today),
    });
  }
}));

/** Driver detail + order list (Driver Collection column, not Order Total). */
app.get('/admin/driver-collections/:courierId', wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const courierId = req.params.courierId;
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });

  const preset = req.query.preset ? String(req.query.preset) : undefined;
  const presetRange = parseCollectionDatePreset(preset);
  const from = req.query.from ? String(req.query.from) : presetRange.from;
  const to = req.query.to ? String(req.query.to) : presetRange.to;
  const settlementStatus = (req.query.settlementStatus
    ? String(req.query.settlementStatus).toUpperCase()
    : 'ALL') as 'PENDING' | 'SETTLED' | 'ALL';

  const shiftStarts = await listActiveShiftStarts([courierId]);
  const orders = ((await repos.orders.findAll()) as Record<string, unknown>[]).filter(
    (o) => String(o.courierId) === courierId && isDriverCollectionCountable(o)
  );
  const filtered = orders.filter((o) =>
    orderMatchesCollectionFilters(o, { from, to, courierId, settlementStatus })
  );
  const orderRows = filtered
    .map((o) => enrichOrderWithDriverCollection(o))
    .sort((a, b) => (b.deliveredAt || b.createdAt || '').localeCompare(a.deliveredAt || a.createdAt || ''));

  const today = new Date().toISOString().slice(0, 10);
  const [summary] = aggregateDriverCollections(
    orders,
    [{ id: courier.id, name: courier.name, marketId: courierMarketId(courier) }],
    {
      filters: { from, to, courierId, settlementStatus: 'ALL' },
      today,
      shiftStartByCourier: shiftStarts,
    }
  );

  const settlements = await listCollectionSettlements({ courierId, from, to });
  const activeShiftStart = shiftStarts.get(courierId);

  res.json({
    courier: {
      id: courier.id,
      name: courier.name,
      marketId: courierMarketId(courier),
    },
    summary: summary ?? null,
    activeShiftStart: activeShiftStart ?? null,
    orders: orderRows,
    settlements,
  });
}));

/** Settle pending driver collections for a courier (append-only history). */
app.post('/admin/driver-collections/:courierId/settle', wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const courierId = req.params.courierId;
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });

  const body = (req.body ?? {}) as {
    orderIds?: string[];
    settlementReference?: string;
    settlementNotes?: string;
    shiftLabel?: string;
    from?: string;
    to?: string;
    settlementMode?: 'PLATFORM_ONLY' | 'FULL_CASH';
    settledAmount?: number;
  };

  const settlementMode =
    body.settlementMode === 'FULL_CASH' || body.settlementMode === 'PLATFORM_ONLY'
      ? body.settlementMode
      : getDriverSettlementMode();

  let orders = ((await repos.orders.findAll()) as Record<string, unknown>[]).filter(
    (o) => String(o.courierId) === courierId && isDriverCollectionCountable(o)
  );
  if (body.from || body.to) {
    orders = orders.filter((o) =>
      orderMatchesCollectionFilters(o, {
        courierId,
        from: body.from,
        to: body.to,
        settlementStatus: 'PENDING',
      })
    );
  } else {
    orders = orders.filter(
      (o) => enrichOrderWithDriverCollection(o).settlementStatus === 'PENDING'
    );
  }
  if (Array.isArray(body.orderIds) && body.orderIds.length > 0) {
    const allow = new Set(body.orderIds.map(String));
    orders = orders.filter((o) => allow.has(String(o.id)));
  }

  try {
    const { settlement, updatedOrders } = await createDriverCollectionSettlement({
      courierId,
      marketId: courierMarketId(courier),
      orders,
      settledBy: user.id,
      settlementReference: body.settlementReference,
      settlementNotes: body.settlementNotes,
      shiftLabel: body.shiftLabel,
      settlementMode,
      settledAmount: body.settledAmount,
    });
    for (const o of updatedOrders) {
      await repos.orders.update(o as Parameters<typeof repos.orders.update>[0]);
    }
    res.status(201).json({
      settlement,
      courierName: courier.name,
      amount: settlement.amount,
      ordersCount: settlement.ordersCount,
      settlementMode: settlement.settlementMode,
    });
  } catch (e) {
    const err = e as Error & { code?: string; expected?: number; got?: number };
    if (
      err.code === 'NO_PENDING_ORDERS' ||
      err.code === 'ANOMALY_BLOCKED' ||
      err.code === 'PARTIAL_NOT_SUPPORTED'
    ) {
      return res.status(400).json({
        error: err.message,
        code: err.code,
        expected: err.expected,
        got: err.got,
      });
    }
    throw e;
  }
}));

/** Super Admin: driver payroll finance rollup. */
app.get('/admin/driver-payroll', wrapAsync(async (req, res) => {
  const user = req.user;
  if (!user || !isPlatformAdmin(user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const period = String(req.query.period ?? 'week');
  const fromQ = req.query.from ? String(req.query.from) : undefined;
  const toQ = req.query.to ? String(req.query.to) : undefined;
  const marketId = req.query.marketId ? String(req.query.marketId) : undefined;
  const { from, to } = parseDateRange(period, fromQ, toQ);

  const couriers = (await repos.couriers.findAll()).filter((c) => !marketId || courierMarketId(c) === marketId);
  const courierIds = couriers.map((c) => c.id);
  const [rows, platformSummary] = await Promise.all([
    Promise.all(
      couriers.map(async (c) => {
        const [summary, config, outstandingBalance] = await Promise.all([
          computeEarningsSummary(c.id, from, to),
          getOrCreatePayrollConfig(c.id),
          computeOutstandingBalance(c.id),
        ]);
        return {
          courierId: c.id,
          name: c.name,
          marketId: courierMarketId(c),
          hourlyRate: config.hourlyRate,
          hoursWorked: summary.hoursWorked,
          deliveryEarnings: summary.deliveryEarnings,
          commissionEarnings: summary.commissionEarnings,
          bonuses: summary.bonuses,
          expenses: summary.expenses,
          hourlyPay: summary.hourlyPay,
          netTotal: summary.netEarnings,
          ordersCount: summary.ordersCount,
          outstandingBalance,
        };
      })
    ),
    computePlatformPayrollSummary(courierIds),
  ]);
  res.json({ from, to, platformSummary, drivers: rows });
}));

/** Super Admin: per-store Now Market profit report (commission + delivery fees). Empty → zeros + []. */
app.get('/admin/store-profit-report', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const period = String(req.query.period ?? 'week');
  const fromQ = req.query.from ? String(req.query.from) : undefined;
  const toQ = req.query.to ? String(req.query.to) : undefined;
  const marketId = req.query.marketId ? String(req.query.marketId) : undefined;
  const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
  const { from, to } = parseStoreProfitDateRange(period, fromQ, toQ);
  try {
    const [orders, tenants] = await Promise.all([
      repos.orders.findAll(),
      repos.tenants.findAll(),
    ]);
    const report = computeStoreProfitReport({
      orders: (orders ?? []) as Record<string, unknown>[],
      tenants: (tenants ?? []) as { id?: string; name?: string; marketId?: string }[],
      from,
      to,
      marketId,
      tenantId,
    });
    res.json(report);
  } catch (e) {
    console.error('[store-profit-report]', e);
    res.json(
      computeStoreProfitReport({
        orders: [],
        tenants: [],
        from,
        to,
        marketId,
        tenantId,
      })
    );
  }
}));

/** Super Admin: store profit breakdown by day/week/month for one tenant. */
app.get('/admin/store-profit-report/:tenantId/breakdown', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const { tenantId } = req.params;
  const tenant = (await repos.tenants.findAll()).find((t) => t.id === tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  const period = String(req.query.period ?? 'month');
  const fromQ = req.query.from ? String(req.query.from) : undefined;
  const toQ = req.query.to ? String(req.query.to) : undefined;
  const granularityRaw = String(req.query.granularity ?? 'day').toLowerCase();
  const granularity = granularityRaw === 'week' || granularityRaw === 'month' ? granularityRaw : 'day';
  const { from, to } = parseStoreProfitDateRange(period, fromQ, toQ);
  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  const breakdown = computeStoreProfitBreakdown({ orders, tenantId, from, to, granularity });
  res.json({
    tenantId,
    storeName: tenant.name ?? tenantId,
    from,
    to,
    granularity,
    breakdown,
  });
}));

function parseFinancialReportFilters(req: express.Request): FinancialReportFilters {
  const timezone = String(req.query.timezone || BUSINESS_TIMEZONE);
  const { from, to, preset } = parseFinancialReportRange(
    req.query.preset ? String(req.query.preset) : undefined,
    req.query.from ? String(req.query.from) : undefined,
    req.query.to ? String(req.query.to) : undefined,
    timezone
  );
  const orderSourceRaw = String(req.query.orderSource || 'ALL').toUpperCase();
  const orderSource =
    orderSourceRaw === 'APP' || orderSourceRaw === 'EXTERNAL' ? orderSourceRaw : 'ALL';
  const settlementRaw = String(req.query.settlementStatus || 'ALL').toUpperCase();
  const settlementStatus =
    settlementRaw === 'PENDING' || settlementRaw === 'SETTLED' ? settlementRaw : 'ALL';
  return {
    from,
    to,
    preset,
    timezone,
    shopId: req.query.shopId ? String(req.query.shopId) : undefined,
    courierId: req.query.courierId ? String(req.query.courierId) : undefined,
    deliveryAreaId: req.query.deliveryAreaId ? String(req.query.deliveryAreaId) : undefined,
    paymentMethod: req.query.paymentMethod ? String(req.query.paymentMethod) : undefined,
    orderSource,
    settlementStatus,
  };
}

/** Financial Reports V1 — summary + period comparison (platform admin only). */
app.get('/admin/financial-reports/summary', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  res.json(buildFinancialSummary({ orders: orders ?? [], filters }));
}));

app.get('/admin/financial-reports/timeseries', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  res.json({ period: filters, rows: computeTimeseries(orders ?? [], filters) });
}));

app.get('/admin/financial-reports/shops', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const [orders, tenants] = await Promise.all([repos.orders.findAll(), repos.tenants.findAll()]);
  res.json({
    period: filters,
    rows: computeShopReport(
      (orders ?? []) as Record<string, unknown>[],
      (tenants ?? []) as { id?: string; name?: string }[],
      filters
    ),
  });
}));

app.get('/admin/financial-reports/delivery-areas', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  res.json({
    period: filters,
    rows: computeAreaReport(orders ?? [], filters),
    note: 'منطقة الطلب من delivery.zoneName أو externalDestination — ليس defaultDeliveryTown للعميل.',
  });
}));

app.get('/admin/financial-reports/drivers', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const [orders, couriers] = await Promise.all([
    repos.orders.findAll(),
    repos.couriers.findAll(),
  ]);
  const courierList = (couriers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    marketId: (c as { marketId?: string }).marketId,
  }));
  const rows = aggregateDriverCollections(
    (orders ?? []) as Record<string, unknown>[],
    courierList,
    {
      filters: {
        from: filters.from,
        to: filters.to,
        courierId: filters.courierId,
        settlementStatus: filters.settlementStatus || 'ALL',
      },
      today: formatBusinessDay(new Date(), filters.timezone),
    }
  );
  res.json({ period: filters, rows });
}));

app.get('/admin/financial-reports/payment-methods', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  res.json({ period: filters, rows: computePaymentMethodReport(orders ?? [], filters) });
}));

app.get('/admin/financial-reports/order-sources', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  res.json({ period: filters, rows: computeOrderSourceReport(orders ?? [], filters) });
}));

app.get('/admin/financial-reports/refunds', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const summary = buildFinancialSummary({
    orders: (await repos.orders.findAll()) as Record<string, unknown>[],
    filters,
  });
  res.json({
    period: filters,
    cancelledOrderCount: summary.current.cancelledOrderCount,
    refundedOrderCount: summary.current.refundedOrderCount,
    refundedGross: summary.current.refundedGross,
    completedOrderCount: summary.current.completedOrderCount,
    cancellationRate:
      summary.current.completedOrderCount + summary.current.cancelledOrderCount > 0
        ? Math.round(
            (summary.current.cancelledOrderCount /
              (summary.current.completedOrderCount + summary.current.cancelledOrderCount)) *
              1000
          ) / 10
        : 0,
    limitation:
      'لا يوجد refundAmount منظم على الطلب؛ المبالغ المستردة معلوماتية من حالة REFUNDED فقط.',
  });
}));

app.get('/admin/financial-reports/anomalies', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const orders = (await repos.orders.findAll()) as Record<string, unknown>[];
  res.json({ period: filters, rows: detectFinancialAnomalies(orders ?? [], filters) });
}));

app.get('/admin/financial-reports/export', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const filters = parseFinancialReportFilters(req);
  const kind = String(req.query.kind || 'summary').toLowerCase();
  const [orders, tenants, couriers] = await Promise.all([
    repos.orders.findAll(),
    repos.tenants.findAll(),
    repos.couriers.findAll(),
  ]);
  const orderRows = (orders ?? []) as Record<string, unknown>[];
  const withMeta = (body: string) =>
    `\uFEFF# timezone=${filters.timezone}\n# from=${filters.from}\n# to=${filters.to}\n# kind=${kind}\n${body.replace(/^\uFEFF/, '')}`;

  let csv = '';

  if (kind === 'shops') {
    const rows = computeShopReport(
      orderRows,
      (tenants ?? []) as { id?: string; name?: string }[],
      filters
    );
    csv = toCsv(
      [
        'shopId',
        'shopName',
        'completedOrders',
        'cancelledOrders',
        'grossOrderValue',
        'restaurantPayable',
        'platformCommission',
        'deliveryFee',
        'platformRevenue',
        'avgOrderValue',
        'refundedGross',
      ],
      rows.map((r) => [
        r.shopId,
        r.shopName,
        r.completedOrderCount,
        r.cancelledOrderCount,
        r.grossOrderValue,
        r.restaurantPayable,
        r.platformCommission,
        r.deliveryFee,
        r.platformRevenue,
        r.averageOrderValue,
        r.refundedGross,
      ])
    );
  } else if (kind === 'delivery-areas') {
    const rows = computeAreaReport(orderRows, filters);
    csv = toCsv(
      [
        'areaName',
        'deliveredOrders',
        'cancelledOrders',
        'grossOrderValue',
        'deliveryFeeRevenue',
        'platformCommission',
        'platformRevenue',
      ],
      rows.map((r) => [
        r.areaName,
        r.deliveredOrders,
        r.cancelledOrders,
        r.grossOrderValue,
        r.deliveryFeeRevenue,
        r.platformCommission,
        r.platformRevenue,
      ])
    );
  } else if (kind === 'drivers') {
    const rows = aggregateDriverCollections(
      orderRows,
      (couriers ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        marketId: (c as { marketId?: string }).marketId,
      })),
      {
        filters: { from: filters.from, to: filters.to, courierId: filters.courierId },
        today: formatBusinessDay(new Date(), filters.timezone),
      }
    );
    csv = toCsv(
      [
        'courierId',
        'courierName',
        'completedOrders',
        'cashInHand',
        'platformLiability',
        'restaurantLiability',
        'totalLiability',
        'settled',
        'outstanding',
        'anomalies',
      ],
      rows.map((r) => [
        r.courierId,
        r.courierName,
        r.completedOrders,
        r.cashInHandTotal ?? 0,
        r.platformLiabilityTotal ?? r.driverCollectionTotal,
        r.restaurantLiabilityTotal ?? 0,
        r.totalDriverLiability ?? 0,
        r.settledCollection,
        r.outstandingCollection,
        r.anomalyCount ?? 0,
      ])
    );
  } else if (kind === 'payment-methods') {
    const rows = computePaymentMethodReport(orderRows, filters);
    csv = toCsv(
      [
        'paymentMethod',
        'orderCount',
        'grossOrderValue',
        'platformRevenue',
        'cashCollected',
        'refundedGross',
        'cancelled',
      ],
      rows.map((r) => [
        r.paymentMethod,
        r.orderCount,
        r.grossOrderValue,
        r.platformRevenue,
        r.cashCollectedByDrivers,
        r.refundedGross,
        r.cancelledCount,
      ])
    );
  } else if (kind === 'order-sources') {
    const rows = computeOrderSourceReport(orderRows, filters);
    csv = toCsv(
      [
        'source',
        'orderCount',
        'grossOrderValue',
        'deliveryFees',
        'commissions',
        'platformRevenue',
        'cancelled',
        'cancellationRate',
      ],
      rows.map((r) => [
        r.source,
        r.orderCount,
        r.grossOrderValue,
        r.deliveryFees,
        r.commissions,
        r.platformRevenue,
        r.cancelledCount,
        r.cancellationRate,
      ])
    );
  } else if (kind === 'anomalies') {
    const rows = detectFinancialAnomalies(orderRows, filters);
    csv = toCsv(
      ['anomalyCode', 'severity', 'entityType', 'entityId', 'message', 'detectedAt'],
      rows.map((r) => [r.anomalyCode, r.severity, r.entityType, r.entityId, r.message, r.detectedAt])
    );
  } else if (kind === 'refunds') {
    const summary = buildFinancialSummary({ orders: orderRows, filters });
    const c = summary.current;
    csv = toCsv(
      ['metric', 'value'],
      [
        ['cancelledOrderCount', c.cancelledOrderCount],
        ['refundedOrderCount', c.refundedOrderCount],
        ['refundedGross', c.refundedGross],
        ['completedOrderCount', c.completedOrderCount],
      ]
    );
  } else {
    const summary = buildFinancialSummary({ orders: orderRows, filters });
    const c = summary.current;
    csv = toCsv(
      ['metric', 'value', 'note'],
      [
        ['grossOrderValue', c.grossOrderValue, 'sales volume not platform revenue'],
        ['platformRevenue', c.platformRevenue, 'delivery+commission (app) or delivery (external)'],
        ['deliveryFeeRevenue', c.deliveryFeeRevenue, ''],
        ['platformCommissionRevenue', c.platformCommissionRevenue, ''],
        ['restaurantPayable', c.restaurantPayable, 'COD residual with drivers'],
        ['driverCashInHand', c.driverCashInHand, ''],
        ['driverPlatformLiability', c.driverPlatformLiability, ''],
        ['driverOutstandingAmount', c.driverOutstandingAmount, ''],
        ['refundedGross', c.refundedGross, 'informational'],
      ]
    );
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="financial-report-${kind}-${filters.from}-${filters.to}.csv"`
  );
  res.send(withMeta(csv));
}));

/** Super Admin: tenant driver commission overrides. */
app.get('/admin/tenants/:tenantId/driver-commission-override', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const overrides = await getTenantDriverCommissionOverrides(req.params.tenantId);
  res.json(overrides);
}));

app.put('/admin/tenants/:tenantId/driver-commission-override', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const body = req.body as { orderCommissionPercent?: number; courierId?: string };
  const pct = Number(body.orderCommissionPercent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'orderCommissionPercent must be 0–100' });
  }
  const row = await setTenantDriverCommissionOverride(
    req.params.tenantId,
    pct,
    body.courierId?.trim() || undefined
  );
  res.json(row);
}));

/** Super Admin: preview payroll settlement for a period. */
app.get('/admin/drivers/:courierId/payroll-settlement/preview', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const periodStart = String(req.query.periodStart ?? '');
  const periodEnd = String(req.query.periodEnd ?? '');
  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: 'periodStart and periodEnd required (YYYY-MM-DD)' });
  }
  const preview = await previewPayrollSettlement(req.params.courierId, periodStart, periodEnd);
  res.json(preview);
}));

/** Super Admin: confirm payroll settlement (تسوية راتب). */
app.post('/admin/drivers/:courierId/payroll-settlement', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const body = req.body as { periodStart?: string; periodEnd?: string; notes?: string };
  const periodStart = String(body.periodStart ?? '').trim();
  const periodEnd = String(body.periodEnd ?? '').trim();
  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: 'periodStart and periodEnd required' });
  }
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === req.params.courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  try {
    const result = await createPayrollSettlement({
      courierId: req.params.courierId,
      marketId: courierMarketId(courier),
      periodStart,
      periodEnd,
      notes: body.notes,
      createdBy: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'SETTLEMENT_OVERLAP') return res.status(409).json({ error: e.message, code: e.code });
    if (e.code === 'NOTHING_TO_SETTLE') return res.status(400).json({ error: e.message, code: e.code });
    throw err;
  }
}));

/** Super Admin: driver payroll statement (all tabs). */
app.get('/admin/drivers/:courierId/payroll-statement', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === req.params.courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  const statement = await getDriverPayrollStatement(req.params.courierId);
  res.json({
    courier: {
      id: courier.id,
      name: courier.name,
      phone: courier.phone,
      marketId: courierMarketId(courier),
    },
    ...statement,
  });
}));

/** Super Admin: payroll settlement history. */
app.get('/admin/payroll-settlements', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const courierId = req.query.courierId ? String(req.query.courierId) : undefined;
  const marketId = req.query.marketId ? String(req.query.marketId) : undefined;
  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;
  const [settlements, totals, couriers] = await Promise.all([
    listPayrollSettlements({ courierId, marketId, from, to }),
    computePayrollHistoryTotals({ courierId, marketId, from, to }),
    repos.couriers.findAll(),
  ]);
  const nameById = new Map(couriers.map((c) => [c.id, c.name]));
  res.json({
    settlements: settlements.map((s) => ({
      ...s,
      courierName: nameById.get(s.courierId) ?? s.courierId,
    })),
    totals,
  });
}));

/** Super Admin: printable RTL payslip (save as PDF via browser print). */
app.get('/admin/payroll-settlements/:id/payslip', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const settlement = await getPayrollSettlementById(req.params.id);
  if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === settlement.courierId);
  const html = buildSettlementPayslipHtml(settlement, {
    name: courier?.name ?? settlement.courierId,
    phone: courier?.phone,
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

/** Super Admin: get/update courier payroll config. */
app.get('/admin/couriers/:id/payroll-config', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const config = await getOrCreatePayrollConfig(req.params.id);
  res.json(config);
}));

app.patch('/admin/couriers/:id/payroll-config', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const body = req.body as {
    hourlyRate?: number;
    deliveryFeeShare?: number;
    orderCommissionPercent?: number;
    isPayrollEnabled?: boolean;
  };
  const config = await updatePayrollConfig(req.params.id, body);
  res.json(config);
}));

/** Super Admin: add driver bonus. */
app.post('/admin/couriers/:id/bonus', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const body = req.body as { amount?: number; reason?: string };
  const amount = Number(body.amount);
  const reason = String(body.reason ?? '').trim();
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (!reason) return res.status(400).json({ error: 'reason is required' });
  const couriers = await repos.couriers.findAll();
  const courier = couriers.find((c) => c.id === req.params.id);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  const result = await addBonus({
    courierId: req.params.id,
    marketId: courierMarketId(courier),
    amount,
    reason,
    userId: req.user.id,
  });
  res.status(201).json(result);
}));

/** Super Admin: list pending driver expenses. */
app.get('/admin/courier-expenses', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const status = String(req.query.status ?? 'PENDING');
  const marketId = req.query.marketId ? String(req.query.marketId) : undefined;
  const rows = await prisma.courierExpense.findMany({
    where: { status, ...(marketId ? { marketId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const couriers = await repos.couriers.findAll();
  const withNames = rows.map((r) => ({
    ...r,
    courierName: couriers.find((c) => c.id === r.courierId)?.name ?? r.courierId,
  }));
  res.json(withNames);
}));

app.post('/admin/courier-expenses/:id/approve', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const updated = await approveExpense(req.params.id, req.user.id);
  res.json(updated);
}));

app.post('/admin/courier-expenses/:id/reject', wrapAsync(async (req, res) => {
  if (!req.user || !isPlatformAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: platform admin only' });
  }
  const updated = await rejectExpense(req.params.id, req.user.id);
  res.json(updated);
}));

/** Assign courier to a MARKET delivery order. Validates courier.marketId == order.marketId == token.marketId. */
app.post('/markets/:marketId/orders/:orderId/assign-courier', async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!requireMarketDispatchAssignAuth(req, res, marketId)) return;

  const body = req.body as { courierId?: string; reassign?: boolean };
  const courierId = body.courierId;
  if (!courierId || typeof courierId !== 'string') {
    return res.status(400).json({ error: 'courierId is required' });
  }

  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; marketId?: string; fulfillmentType?: string; deliveryAssignmentMode?: string; courierId?: string; deliveryStatus?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];

  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) {
    return res.status(403).json({ error: 'Order not in this market', code: 'CROSS_MARKET_ACCESS' });
  }
  const isDelivery = (order as { fulfillmentType?: string }).fulfillmentType === 'DELIVERY';
  const assignmentMode = order.deliveryAssignmentMode ?? (isDelivery ? 'MARKET' : undefined);
  if (assignmentMode !== 'MARKET') {
    return res.status(400).json({ error: 'Order must be a delivery order with market dispatch (deliveryAssignmentMode MARKET)' });
  }

  const currentStatus = order.deliveryStatus ?? (order.courierId ? 'ASSIGNED' : 'UNASSIGNED');
  if (currentStatus !== 'UNASSIGNED' && !body.reassign) {
    return res.status(409).json({ error: 'Order already assigned. Use reassign: true to change courier.', code: 'CONCURRENCY_CONFLICT' });
  }

  const couriers = (await repos.couriers.findAll());
  const courier = couriers.find((c) => c.id === courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  const cMarketId = courierMarketId(courier);
  if (cMarketId !== marketId) {
    return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
  }
  const platformAdmin = isPlatformAdmin(user?.role);
  if (!platformAdmin) {
    if (!courier.isActive || !courier.isOnline) {
      return res.status(400).json({ error: 'Courier must be active and online' });
    }
    if (courier.isAvailable === false) {
      return res.status(400).json({ error: 'Courier is busy with another delivery' });
    }
  }

  const before = { ...order };
  const now = new Date().toISOString();
  const timeline = (order as { deliveryTimeline?: { assignedAt?: string } }).deliveryTimeline ?? {};
  const assignedAt = timeline.assignedAt ?? now;
  orders[idx] = {
    ...order,
    courierId,
    deliveryStatus: 'ASSIGNED',
    deliveryAssignmentMode: 'MARKET',
    deliveryTimeline: { ...timeline, assignedAt },
  } as OrderRecord;
  await repos.orders.upsert(orders[idx] as OrderRecord);

  const courierIdx = couriers.findIndex((c) => c.id === courierId);
  if (courierIdx >= 0) {
    couriers[courierIdx] = { ...couriers[courierIdx], isAvailable: false };
    await repos.couriers.setAll(couriers);
  }

  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'update',
    entity: 'order',
    entityId: orderId,
    reason: `assign-courier ${courierId}`,
    before: { courierId: before.courierId, deliveryStatus: (before as Record<string, unknown>).deliveryStatus },
    after: { courierId, deliveryStatus: 'ASSIGNED' },
  });

  const oldCourierId = (before as { courierId?: string }).courierId;
  appendDispatchAudit({
    orderId,
    marketId,
    tenantId: order.tenantId,
    oldCourierId,
    newCourierId: courierId,
    actorUserId: user!.id,
    actorRole: user!.role,
    action: oldCourierId && oldCourierId !== courierId ? 'REASSIGNED' : 'ASSIGNED',
  });

  emitCourierAssigned(courierId, orders[idx]);

  res.json(orders[idx]);
});

/** Log contact for an order. Updates contactLog.lastContactedAt, channel, notes. */
app.post('/markets/:marketId/orders/:orderId/contact', async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden', code: 'SCOPE_VIOLATION' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Order not in this market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { channel?: string; notes?: string; message?: string };
  const notes = body.notes?.trim() || body.message?.trim() || undefined;
  const channel = body.channel?.trim() || undefined;
  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; marketId?: string; contactLog?: { lastContactedAt?: string; channel?: string; notes?: string; entries?: { at: string; channel?: string; notes?: string; userId?: string }[] } }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];
  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) return res.status(403).json({ error: 'Order not in this market', code: 'CROSS_MARKET_ACCESS' });

  const now = new Date().toISOString();
  const contactLog = order.contactLog ?? {};
  const entries = contactLog.entries ?? [];
  entries.push({
    at: now,
    channel,
    notes,
    userId: user?.id,
  });
  orders[idx] = {
    ...order,
    contactLog: {
      ...contactLog,
      lastContactedAt: now,
      channel,
      notes,
      entries,
    },
  };
  await repos.orders.upsert(orders[idx] as OrderRecord);
  res.json(orders[idx]);
});

/** Unassign courier from a MARKET delivery order. */
app.delete('/markets/:marketId/orders/:orderId/assign-courier', async (req, res) => {
  const { marketId, orderId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (!requireMarketDispatchAssignAuth(req, res, marketId)) return;

  const orders = (await repos.orders.findAll()) as { id?: string; tenantId?: string; marketId?: string; deliveryAssignmentMode?: string; courierId?: string; deliveryStatus?: string }[];
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const order = orders[idx];

  const orderMarketId = order.marketId ?? (await repos.tenants.findAll()).find((t) => t.id === order.tenantId)?.marketId;
  if (orderMarketId !== marketId) {
    return res.status(403).json({ error: 'Order not in this market', code: 'CROSS_MARKET_ACCESS' });
  }

  const courierId = order.courierId;
  const before = { ...order };
  orders[idx] = { ...order, courierId: undefined, deliveryStatus: 'UNASSIGNED' };
  await repos.orders.upsert(orders[idx] as OrderRecord);

  if (courierId) {
    emitCourierUnassigned(courierId, orderId);
    const otherAssigned = orders.filter(
      (o) => o.courierId === courierId && o.id !== orderId && (o as Record<string, unknown>).status !== 'DELIVERED' && (o as Record<string, unknown>).status !== 'CANCELED'
    );
    if (otherAssigned.length === 0) {
      const couriers = (await repos.couriers.findAll());
      const cIdx = couriers.findIndex((c) => c.id === courierId);
      if (cIdx >= 0) {
        couriers[cIdx] = { ...couriers[cIdx], isAvailable: true };
        await repos.couriers.setAll(couriers);
      }
    }
  }

  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'update',
    entity: 'order',
    entityId: orderId,
    reason: 'unassign-courier',
    before: { courierId: before.courierId, deliveryStatus: (before as Record<string, unknown>).deliveryStatus },
    after: { courierId: undefined, deliveryStatus: undefined },
  });

  appendDispatchAudit({
    orderId,
    marketId,
    tenantId: order.tenantId,
    oldCourierId: courierId,
    actorUserId: user!.id,
    actorRole: user!.role,
    action: 'UNASSIGNED',
  });

  res.json(orders[idx]);
});

/** Market Admin creates an off-app external delivery order (dispatch-only). */
app.post('/markets/:marketId/external-orders', wrapAsync(async (req, res) => {
  const { marketId } = req.params;
  const user = req.user as { id: string; role: string } | undefined;
  if (!requireMarketDispatchAssignAuth(req, res, marketId)) return;

  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });

  const body = (req.body ?? {}) as {
    tenantId?: string;
    manualStoreName?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    notes?: string;
    total?: number;
    deliveryFee?: number;
    courierId?: string;
  };

  const customerName = String(body.customerName ?? '').trim();
  const customerPhone = String(body.customerPhone ?? '').trim();
  const deliveryAddress = String(body.deliveryAddress ?? '').trim();
  const notes = String(body.notes ?? '').trim();
  const feeRaw = body.deliveryFee ?? body.total;
  const fee = Number(feeRaw);
  const tenantIdRaw = String(body.tenantId ?? '').trim();
  const manualStoreName = String(body.manualStoreName ?? '').trim();
  const normalizedTenantId = tenantIdRaw && tenantIdRaw !== 'other' ? tenantIdRaw : '';

  if (!customerName || !customerPhone || !deliveryAddress) {
    return res.status(400).json({ error: 'customerName, customerPhone, and deliveryAddress are required' });
  }
  if (!Number.isFinite(fee) || fee < 0) {
    return res.status(400).json({ error: 'deliveryFee (≥0) is required' });
  }
  if (!normalizedTenantId && !manualStoreName) {
    return res.status(400).json({ error: 'tenantId or manualStoreName is required' });
  }

  const marketTenants = (await repos.tenants.findAll()).filter((t) => t.marketId === marketId);
  if (normalizedTenantId) {
    const tenant = marketTenants.find((t) => t.id === normalizedTenantId);
    if (!tenant) return res.status(400).json({ error: 'Store not in this market' });
  }

  const courierId = body.courierId?.trim() || undefined;
  if (courierId) {
    const couriers = await repos.couriers.findAll();
    const courier = couriers.find((c) => c.id === courierId);
    if (!courier) return res.status(404).json({ error: 'Courier not found' });
    if (courierMarketId(courier) !== marketId) {
      return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
    }
  }

  const now = new Date().toISOString();
  const orderId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const timeline: Record<string, string> = {};
  let deliveryStatus: string = 'UNASSIGNED';
  if (courierId) {
    deliveryStatus = 'ASSIGNED';
    timeline.assignedAt = now;
  }

  const order = {
    id: orderId,
    marketId,
    tenantId: normalizedTenantId || undefined,
    manualStoreName: normalizedTenantId ? undefined : manualStoreName,
    customerName,
    customerPhone,
    deliveryAddress,
    externalDestination: deliveryAddress,
    notes: notes || undefined,
    fulfillmentType: 'DELIVERY',
    deliveryAssignmentMode: 'MARKET',
    orderType: 'EXTERNAL',
    source: 'external',
    isExternal: true,
    status: 'READY',
    readyAt: now,
    deliveryStatus,
    courierId,
    deliveryTimeline: timeline,
    total: fee,
    subtotal: 0,
    items: [],
    createdAt: now,
    paymentMethod: 'CASH',
  } as OrderRecord;

  await repos.orders.addOrderWithPayment(order, {
    method: 'CASH',
    status: 'PENDING',
    amount: fee,
    currency: 'ILS',
  });

  if (courierId) {
    const couriers = await repos.couriers.findAll();
    const courierIdx = couriers.findIndex((c) => c.id === courierId);
    if (courierIdx >= 0) {
      couriers[courierIdx] = { ...couriers[courierIdx], isAvailable: false };
      await repos.couriers.setAll(couriers);
    }
    emitCourierAssigned(courierId, order);
  }

  appendDispatchAudit({
    orderId,
    marketId,
    tenantId: normalizedTenantId || undefined,
    newCourierId: courierId,
    actorUserId: user!.id,
    actorRole: user!.role,
    action: 'EXTERNAL_CREATED',
  });

  appendAuditEvent({
    userId: user!.id,
    role: user!.role,
    marketId,
    action: 'create',
    entity: 'order',
    entityId: orderId,
    reason: 'external-order',
    after: { isExternal: true, courierId, total: fee },
  });

  res.status(201).json(order);
}));

// --- Market dispatch queue ---
app.get('/markets/:marketId/dispatch/queue', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const queue = await getDispatchQueue(marketId, repos);
  res.json(queue);
});

// --- Market delivery jobs ---
app.get('/markets/:marketId/delivery-jobs', async (req, res) => {
  const { marketId } = req.params;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (req.user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (req.user?.role === 'MARKET_ADMIN' && req.user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const jobs = getDeliveryJobs().filter((j) => j.marketId === marketId);
  res.json(jobs);
});

app.post('/markets/:marketId/delivery-jobs', async (req, res) => {
  const { marketId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { items?: { orderId: string; tenantId: string }[] };
  const items = body.items ?? [];
  const tenantIds = new Set((await repos.tenants.findAll()).filter((t) => t.marketId === marketId).map((t) => t.id));
  for (const it of items) {
    if (!tenantIds.has(it.tenantId)) return res.status(400).json({ error: `Order ${it.orderId} tenant not in market` });
  }
  const id = `job-${crypto.randomUUID?.() ?? Date.now()}`;
  const job: DeliveryJob = {
    id,
    marketId,
    status: 'NEW',
    items,
    createdAt: new Date().toISOString(),
  };
  const jobs = getDeliveryJobs();
  jobs.push(job);
  setDeliveryJobs(jobs);
  res.status(201).json(job);
});

app.patch('/markets/:marketId/delivery-jobs/:jobId/assign', async (req, res) => {
  const { marketId, jobId } = req.params;
  const user = req.user;
  const market = (await repos.markets.findAll()).find((m) => m.id === marketId);
  if (!market) return res.status(404).json({ error: 'Market not found' });
  if (user?.role === 'TENANT_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (user?.role === 'MARKET_ADMIN' && user.marketId !== marketId) {
    return res.status(403).json({ error: 'Cannot assign couriers in another market', code: 'CROSS_MARKET_ACCESS' });
  }
  if (isPlatformAdmin(user?.role) && !requireWriteWithReason(req, res)) return;

  const body = req.body as { courierId: string };
  const jobs = getDeliveryJobs();
  const idx = jobs.findIndex((j) => j.id === jobId && j.marketId === marketId);
  if (idx === -1) return res.status(404).json({ error: 'Delivery job not found' });
  const courier = (await repos.couriers.findAll()).find((c) => c.id === body.courierId);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  if (courierMarketId(courier) !== marketId) {
    return res.status(403).json({ error: 'Courier belongs to another market', code: 'CROSS_MARKET_ACCESS' });
  }
  jobs[idx] = { ...jobs[idx], courierId: body.courierId, status: 'ASSIGNED' };
  setDeliveryJobs(jobs);
  res.json(jobs[idx]);
});

// --- Templates ---
app.get('/templates', async (_req, res) => {
  res.json(getTemplates());
});

// --- Staff ---
app.get('/staff', async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined;
  let staff = getStaff() as { tenantId?: string }[];
  if (tenantId) staff = staff.filter((s) => s.tenantId === tenantId);
  res.json(staff);
});

app.post('/staff', async (req, res) => {
  const user = req.body;
  const staff = getStaff();
  staff.push(user);
  setStaff(staff);
  res.status(201).json(user);
});

app.get('/', (_req, res) => {
  res.json({ status: 'ready' });
});

app.get('/health', async (_req, res) => {
  res.json({ ok: true });
});

/** Public mobile app version policy (force-update gate). */
app.get('/app-config', (_req, res) => {
  const iosAppStoreId = String(
    process.env.IOS_APP_STORE_ID ?? process.env.NMD_IOS_APP_STORE_ID ?? '',
  ).trim();
  const iosMinimumBuild = Number.parseInt(
    process.env.IOS_MINIMUM_BUILD_NUMBER ?? '24',
    10,
  );
  const iosLatestBuild = Number.parseInt(
    process.env.IOS_LATEST_BUILD_NUMBER ?? '30',
    10,
  );
  res.json({
    android: {
      minimumVersionCode: 29,
      latestVersionCode: 30,
      forceUpdateMessageAr: 'يرجى تحديث التطبيق للاستمرار',
      optionalUpdateMessageAr: 'يتوفر تحديث جديد للتطبيق',
    },
    ios: {
      minimumBuildNumber: Number.isFinite(iosMinimumBuild) ? iosMinimumBuild : 24,
      latestBuildNumber: Number.isFinite(iosLatestBuild) ? iosLatestBuild : 30,
      appStoreId: iosAppStoreId,
      forceUpdateMessageAr: 'يرجى تحديث التطبيق للاستمرار',
      optionalUpdateMessageAr: 'يتوفر تحديث جديد للتطبيق',
    },
    support: getSupportConfig(),
  });
});

/** Verification: return tenant list and whether شغف (Shaghaf) appears (for volume/cache checks). Public. */
app.get('/data', async (_req, res) => {
  const tenants = await repos.tenants.findAll();
  const names = tenants.map((t) => t.name ?? '');
  const hasShaghafInTenants = names.some((n) => n.includes('شغف'));
  const fullData = getData();
  const hasShaghafAnywhere = JSON.stringify(fullData).includes('شغف');
  res.json({
    tenantCount: tenants.length,
    hasShaghaf: hasShaghafInTenants,
    hasShaghafAnywhereInData: hasShaghafAnywhere,
    sampleTenantNames: names.slice(0, 10),
  });
});

/**
 * Unmatched routes (Express sees paths WITHOUT `/api` — nginx strips the prefix).
 * Log client mistakes (wrong path, missing /api on gateway, etc.).
 */
app.use((req, res) => {
  console.warn('[404] catch-all', req.method, req.originalUrl);
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

/** Global error handler: prevents uncaught errors from crashing the server. */
app.use((err: Error & { status?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status ?? 500;
  const body: { error: string; code?: string; details?: unknown } = {
    error: err.message || 'Internal server error',
  };
  if (err.code) body.code = err.code;
  if (process.env.NODE_ENV !== 'production') body.details = err.stack;
  res.status(status).json(body);
});

/** When using PostgreSQL, seed only when DB is empty (no markets). Never overwrites existing data — tenant marketId, admin email, etc. persist across restarts and rebuilds. */
async function seedDbFromJsonIfEmpty(): Promise<void> {
  if ((process.env.STORAGE_DRIVER ?? '').toLowerCase() !== 'db') return;
  const markets = await repos.markets.findAll();
  if (markets.length > 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[seed] DB already has', markets.length, 'market(s) — skip seed (tenant/market changes are preserved)');
    }
    return;
  }
  const candidates = [
    process.env.SEED_JSON_PATH,
    process.env.DATA_FILE,
    '/data/data.json',
    join(process.cwd(), 'data', 'data.json'),
    join(process.cwd(), 'data.json'),
  ].filter(Boolean) as string[];
  const seedPath = candidates.find((p) => existsSync(p)) ?? candidates[0] ?? join(process.cwd(), 'data', 'data.json');
  const data = loadFromPath(seedPath);
  if (!data) {
    console.log('[seed] No JSON file at', seedPath, '- starting with empty DB');
    return;
  }
  console.log('[seed] Seeding DB from', seedPath);
  if (data.markets.length > 0) await repos.markets.setAll(data.markets);
  if (data.tenants.length > 0) await repos.tenants.setAll(data.tenants);
  if (data.users.length > 0) await repos.users.setAll(data.users);
  for (const [tenantId, catalog] of Object.entries(data.catalog ?? {})) {
    if (tenantId && (catalog.categories?.length > 0 || catalog.products?.length > 0 || catalog.optionGroups?.length > 0)) {
      await repos.catalog.setCatalog(tenantId, catalog);
    }
  }
  for (const [tenantId, settings] of Object.entries(data.delivery ?? {})) {
    if (tenantId && settings && typeof settings === 'object') {
      await repos.delivery.setSettings(tenantId, settings as Record<string, unknown>);
    }
  }
  for (const [tenantId, zones] of Object.entries(data.deliveryZones ?? {})) {
    if (tenantId && Array.isArray(zones)) {
      await repos.deliveryZones.setAll(tenantId, zones);
    }
  }
  if ((data.couriers ?? []).length > 0) await repos.couriers.setAll(data.couriers);
  if ((data.customers ?? []).length > 0) await repos.customers.setAll(data.customers);
  // Never seed orders from data.json — orders live in Order table (or ORDERS_FILE). Prevents "zombie" orders from data.json after DB wipe.
  console.log('[seed] Done: markets=', data.markets.length, 'tenants=', data.tenants.length, 'catalog tenants=', Object.keys(data.catalog ?? {}).length);
}

const DATA_FILE_PATH = process.env.DATA_FILE || join(process.cwd(), 'data.json');

(async () => {
  await seedDbFromJsonIfEmpty();
  const storageDriver = (process.env.STORAGE_DRIVER ?? '').toLowerCase();
  if (storageDriver === 'json' && existsSync(DATA_FILE_PATH)) {
    const existing = getData();
    if (existing.users.length > 0 || existing.tenants.length > 0) {
      console.log('[seed] DATA_FILE has existing users/tenants — skip JSON seeds (zero data loss on restart/build)');
    } else {
      console.log('[seed] DATA_FILE exists — skip JSON seeds to avoid overwriting mounted volume');
    }
  } else {
    await seedUsersIfNeeded();
    await seedMarketsIfNeeded();
    await seedTenantMarketIdsIfNeeded();
    await seedOrdersIfNeeded();
    await seedDeliveryZonesIfNeeded();
    await seedDemoProfilesIfNeeded();
  }

  if (storageDriver !== 'db') {
    invalidateDataCache();
  }

  app.listen(PORT, '0.0.0.0', () => {
    logExpressRoutes(app);
    console.log(`Mock API server running at http://0.0.0.0:${PORT} (STORAGE_DRIVER=${process.env.STORAGE_DRIVER ?? 'json'})`);
    if (storageDriver === 'json') {
      console.log(`DATA_FILE=${DATA_FILE_PATH} — ensure process has write permission so admin email and other updates persist.`);
    }
    orderSubmissionPoller.start();
    console.log('[OTP-ENV] dotenv/process.env OTP-related keys:', {
      WHATSAPP_API_URL: (process.env.WHATSAPP_API_URL || '').slice(0, 56) || '(unset)',
      WHATSAPP_TOKEN_set: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_TOKEN.length > 0),
      USE_LEGACY_WHATSAPP_GATEWAY: process.env.USE_LEGACY_WHATSAPP_GATEWAY || '(unset)',
      WHATSAPP_GATEWAY_URL: (process.env.WHATSAPP_GATEWAY_URL || '').slice(0, 48) || '(unset)',
      WA_API_KEY_set: !!(process.env.WA_API_KEY && process.env.WA_API_KEY.length > 0),
      SMS_GATEWAY_URL_set: !!(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_URL.length > 0),
      SMS_API_KEY_set: !!(process.env.SMS_API_KEY && process.env.SMS_API_KEY.length > 0),
      TWILIO_ACCOUNT_SID_set: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.length > 0),
      TWILIO_AUTH_TOKEN_set: !!(process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN.length > 0),
      TWILIO_FROM_NUMBER_set: !!(process.env.TWILIO_FROM_NUMBER && process.env.TWILIO_FROM_NUMBER.length > 0),
      FAWAZ_PHONE_set: !!(process.env.FAWAZ_PHONE || process.env.MOCK_OTP_FIXED_PHONES),
      MOCK_OTP: process.env.MOCK_OTP || '(unset)',
      NODE_ENV: process.env.NODE_ENV || '(unset)',
    });
  });
})();
