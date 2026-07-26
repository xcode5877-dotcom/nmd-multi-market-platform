/**
 * Driver Cash Reconciliation V3
 *
 * Extends V2 platform collection (driverCollectionAmount = Now Market share)
 * with physical cash / restaurant liability separation.
 *
 * Production payment methods audited:
 *   order.payment.method | order.paymentMethod ∈ CASH | CARD | ONLINE
 *   (+ aliases CREDIT_CARD, VISA, DEBIT_CARD → card/online channel)
 *   External orders: isExternal / orderType EXTERNAL (delivery fee cash)
 *   Payment status: PENDING | COLLECTED | AUTHORIZED | CAPTURED | REFUNDED
 *
 * Settlement default: PLATFORM_ONLY (driver settles Now Market share with admin).
 * FULL_CASH is available for reporting / explicit settle requests.
 */

import { prisma } from './db.js';
import { extractOrderEarningsBase } from './courier-payroll.js';
import { computeOrderSettlementEconomics } from './settlement.js';
import {
  appendDriverCollectionSettlement,
  getDriverCollectionSettlements,
  getGlobalConfig,
  type DriverCollectionSettlementRecord,
  type DriverSettlementMode,
} from './store.js';

export type DriverCollectionSettlementStatus = 'PENDING' | 'SETTLED';

export type NormalizedPaymentMethod =
  | 'CASH_ON_DELIVERY'
  | 'ONLINE_PAID'
  | 'CARD_ON_DELIVERY'
  | 'EXTERNAL_DELIVERY'
  | 'UNKNOWN';

export type AccountingAnomalyCode =
  | 'UNKNOWN_PAYMENT_METHOD'
  | 'NEGATIVE_RESTAURANT_SHARE'
  | 'CUSTOMER_PAYABLE_MISMATCH'
  | 'ONLINE_PAID_BUT_CASH_RECORDED'
  | 'CASH_ORDER_WITH_ZERO_PAYABLE'
  | 'SETTLED_AMOUNT_EXCEEDS_LIABILITY'
  | 'MISSING_DELIVERY_FEE'
  | 'MISSING_PLATFORM_COMMISSION'
  | null;

/** Full V3 per-order accounting (derived). */
export type DriverOrderAccounting = {
  orderId: string;
  courierId: string | null;
  orderType: 'EXTERNAL' | 'APP';
  isExternal: boolean;
  status: string;
  normalizedPaymentMethod: NormalizedPaymentMethod;
  rawPaymentMethod: string;

  customerPayableAmount: number;
  /** @deprecated alias — use customerPayableAmount */
  orderTotal: number;

  deliveryFee: number;
  platformCommission: number;

  driverCashInHand: number;
  driverNonCashCollected: number;

  /** Platform revenue earned (may already be collected online). */
  platformRevenueAmount: number;
  /** Amount driver owes Now Market in cash settlement. */
  driverPlatformLiabilityAmount: number;
  /** Amount of COD cash belonging to restaurant. */
  driverRestaurantLiabilityAmount: number;
  totalDriverLiability: number;

  /**
   * V2 compatibility: Now Market share only (= platformRevenue for countable orders).
   * @deprecated prefer platformRevenueAmount / driverPlatformLiabilityAmount
   */
  driverCollectionAmount: number;
  /** @deprecated restaurant share of COD cash; prefer driverRestaurantLiabilityAmount */
  restaurantShare: number;

  settlementStatus: DriverCollectionSettlementStatus;
  settledAmount: number;
  outstandingAmount: number;
  settlementModeApplied: DriverSettlementMode;

  settledAt?: string;
  settledBy?: string;
  settlementReference?: string;
  settlementNotes?: string;
  settlementId?: string;
  settlementMode?: DriverSettlementMode;

  anomalyCode: AccountingAnomalyCode;
  anomalyMessage?: string;
  blockAutoSettlement: boolean;

  createdAt?: string;
  deliveredAt?: string;
  marketId?: string;
};

/** @deprecated use DriverOrderAccounting */
export type DriverOrderCollectionBreakdown = DriverOrderAccounting;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

export function getDriverSettlementMode(): DriverSettlementMode {
  const mode = getGlobalConfig()?.driverSettlementMode;
  return mode === 'FULL_CASH' ? 'FULL_CASH' : 'PLATFORM_ONLY';
}

export function isOrderExternal(order: Record<string, unknown>): boolean {
  if (order.isExternal === true) return true;
  const orderType = String(order.orderType ?? '').toUpperCase();
  if (orderType === 'EXTERNAL') return true;
  const source = String(order.source ?? '').toLowerCase();
  return source === 'external';
}

export function isDriverCollectionCountable(order: Record<string, unknown>): boolean {
  const status = String(order.status ?? '').toUpperCase();
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'FAILED') {
    return false;
  }
  return status === 'DELIVERED' || status === 'COMPLETED';
}

export function extractRawPaymentMethod(order: Record<string, unknown>): string {
  const pay = order.payment as { method?: string } | undefined;
  return String(pay?.method ?? order.paymentMethod ?? '')
    .toUpperCase()
    .trim();
}

/**
 * Map production payment fields → accounting categories.
 * CARD/ONLINE/VISA settle to platform (store settlement ONLINE_PLATFORM) — not driver cash.
 * No distinct card-terminal-to-driver flow exists in production today.
 */
export function normalizePaymentMethod(order: Record<string, unknown>): NormalizedPaymentMethod {
  if (isOrderExternal(order)) return 'EXTERNAL_DELIVERY';
  const raw = extractRawPaymentMethod(order);
  // Empty defaults to CASH in checkout — treat as COD for delivery app orders.
  if (!raw || raw === 'CASH' || raw === 'COD' || raw === 'CASH_ON_DELIVERY') {
    return 'CASH_ON_DELIVERY';
  }
  if (
    raw === 'ONLINE' ||
    raw === 'CARD' ||
    raw === 'CREDIT_CARD' ||
    raw === 'CREDIT' ||
    raw === 'VISA' ||
    raw === 'DEBIT_CARD' ||
    raw === 'PAID_ONLINE'
  ) {
    return 'ONLINE_PAID';
  }
  // Reserved: not an active production path today
  if (raw === 'CARD_ON_DELIVERY' || raw === 'COD_CARD') {
    return 'CARD_ON_DELIVERY';
  }
  return 'UNKNOWN';
}

export function extractPlatformCommission(order: Record<string, unknown>): number {
  if (isOrderExternal(order)) return 0;
  const stored = Number(order.platformFee);
  if (Number.isFinite(stored) && stored >= 0) return roundMoney(stored);

  const payment = order.payment as
    | { financials?: Record<string, unknown>; breakdown?: Record<string, unknown> }
    | undefined;
  const fromFin = Number(
    payment?.financials?.platformFee ?? payment?.financials?.commission
  );
  if (Number.isFinite(fromFin) && fromFin >= 0) return roundMoney(fromFin);

  const fromBreakdown = Number(payment?.breakdown?.platformFee);
  if (Number.isFinite(fromBreakdown) && fromBreakdown >= 0) {
    return roundMoney(fromBreakdown);
  }

  try {
    const econ = computeOrderSettlementEconomics(order, {}, new Map(), new Map());
    return roundMoney(Math.max(0, econ.platformCommission));
  } catch {
    return 0;
  }
}

export function extractDeliveryFeeForCollection(order: Record<string, unknown>): number {
  if (isOrderExternal(order)) {
    const { deliveryFee } = extractOrderEarningsBase(order);
    if (deliveryFee > 0) return deliveryFee;
    const total = Number(order.total);
    return Number.isFinite(total) && total > 0 ? roundMoney(total) : 0;
  }
  return extractOrderEarningsBase(order).deliveryFee;
}

/** Server-authoritative amount the customer owes / paid. */
export function extractCustomerPayableAmount(order: Record<string, unknown>): number {
  const pay = order.payment as
    | { financials?: { customerTotal?: number; gross?: number }; amount?: number }
    | undefined;
  const candidates = [
    pay?.financials?.customerTotal,
    pay?.financials?.gross,
    pay?.amount,
    order.customerTotal,
    order.total,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return roundMoney(n);
  }
  return 0;
}

/**
 * V2 helper preserved: platform share only.
 */
export function computeDriverCollectionAmount(order: Record<string, unknown>): {
  deliveryFee: number;
  platformCommission: number;
  driverCollectionAmount: number;
  restaurantShare: number;
  orderTotal: number;
  isExternal: boolean;
} {
  const acc = computeDriverOrderAccounting(order);
  return {
    deliveryFee: acc.deliveryFee,
    platformCommission: acc.platformCommission,
    driverCollectionAmount: acc.driverCollectionAmount,
    restaurantShare: acc.restaurantShare,
    orderTotal: acc.orderTotal,
    isExternal: acc.isExternal,
  };
}

export function readOrderSettlementMeta(order: Record<string, unknown>): {
  settlementStatus: DriverCollectionSettlementStatus;
  settledAt?: string;
  settledBy?: string;
  settlementReference?: string;
  settlementNotes?: string;
  settlementId?: string;
  settlementMode?: DriverSettlementMode;
  settledAmount?: number;
} {
  const settlementId =
    (order.driverCollectionSettlementId as string | undefined)?.trim() ||
    (order.settlementId as string | undefined)?.trim() ||
    undefined;
  if (settlementId || String(order.settlementStatus ?? '').toUpperCase() === 'SETTLED') {
    const modeRaw = String(order.settlementMode ?? '').toUpperCase();
    const settlementMode: DriverSettlementMode | undefined =
      modeRaw === 'FULL_CASH'
        ? 'FULL_CASH'
        : modeRaw === 'PLATFORM_ONLY'
          ? 'PLATFORM_ONLY'
          : undefined;
    const settledAmount = Number(order.settledAmount);
    return {
      settlementStatus: 'SETTLED',
      settledAt: order.settledAt ? String(order.settledAt) : undefined,
      settledBy: order.settledBy ? String(order.settledBy) : undefined,
      settlementReference: order.settlementReference
        ? String(order.settlementReference)
        : undefined,
      settlementNotes: order.settlementNotes ? String(order.settlementNotes) : undefined,
      settlementId,
      settlementMode,
      settledAmount: Number.isFinite(settledAmount) ? roundMoney(settledAmount) : undefined,
    };
  }
  return { settlementStatus: 'PENDING' };
}

function liabilityForMode(
  mode: DriverSettlementMode,
  platformLiability: number,
  totalLiability: number
): number {
  return mode === 'FULL_CASH' ? totalLiability : platformLiability;
}

/**
 * Canonical V3 derivation.
 */
export function computeDriverOrderAccounting(
  order: Record<string, unknown>,
  opts?: { settlementMode?: DriverSettlementMode }
): DriverOrderAccounting {
  const mode = opts?.settlementMode ?? getDriverSettlementMode();
  const isExternal = isOrderExternal(order);
  const normalized = normalizePaymentMethod(order);
  const rawPaymentMethod = extractRawPaymentMethod(order) || (isExternal ? 'CASH' : 'CASH');
  const deliveryFee = extractDeliveryFeeForCollection(order);
  const platformCommission = isExternal ? 0 : extractPlatformCommission(order);
  const customerPayableAmount = extractCustomerPayableAmount(order);
  const countable = isDriverCollectionCountable(order);
  const meta = readOrderSettlementMeta(order);
  const timeline = order.deliveryTimeline as { deliveredAt?: string } | undefined;

  let anomalyCode: AccountingAnomalyCode = null;
  let anomalyMessage: string | undefined;

  const platformRevenueAmount = countable
    ? isExternal
      ? deliveryFee
      : roundMoney(deliveryFee + platformCommission)
    : 0;

  let driverCashInHand = 0;
  let driverNonCashCollected = 0;
  let driverPlatformLiabilityAmount = 0;
  let driverRestaurantLiabilityAmount = 0;

  if (countable) {
    if (normalized === 'EXTERNAL_DELIVERY') {
      driverCashInHand = deliveryFee;
      driverPlatformLiabilityAmount = deliveryFee;
      driverRestaurantLiabilityAmount = 0;
      if (deliveryFee <= 0) {
        anomalyCode = 'MISSING_DELIVERY_FEE';
        anomalyMessage = 'External order missing delivery fee';
      }
    } else if (normalized === 'CASH_ON_DELIVERY') {
      driverCashInHand = customerPayableAmount;
      driverPlatformLiabilityAmount = platformRevenueAmount;
      const restaurant = roundMoney(driverCashInHand - driverPlatformLiabilityAmount);
      if (restaurant < 0) {
        anomalyCode = 'NEGATIVE_RESTAURANT_SHARE';
        anomalyMessage = `Restaurant share negative (${restaurant})`;
        driverRestaurantLiabilityAmount = 0;
      } else {
        driverRestaurantLiabilityAmount = restaurant;
      }
      if (customerPayableAmount <= 0) {
        anomalyCode = anomalyCode ?? 'CASH_ORDER_WITH_ZERO_PAYABLE';
        anomalyMessage =
          anomalyMessage ?? 'Cash-on-delivery order has zero customer payable';
      }
      if (!isExternal && platformCommission <= 0 && deliveryFee > 0) {
        // soft warning — commission may legitimately be 0
      }
    } else if (normalized === 'ONLINE_PAID') {
      // Card/online settles to platform centrally — driver holds no cash / no liability.
      driverCashInHand = 0;
      driverNonCashCollected = customerPayableAmount;
      driverPlatformLiabilityAmount = 0;
      driverRestaurantLiabilityAmount = 0;
      const cashLedger = (order.payment as { cashLedger?: { collected?: boolean; amount?: number } } | undefined)
        ?.cashLedger;
      if (cashLedger?.collected && Number(cashLedger.amount) > 0) {
        anomalyCode = 'ONLINE_PAID_BUT_CASH_RECORDED';
        anomalyMessage = 'Online-paid order also has cash collection recorded';
        driverCashInHand = roundMoney(Number(cashLedger.amount));
        // Do not invent platform liability from online revenue.
      }
    } else if (normalized === 'CARD_ON_DELIVERY') {
      // Not used in production today; fail safe: non-cash, no driver liability until audited.
      driverCashInHand = 0;
      driverNonCashCollected = customerPayableAmount;
      driverPlatformLiabilityAmount = 0;
      driverRestaurantLiabilityAmount = 0;
      anomalyCode = 'UNKNOWN_PAYMENT_METHOD';
      anomalyMessage =
        'CARD_ON_DELIVERY is not an active production settlement path; blocked until audited';
    } else {
      anomalyCode = 'UNKNOWN_PAYMENT_METHOD';
      anomalyMessage = `Unknown payment method: ${rawPaymentMethod || '(empty)'}`;
    }

    if (
      !isExternal &&
      countable &&
      normalized === 'CASH_ON_DELIVERY' &&
      platformCommission < 0
    ) {
      anomalyCode = anomalyCode ?? 'MISSING_PLATFORM_COMMISSION';
    }

    // Payable vs components check (soft for COD)
    if (
      normalized === 'CASH_ON_DELIVERY' &&
      customerPayableAmount > 0 &&
      Math.abs(
        customerPayableAmount - (deliveryFee + platformCommission + driverRestaurantLiabilityAmount)
      ) > 0.05 &&
      anomalyCode !== 'NEGATIVE_RESTAURANT_SHARE'
    ) {
      // restaurant share derived from cash - platform; mismatch vs items is informational only
      const reconstructed = roundMoney(deliveryFee + platformCommission + driverRestaurantLiabilityAmount);
      if (Math.abs(reconstructed - customerPayableAmount) > 0.05) {
        anomalyCode = anomalyCode ?? 'CUSTOMER_PAYABLE_MISMATCH';
        anomalyMessage =
          anomalyMessage ??
          `Payable ${customerPayableAmount} ≠ reconstructed ${reconstructed}`;
      }
    }
  }

  const totalDriverLiability = roundMoney(
    driverPlatformLiabilityAmount + driverRestaurantLiabilityAmount
  );

  const settlementBasis = liabilityForMode(
    mode,
    driverPlatformLiabilityAmount,
    totalDriverLiability
  );

  let settledAmount = 0;
  let outstandingAmount = settlementBasis;
  if (meta.settlementStatus === 'SETTLED') {
    settledAmount =
      meta.settledAmount != null
        ? meta.settledAmount
        : liabilityForMode(
            meta.settlementMode ?? mode,
            driverPlatformLiabilityAmount,
            totalDriverLiability
          );
    outstandingAmount = roundMoney(Math.max(0, settlementBasis - settledAmount));
    if (settledAmount > settlementBasis + 0.001) {
      anomalyCode = 'SETTLED_AMOUNT_EXCEEDS_LIABILITY';
      anomalyMessage = `Settled ${settledAmount} exceeds liability ${settlementBasis}`;
    }
  }

  const blockAutoSettlement =
    anomalyCode === 'UNKNOWN_PAYMENT_METHOD' ||
    anomalyCode === 'NEGATIVE_RESTAURANT_SHARE' ||
    anomalyCode === 'ONLINE_PAID_BUT_CASH_RECORDED' ||
    anomalyCode === 'SETTLED_AMOUNT_EXCEEDS_LIABILITY' ||
    anomalyCode === 'CASH_ORDER_WITH_ZERO_PAYABLE';

  return {
    orderId: String(order.id ?? ''),
    courierId: order.courierId != null ? String(order.courierId) : null,
    orderType: isExternal ? 'EXTERNAL' : 'APP',
    isExternal,
    status: String(order.status ?? ''),
    normalizedPaymentMethod: normalized,
    rawPaymentMethod,
    customerPayableAmount,
    orderTotal: customerPayableAmount,
    deliveryFee,
    platformCommission,
    driverCashInHand,
    driverNonCashCollected,
    platformRevenueAmount,
    driverPlatformLiabilityAmount,
    driverRestaurantLiabilityAmount,
    totalDriverLiability,
    driverCollectionAmount: platformRevenueAmount,
    restaurantShare: driverRestaurantLiabilityAmount,
    settlementStatus: meta.settlementStatus,
    settledAmount,
    outstandingAmount,
    settlementModeApplied: mode,
    settledAt: meta.settledAt,
    settledBy: meta.settledBy,
    settlementReference: meta.settlementReference,
    settlementNotes: meta.settlementNotes,
    settlementId: meta.settlementId,
    settlementMode: meta.settlementMode,
    anomalyCode,
    anomalyMessage,
    blockAutoSettlement,
    createdAt: order.createdAt ? String(order.createdAt) : undefined,
    deliveredAt: timeline?.deliveredAt ? String(timeline.deliveredAt) : undefined,
    marketId: order.marketId ? String(order.marketId) : undefined,
  };
}

export function enrichOrderWithDriverCollection(
  order: Record<string, unknown>,
  opts?: { settlementMode?: DriverSettlementMode }
): DriverOrderAccounting {
  return computeDriverOrderAccounting(order, opts);
}

export type DriverCollectionFilters = {
  from?: string;
  to?: string;
  courierId?: string;
  marketId?: string;
  settlementStatus?: 'PENDING' | 'SETTLED' | 'ALL';
  shiftStart?: string;
};

function orderEventTime(order: Record<string, unknown>): string {
  const timeline = order.deliveryTimeline as { deliveredAt?: string } | undefined;
  return String(timeline?.deliveredAt || order.createdAt || '');
}

export function orderMatchesCollectionFilters(
  order: Record<string, unknown>,
  filters: DriverCollectionFilters
): boolean {
  if (!order.courierId) return false;
  if (filters.courierId && String(order.courierId) !== filters.courierId) return false;
  if (filters.marketId && String(order.marketId ?? '') !== filters.marketId) return false;

  const t = orderEventTime(order).slice(0, 10);
  if (filters.from && t && t < filters.from.slice(0, 10)) return false;
  if (filters.to && t && t > filters.to.slice(0, 10)) return false;

  if (filters.shiftStart) {
    const event = orderEventTime(order);
    if (event && event < filters.shiftStart) return false;
  }

  const meta = readOrderSettlementMeta(order);
  if (filters.settlementStatus && filters.settlementStatus !== 'ALL') {
    if (meta.settlementStatus !== filters.settlementStatus) return false;
  }
  return true;
}

export type DriverCollectionSummary = {
  courierId: string;
  courierName: string;
  marketId?: string;
  completedOrders: number;
  externalOrders: number;
  appOrders: number;
  cashOrders: number;
  onlinePaidOrders: number;
  deliveryFeesTotal: number;
  platformCommissionTotal: number;
  /** V2: platform revenue / share */
  driverCollectionTotal: number;
  cashInHandTotal: number;
  platformLiabilityTotal: number;
  restaurantLiabilityTotal: number;
  totalDriverLiability: number;
  todayCollection: number;
  currentShiftCollection: number;
  /** Outstanding by configured settlement mode */
  outstandingCollection: number;
  settledCollection: number;
  pendingOrders: number;
  settledOrders: number;
  anomalyCount: number;
};

export function aggregateDriverCollections(
  orders: Record<string, unknown>[],
  couriers: { id: string; name?: string; marketId?: string }[],
  opts: {
    filters: DriverCollectionFilters;
    today: string;
    shiftStartByCourier?: Map<string, string>;
    settlementMode?: DriverSettlementMode;
  }
): DriverCollectionSummary[] {
  const mode = opts.settlementMode ?? getDriverSettlementMode();
  const byId = new Map<string, DriverCollectionSummary>();
  for (const c of couriers) {
    if (opts.filters.courierId && c.id !== opts.filters.courierId) continue;
    if (opts.filters.marketId && (c.marketId ?? '') !== opts.filters.marketId) continue;
    byId.set(c.id, emptySummary(c.id, c.name ?? c.id, c.marketId));
  }

  for (const order of orders) {
    if (!isDriverCollectionCountable(order)) continue;
    if (!orderMatchesCollectionFilters(order, { ...opts.filters, settlementStatus: 'ALL' })) {
      continue;
    }
    const cid = String(order.courierId);
    let row = byId.get(cid);
    if (!row) {
      row = emptySummary(cid, cid, undefined);
      byId.set(cid, row);
    }

    const b = computeDriverOrderAccounting(order, { settlementMode: mode });
    if (
      opts.filters.settlementStatus &&
      opts.filters.settlementStatus !== 'ALL' &&
      b.settlementStatus !== opts.filters.settlementStatus
    ) {
      continue;
    }

    row.completedOrders += 1;
    if (b.isExternal) row.externalOrders += 1;
    else row.appOrders += 1;
    if (b.normalizedPaymentMethod === 'CASH_ON_DELIVERY' || b.normalizedPaymentMethod === 'EXTERNAL_DELIVERY') {
      row.cashOrders += 1;
    }
    if (b.normalizedPaymentMethod === 'ONLINE_PAID') row.onlinePaidOrders += 1;

    row.deliveryFeesTotal = roundMoney(row.deliveryFeesTotal + b.deliveryFee);
    row.platformCommissionTotal = roundMoney(
      row.platformCommissionTotal + b.platformCommission
    );
    row.driverCollectionTotal = roundMoney(
      row.driverCollectionTotal + b.driverCollectionAmount
    );
    row.cashInHandTotal = roundMoney(row.cashInHandTotal + b.driverCashInHand);
    row.platformLiabilityTotal = roundMoney(
      row.platformLiabilityTotal + b.driverPlatformLiabilityAmount
    );
    row.restaurantLiabilityTotal = roundMoney(
      row.restaurantLiabilityTotal + b.driverRestaurantLiabilityAmount
    );
    row.totalDriverLiability = roundMoney(
      row.totalDriverLiability + b.totalDriverLiability
    );
    if (b.anomalyCode) row.anomalyCount += 1;

    const day = (b.deliveredAt || b.createdAt || '').slice(0, 10);
    if (day === opts.today) {
      row.todayCollection = roundMoney(
        row.todayCollection + b.driverPlatformLiabilityAmount
      );
    }

    const shiftStart = opts.shiftStartByCourier?.get(cid);
    const event = b.deliveredAt || b.createdAt || '';
    if (shiftStart && event && event >= shiftStart) {
      row.currentShiftCollection = roundMoney(
        row.currentShiftCollection + b.driverPlatformLiabilityAmount
      );
    }

    if (b.settlementStatus === 'SETTLED') {
      row.settledCollection = roundMoney(row.settledCollection + b.settledAmount);
      row.settledOrders += 1;
    } else {
      row.outstandingCollection = roundMoney(
        row.outstandingCollection + b.outstandingAmount
      );
      row.pendingOrders += 1;
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.courierName.localeCompare(b.courierName, 'ar')
  );
}

function emptySummary(
  courierId: string,
  courierName: string,
  marketId?: string
): DriverCollectionSummary {
  return {
    courierId,
    courierName,
    marketId,
    completedOrders: 0,
    externalOrders: 0,
    appOrders: 0,
    cashOrders: 0,
    onlinePaidOrders: 0,
    deliveryFeesTotal: 0,
    platformCommissionTotal: 0,
    driverCollectionTotal: 0,
    cashInHandTotal: 0,
    platformLiabilityTotal: 0,
    restaurantLiabilityTotal: 0,
    totalDriverLiability: 0,
    todayCollection: 0,
    currentShiftCollection: 0,
    outstandingCollection: 0,
    settledCollection: 0,
    pendingOrders: 0,
    settledOrders: 0,
    anomalyCount: 0,
  };
}

export type DriverCollectionsDashboard = {
  /** V2 compat — platform liability today */
  driverCollectionsToday: number;
  pendingCollections: number;
  settledToday: number;
  deliveryFeesToday: number;
  platformCommissionsToday: number;
  // V3
  cashInHandTotal: number;
  platformLiabilityTotal: number;
  restaurantLiabilityTotal: number;
  totalDriverLiability: number;
  settledAmountToday: number;
  outstandingAmount: number;
  settlementMode: DriverSettlementMode;
};

export function computeCollectionsDashboard(
  orders: Record<string, unknown>[],
  today: string,
  settlementMode?: DriverSettlementMode
): DriverCollectionsDashboard {
  const mode = settlementMode ?? getDriverSettlementMode();
  let driverCollectionsToday = 0;
  let pendingCollections = 0;
  let settledToday = 0;
  let deliveryFeesToday = 0;
  let platformCommissionsToday = 0;
  let cashInHandTotal = 0;
  let platformLiabilityTotal = 0;
  let restaurantLiabilityTotal = 0;
  let totalDriverLiability = 0;
  let settledAmountToday = 0;
  let outstandingAmount = 0;

  for (const order of orders) {
    if (!isDriverCollectionCountable(order) || !order.courierId) continue;
    const b = computeDriverOrderAccounting(order, { settlementMode: mode });
    cashInHandTotal = roundMoney(cashInHandTotal + b.driverCashInHand);
    platformLiabilityTotal = roundMoney(
      platformLiabilityTotal + b.driverPlatformLiabilityAmount
    );
    restaurantLiabilityTotal = roundMoney(
      restaurantLiabilityTotal + b.driverRestaurantLiabilityAmount
    );
    totalDriverLiability = roundMoney(totalDriverLiability + b.totalDriverLiability);

    const day = (b.deliveredAt || b.createdAt || '').slice(0, 10);
    if (day === today) {
      driverCollectionsToday = roundMoney(
        driverCollectionsToday + b.driverPlatformLiabilityAmount
      );
      deliveryFeesToday = roundMoney(deliveryFeesToday + b.deliveryFee);
      platformCommissionsToday = roundMoney(
        platformCommissionsToday + b.platformCommission
      );
    }
    if (b.settlementStatus === 'SETTLED') {
      if ((b.settledAt || '').slice(0, 10) === today) {
        settledToday = roundMoney(settledToday + b.settledAmount);
        settledAmountToday = settledToday;
      }
    } else {
      pendingCollections = roundMoney(
        pendingCollections + b.driverPlatformLiabilityAmount
      );
      outstandingAmount = roundMoney(outstandingAmount + b.outstandingAmount);
    }
  }

  return {
    driverCollectionsToday,
    pendingCollections,
    settledToday,
    deliveryFeesToday,
    platformCommissionsToday,
    cashInHandTotal,
    platformLiabilityTotal,
    restaurantLiabilityTotal,
    totalDriverLiability,
    settledAmountToday,
    outstandingAmount,
    settlementMode: mode,
  };
}

export async function listActiveShiftStarts(
  courierIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (courierIds.length === 0) return map;
  try {
    const rows = await prisma.courierShift.findMany({
      where: { courierId: { in: courierIds }, endTime: null },
      orderBy: { startTime: 'desc' },
    });
    for (const r of rows) {
      if (!map.has(r.courierId)) map.set(r.courierId, r.startTime);
    }
  } catch {
    // optional
  }
  return map;
}

function mapSettlementRow(r: {
  id: string;
  courierId: string;
  marketId: string | null;
  amount: number;
  deliveryFeesTotal: number;
  platformCommissionTotal: number;
  ordersCount: number;
  orderIds: string;
  shiftLabel: string | null;
  status: string;
  settledAt: string;
  settledBy: string;
  settlementReference: string | null;
  settlementNotes: string | null;
  createdAt: string;
  settlementMode?: string | null;
  cashInHandTotal?: number | null;
  platformLiabilityTotal?: number | null;
  restaurantLiabilityTotal?: number | null;
  settlementBasisAmount?: number | null;
  settledAmount?: number | null;
  differenceAmount?: number | null;
}): DriverCollectionSettlementRecord {
  const modeRaw = String(r.settlementMode ?? 'PLATFORM_ONLY').toUpperCase();
  return {
    id: r.id,
    courierId: r.courierId,
    marketId: r.marketId ?? undefined,
    amount: r.amount,
    deliveryFeesTotal: r.deliveryFeesTotal,
    platformCommissionTotal: r.platformCommissionTotal,
    ordersCount: r.ordersCount,
    orderIds: JSON.parse(r.orderIds || '[]') as string[],
    shiftLabel: r.shiftLabel ?? undefined,
    status: r.status as 'SETTLED',
    settledAt: r.settledAt,
    settledBy: r.settledBy,
    settlementReference: r.settlementReference ?? undefined,
    settlementNotes: r.settlementNotes ?? undefined,
    createdAt: r.createdAt,
    settlementMode: modeRaw === 'FULL_CASH' ? 'FULL_CASH' : 'PLATFORM_ONLY',
    cashInHandTotal: r.cashInHandTotal ?? undefined,
    platformLiabilityTotal: r.platformLiabilityTotal ?? undefined,
    restaurantLiabilityTotal: r.restaurantLiabilityTotal ?? undefined,
    settlementBasisAmount: r.settlementBasisAmount ?? r.amount,
    settledAmount: r.settledAmount ?? r.amount,
    differenceAmount: r.differenceAmount ?? 0,
    entryType: 'SETTLEMENT',
  };
}

export async function listCollectionSettlements(filters?: {
  courierId?: string;
  from?: string;
  to?: string;
}): Promise<DriverCollectionSettlementRecord[]> {
  let rows: DriverCollectionSettlementRecord[] = [];
  try {
    const dbRows = await prisma.driverCollectionSettlement.findMany({
      where: {
        ...(filters?.courierId ? { courierId: filters.courierId } : {}),
      },
      orderBy: { settledAt: 'desc' },
    });
    rows = dbRows.map((r) => mapSettlementRow(r as Parameters<typeof mapSettlementRow>[0]));
  } catch {
    rows = getDriverCollectionSettlements();
  }

  const fromStore = getDriverCollectionSettlements();
  const seen = new Set(rows.map((r) => r.id));
  for (const s of fromStore) {
    if (!seen.has(s.id)) rows.push(s);
  }

  return rows
    .filter((r) => {
      if (filters?.courierId && r.courierId !== filters.courierId) return false;
      const d = (r.settledAt || '').slice(0, 10);
      if (filters?.from && d < filters.from.slice(0, 10)) return false;
      if (filters?.to && d > filters.to.slice(0, 10)) return false;
      return true;
    })
    .sort((a, b) => (b.settledAt || '').localeCompare(a.settledAt || ''));
}

/**
 * Full settlement only (no partial). Anomalous orders blocked.
 * Default mode PLATFORM_ONLY — settles driverPlatformLiabilityAmount.
 */
export async function createDriverCollectionSettlement(input: {
  courierId: string;
  marketId?: string;
  orders: Record<string, unknown>[];
  settledBy: string;
  settlementReference?: string;
  settlementNotes?: string;
  shiftLabel?: string;
  settlementMode?: DriverSettlementMode;
  /** Rejected if provided and not equal to basis (no partial). */
  settledAmount?: number;
}): Promise<{
  settlement: DriverCollectionSettlementRecord;
  updatedOrders: Record<string, unknown>[];
}> {
  const mode = input.settlementMode ?? getDriverSettlementMode();

  const pending = input.orders.filter((o) => {
    if (!isDriverCollectionCountable(o)) return false;
    if (String(o.courierId) !== input.courierId) return false;
    return readOrderSettlementMeta(o).settlementStatus === 'PENDING';
  });

  if (pending.length === 0) {
    throw Object.assign(new Error('No pending collection orders to settle'), {
      code: 'NO_PENDING_ORDERS',
    });
  }

  const accountings = pending.map((o) =>
    computeDriverOrderAccounting(o, { settlementMode: mode })
  );
  const blocked = accountings.filter((a) => a.blockAutoSettlement);
  if (blocked.length > 0) {
    throw Object.assign(
      new Error(
        `Cannot settle: ${blocked.length} order(s) have accounting anomalies (${blocked
          .map((b) => b.anomalyCode)
          .join(', ')})`
      ),
      { code: 'ANOMALY_BLOCKED', orderIds: blocked.map((b) => b.orderId) }
    );
  }

  let deliveryFeesTotal = 0;
  let platformCommissionTotal = 0;
  let cashInHandTotal = 0;
  let platformLiabilityTotal = 0;
  let restaurantLiabilityTotal = 0;
  let settlementBasisAmount = 0;
  const orderIds: string[] = [];

  for (const a of accountings) {
    deliveryFeesTotal = roundMoney(deliveryFeesTotal + a.deliveryFee);
    platformCommissionTotal = roundMoney(platformCommissionTotal + a.platformCommission);
    cashInHandTotal = roundMoney(cashInHandTotal + a.driverCashInHand);
    platformLiabilityTotal = roundMoney(
      platformLiabilityTotal + a.driverPlatformLiabilityAmount
    );
    restaurantLiabilityTotal = roundMoney(
      restaurantLiabilityTotal + a.driverRestaurantLiabilityAmount
    );
    settlementBasisAmount = roundMoney(settlementBasisAmount + a.outstandingAmount);
    orderIds.push(a.orderId);
  }

  // Online-only batches may have zero basis — still allow recording with 0
  const settledAmount =
    input.settledAmount != null ? roundMoney(input.settledAmount) : settlementBasisAmount;

  if (Math.abs(settledAmount - settlementBasisAmount) > 0.001) {
    throw Object.assign(
      new Error(
        `Partial settlement not supported. Expected exact amount ${settlementBasisAmount}, got ${settledAmount}`
      ),
      { code: 'PARTIAL_NOT_SUPPORTED', expected: settlementBasisAmount, got: settledAmount }
    );
  }

  const now = new Date().toISOString();
  const settlement: DriverCollectionSettlementRecord = {
    id: newId('dcs'),
    courierId: input.courierId,
    marketId: input.marketId,
    amount: settledAmount,
    deliveryFeesTotal,
    platformCommissionTotal,
    ordersCount: orderIds.length,
    orderIds,
    shiftLabel: input.shiftLabel,
    status: 'SETTLED',
    settledAt: now,
    settledBy: input.settledBy,
    settlementReference: input.settlementReference?.trim() || undefined,
    settlementNotes: input.settlementNotes?.trim() || undefined,
    createdAt: now,
    settlementMode: mode,
    cashInHandTotal,
    platformLiabilityTotal,
    restaurantLiabilityTotal,
    settlementBasisAmount,
    settledAmount,
    differenceAmount: 0,
    entryType: 'SETTLEMENT',
  };

  appendDriverCollectionSettlement(settlement);

  try {
    await prisma.driverCollectionSettlement.create({
      data: {
        id: settlement.id,
        courierId: settlement.courierId,
        marketId: settlement.marketId ?? null,
        amount: settlement.amount,
        deliveryFeesTotal: settlement.deliveryFeesTotal,
        platformCommissionTotal: settlement.platformCommissionTotal,
        ordersCount: settlement.ordersCount,
        orderIds: JSON.stringify(settlement.orderIds),
        shiftLabel: settlement.shiftLabel ?? null,
        status: settlement.status,
        settledAt: settlement.settledAt,
        settledBy: settlement.settledBy,
        settlementReference: settlement.settlementReference ?? null,
        settlementNotes: settlement.settlementNotes ?? null,
        createdAt: settlement.createdAt,
        settlementMode: settlement.settlementMode ?? 'PLATFORM_ONLY',
        cashInHandTotal: settlement.cashInHandTotal ?? 0,
        platformLiabilityTotal: settlement.platformLiabilityTotal ?? 0,
        restaurantLiabilityTotal: settlement.restaurantLiabilityTotal ?? 0,
        settlementBasisAmount: settlement.settlementBasisAmount ?? settlement.amount,
        settledAmount: settlement.settledAmount ?? settlement.amount,
        differenceAmount: settlement.differenceAmount ?? 0,
        entryType: 'SETTLEMENT',
      } as Parameters<typeof prisma.driverCollectionSettlement.create>[0]['data'],
    });
  } catch {
    // table/columns may not exist yet — store history preserved
  }

  const updatedOrders = pending.map((o, i) => {
    const a = accountings[i];
    return {
      ...o,
      driverCollectionSettlementId: settlement.id,
      settlementStatus: 'SETTLED',
      settledAt: settlement.settledAt,
      settledBy: settlement.settledBy,
      settlementReference: settlement.settlementReference,
      settlementNotes: settlement.settlementNotes,
      settlementMode: mode,
      settledAmount: a.outstandingAmount,
    };
  });

  return { settlement, updatedOrders };
}

/**
 * Append-only credit after a post-settlement refund. Never mutates prior settlement.
 */
export async function appendDriverCollectionAdjustment(input: {
  courierId: string;
  marketId?: string;
  orderId: string;
  amount: number;
  settledBy: string;
  notes?: string;
  reference?: string;
}): Promise<DriverCollectionSettlementRecord> {
  const now = new Date().toISOString();
  const credit = roundMoney(-Math.abs(input.amount));
  const entry: DriverCollectionSettlementRecord = {
    id: newId('dca'),
    courierId: input.courierId,
    marketId: input.marketId,
    amount: credit,
    deliveryFeesTotal: 0,
    platformCommissionTotal: 0,
    ordersCount: 1,
    orderIds: [input.orderId],
    status: 'SETTLED',
    settledAt: now,
    settledBy: input.settledBy,
    settlementReference: input.reference,
    settlementNotes: input.notes ?? `Post-settlement adjustment for ${input.orderId}`,
    createdAt: now,
    settlementMode: 'PLATFORM_ONLY',
    settlementBasisAmount: credit,
    settledAmount: credit,
    differenceAmount: 0,
    entryType: 'ADJUSTMENT',
  };
  appendDriverCollectionSettlement(entry);
  try {
    await prisma.driverCollectionSettlement.create({
      data: {
        id: entry.id,
        courierId: entry.courierId,
        marketId: entry.marketId ?? null,
        amount: entry.amount,
        deliveryFeesTotal: 0,
        platformCommissionTotal: 0,
        ordersCount: 1,
        orderIds: JSON.stringify(entry.orderIds),
        shiftLabel: null,
        status: 'SETTLED',
        settledAt: entry.settledAt,
        settledBy: entry.settledBy,
        settlementReference: entry.settlementReference ?? null,
        settlementNotes: entry.settlementNotes ?? null,
        createdAt: entry.createdAt,
        settlementMode: 'PLATFORM_ONLY',
        cashInHandTotal: 0,
        platformLiabilityTotal: credit,
        restaurantLiabilityTotal: 0,
        settlementBasisAmount: credit,
        settledAmount: credit,
        differenceAmount: 0,
        entryType: 'ADJUSTMENT',
      } as Parameters<typeof prisma.driverCollectionSettlement.create>[0]['data'],
    });
  } catch {
    // store only
  }
  return entry;
}
