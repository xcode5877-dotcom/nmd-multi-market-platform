/**
 * Store settlement — order snapshots, ledger posting, reports.
 * Pickup cash → store debt; delivery cash → platform collected; online → merchant liability.
 */

import {
  ceilShekel,
  roundMoney,
  type MarketplacePricingContext,
  computeMarketplaceDisplayPricing,
} from './platform-fee.js';
import { prisma } from './db.js';

export type SettlementClass = 'PICKUP_CASH' | 'DELIVERY_CASH' | 'ONLINE_PLATFORM';

export type OrderSettlementSnapshot = {
  settlementClass: SettlementClass;
  customerSales: number;
  merchantBaseSubtotal: number;
  platformCommission: number;
  deliveryFee: number;
  customerGrandTotal: number;
  merchantPayout: number;
  pickupCommissionDebt: number;
  deliveryCommissionCollected: number;
  merchantLiability: number;
  postedAt?: string;
  ledgerPosted?: boolean;
};

export type SettlementLedgerEntryType =
  | 'PICKUP_COMMISSION_DEBIT'
  | 'STORE_PAYMENT_CREDIT'
  | 'DELIVERY_COMMISSION_COLLECTED'
  | 'ONLINE_COMMISSION_COLLECTED'
  | 'MERCHANT_PAYOUT_LIABILITY'
  | 'PLATFORM_TO_STORE_PAYMENT'
  | 'ADJUSTMENT';

export type SettlementPaymentDirection = 'STORE_TO_PLATFORM' | 'PLATFORM_TO_STORE';

export function classifySettlement(
  fulfillmentType: string | undefined,
  paymentMethod: string | undefined
): SettlementClass {
  const method = String(paymentMethod ?? 'CASH').toUpperCase();
  if (method === 'CARD' || method === 'ONLINE' || method === 'VISA') {
    return 'ONLINE_PLATFORM';
  }
  const ft = String(fulfillmentType ?? 'DELIVERY').toUpperCase();
  if (ft === 'PICKUP') return 'PICKUP_CASH';
  return 'DELIVERY_CASH';
}

export function buildSettlementSnapshot(input: {
  settlementClass: SettlementClass;
  merchantBaseSubtotal: number;
  platformCommission: number;
  deliveryFee: number;
  customerGrandTotal: number;
  merchantPayout: number;
}): OrderSettlementSnapshot {
  const {
    settlementClass,
    merchantBaseSubtotal,
    platformCommission,
    deliveryFee,
    customerGrandTotal,
    merchantPayout,
  } = input;
  const commission = roundMoney(Math.max(0, platformCommission));
  const base: OrderSettlementSnapshot = {
    settlementClass,
    customerSales: roundMoney(customerGrandTotal),
    merchantBaseSubtotal: roundMoney(merchantBaseSubtotal),
    platformCommission: commission,
    deliveryFee: roundMoney(Math.max(0, deliveryFee)),
    customerGrandTotal: roundMoney(customerGrandTotal),
    merchantPayout: roundMoney(merchantPayout),
    pickupCommissionDebt: 0,
    deliveryCommissionCollected: 0,
    merchantLiability: 0,
  };
  switch (settlementClass) {
    case 'PICKUP_CASH':
      return { ...base, pickupCommissionDebt: commission };
    case 'DELIVERY_CASH':
      return { ...base, deliveryCommissionCollected: commission };
    case 'ONLINE_PLATFORM':
      return {
        ...base,
        deliveryCommissionCollected: commission,
        merchantLiability: roundMoney(merchantPayout),
      };
    default:
      return base;
  }
}

/** Build economics from order fields + optional category exemption map for recomputation. */
export function computeOrderSettlementEconomics(
  order: Record<string, unknown>,
  pricingCtx: MarketplacePricingContext,
  categoryExemptById: Map<string, boolean>,
  productCategoryById: Map<string, string>
): {
  merchantBaseSubtotal: number;
  platformCommission: number;
  deliveryFee: number;
  customerGrandTotal: number;
  merchantPayout: number;
} {
  const items = (Array.isArray(order.items) ? order.items : []) as {
    productId?: string;
    categoryId?: string;
    totalPrice?: number;
    quantity?: number;
  }[];
  const discountAmount = roundMoney(
    Math.max(0, Number(order.discountAmount ?? (order as { couponDiscountAmount?: number }).couponDiscountAmount) || 0)
  );
  const deliveryFee = roundMoney(
    Math.max(
      0,
      Number(order.platformDeliveryFee) ||
        Number((order.delivery as { fee?: number } | undefined)?.fee) ||
        0
    )
  );

  const storedPlatformFee = Number(order.platformFee);
  const storedMerchantPayout = Number(order.merchantPayout ?? order.merchantAmount);
  const storedCustomerTotal = Number(order.customerTotal ?? order.total);

  if (
    Number.isFinite(storedPlatformFee) &&
    Number.isFinite(storedMerchantPayout) &&
    storedMerchantPayout > 0
  ) {
    return {
      merchantBaseSubtotal: roundMoney(storedMerchantPayout),
      platformCommission: roundMoney(Math.max(0, storedPlatformFee)),
      deliveryFee,
      customerGrandTotal: roundMoney(
        storedCustomerTotal || storedMerchantPayout + storedPlatformFee + deliveryFee - discountAmount
      ),
      merchantPayout: roundMoney(storedMerchantPayout),
    };
  }

  const lines = items.map((item, idx) => {
    const baseAmount = roundMoney(Number(item.totalPrice) || 0);
    const qty = Math.max(1, Number(item.quantity) || 1);
    const catId =
      item.categoryId ||
      (item.productId ? productCategoryById.get(String(item.productId)) : undefined);
    const markupExempt = catId ? categoryExemptById.get(String(catId)) === true : false;
    return {
      lineId: String(idx),
      baseAmount,
      quantity: qty,
      itemCount: qty,
      markupExempt,
      categoryId: catId,
    };
  });

  const display = computeMarketplaceDisplayPricing(lines, pricingCtx, { discountAmount });
  const customerMerchandise = display.displayMerchandiseTotal;
  const customerGrandTotal = ceilShekel(customerMerchandise + deliveryFee);

  return {
    merchantBaseSubtotal: display.merchantPayout,
    platformCommission: display.platformFee,
    deliveryFee,
    customerGrandTotal,
    merchantPayout: display.merchantPayout,
  };
}

export function isSettlementEligibleStatus(status: string | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  return s === 'COMPLETED' || s === 'DELIVERED';
}

export async function findExistingLedgerEntry(
  orderId: string,
  entryType: SettlementLedgerEntryType
): Promise<boolean> {
  const existing = await prisma.storeSettlementLedgerEntry.findFirst({
    where: { orderId, entryType },
  });
  return existing != null;
}

export async function appendLedgerEntry(input: {
  tenantId: string;
  marketId?: string;
  orderId?: string;
  entryType: SettlementLedgerEntryType;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  occurredAt: string;
  createdBy?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const id = crypto.randomUUID?.() ?? `led-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await prisma.storeSettlementLedgerEntry.create({
    data: {
      id,
      tenantId: input.tenantId,
      marketId: input.marketId ?? null,
      orderId: input.orderId ?? null,
      entryType: input.entryType,
      direction: input.direction,
      amount: roundMoney(Math.max(0, input.amount)),
      currency: 'ILS',
      occurredAt: input.occurredAt,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy ?? null,
      note: input.note ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
  return id;
}

/** Post ledger entries for a completed order (idempotent). Mutates order with settlement snapshot. */
export async function postOrderSettlement(
  order: Record<string, unknown>,
  pricingCtx: MarketplacePricingContext,
  categoryExemptById: Map<string, boolean>,
  productCategoryById: Map<string, string>
): Promise<Record<string, unknown>> {
  const status = String(order.status ?? '');
  if (!isSettlementEligibleStatus(status)) return order;

  const existing = order.settlement as OrderSettlementSnapshot | undefined;
  if (existing?.ledgerPosted) return order;

  const tenantId = String(order.tenantId ?? '');
  if (!tenantId) return order;

  const paymentMethod =
    String((order.payment as { method?: string } | undefined)?.method ?? order.paymentMethod ?? 'CASH');
  const settlementClass = classifySettlement(
    String(order.fulfillmentType ?? ''),
    paymentMethod
  );

  const econ = computeOrderSettlementEconomics(
    order,
    pricingCtx,
    categoryExemptById,
    productCategoryById
  );
  const snapshot = buildSettlementSnapshot({
    settlementClass,
    ...econ,
  });
  snapshot.postedAt = new Date().toISOString();

  const marketId = order.marketId ? String(order.marketId) : undefined;
  const orderId = order.id ? String(order.id) : undefined;
  const occurredAt = String(order.createdAt ?? snapshot.postedAt);

  if (orderId) {
    if (settlementClass === 'PICKUP_CASH' && snapshot.pickupCommissionDebt > 0) {
      const dup = await findExistingLedgerEntry(orderId, 'PICKUP_COMMISSION_DEBIT');
      if (!dup) {
        await appendLedgerEntry({
          tenantId,
          marketId,
          orderId,
          entryType: 'PICKUP_COMMISSION_DEBIT',
          direction: 'DEBIT',
          amount: snapshot.pickupCommissionDebt,
          occurredAt,
          metadata: { settlementClass, orderId },
        });
      }
    }
    if (settlementClass === 'DELIVERY_CASH' && snapshot.deliveryCommissionCollected > 0) {
      const dup = await findExistingLedgerEntry(orderId, 'DELIVERY_COMMISSION_COLLECTED');
      if (!dup) {
        await appendLedgerEntry({
          tenantId,
          marketId,
          orderId,
          entryType: 'DELIVERY_COMMISSION_COLLECTED',
          direction: 'CREDIT',
          amount: snapshot.deliveryCommissionCollected,
          occurredAt,
          metadata: { settlementClass, orderId },
        });
      }
    }
    if (settlementClass === 'ONLINE_PLATFORM') {
      if (snapshot.deliveryCommissionCollected > 0) {
        const dup = await findExistingLedgerEntry(orderId, 'ONLINE_COMMISSION_COLLECTED');
        if (!dup) {
          await appendLedgerEntry({
            tenantId,
            marketId,
            orderId,
            entryType: 'ONLINE_COMMISSION_COLLECTED',
            direction: 'CREDIT',
            amount: snapshot.deliveryCommissionCollected,
            occurredAt,
            metadata: { settlementClass, orderId },
          });
        }
      }
      if (snapshot.merchantLiability > 0) {
        const dup = await findExistingLedgerEntry(orderId, 'MERCHANT_PAYOUT_LIABILITY');
        if (!dup) {
          await appendLedgerEntry({
            tenantId,
            marketId,
            orderId,
            entryType: 'MERCHANT_PAYOUT_LIABILITY',
            direction: 'DEBIT',
            amount: snapshot.merchantLiability,
            occurredAt,
            metadata: { settlementClass, orderId, liability: true },
          });
        }
      }
    }
  }

  snapshot.ledgerPosted = true;
  return { ...order, settlement: snapshot };
}

export type SettlementReport = {
  tenantId: string;
  period: { from: string; to: string };
  totalCustomerSales: number;
  merchantBaseSubtotal: number;
  platformCommission: number;
  deliveryFees: number;
  pickupCommissionOwedByStore: number;
  deliveryCommissionCollected: number;
  storePaymentsToPlatform: number;
  platformPaymentsToStore: number;
  remainingStoreBalance: number;
  merchantLiability: number;
  orderCount: number;
};

function parseDateMs(iso: string | undefined, endOfDay: boolean): number {
  if (!iso) return endOfDay ? Number.MAX_SAFE_INTEGER : 0;
  const d = new Date(iso);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function computeSettlementReport(
  tenantId: string,
  from: string,
  to: string,
  orders: Record<string, unknown>[]
): Promise<SettlementReport> {
  const fromMs = parseDateMs(from, false);
  const toMs = parseDateMs(to, true);

  let totalCustomerSales = 0;
  let merchantBaseSubtotal = 0;
  let platformCommission = 0;
  let deliveryFees = 0;
  let pickupCommissionOwedByStore = 0;
  let deliveryCommissionCollected = 0;
  let merchantLiability = 0;
  let orderCount = 0;

  for (const o of orders) {
    if (String(o.tenantId) !== tenantId) continue;
    const t = o.createdAt ? new Date(String(o.createdAt)).getTime() : 0;
    if (t < fromMs || t > toMs) continue;
    if (!isSettlementEligibleStatus(String(o.status))) continue;
    const snap = o.settlement as OrderSettlementSnapshot | undefined;
    if (!snap) continue;
    orderCount++;
    totalCustomerSales += snap.customerGrandTotal;
    merchantBaseSubtotal += snap.merchantBaseSubtotal;
    platformCommission += snap.platformCommission;
    deliveryFees += snap.deliveryFee;
    pickupCommissionOwedByStore += snap.pickupCommissionDebt;
    deliveryCommissionCollected += snap.deliveryCommissionCollected;
    merchantLiability += snap.merchantLiability;
  }

  const ledger = await prisma.storeSettlementLedgerEntry.findMany({
    where: {
      tenantId,
      occurredAt: { gte: from, lte: to + 'T23:59:59.999Z' },
    },
  });

  const payments = await prisma.storeSettlementPayment.findMany({
    where: {
      tenantId,
      paidAt: { gte: from, lte: to + 'T23:59:59.999Z' },
    },
  });

  let storePaymentsToPlatform = 0;
  let platformPaymentsToStore = 0;
  for (const p of payments) {
    if (p.direction === 'STORE_TO_PLATFORM') storePaymentsToPlatform += p.amount;
    else if (p.direction === 'PLATFORM_TO_STORE') platformPaymentsToStore += p.amount;
  }

  const allTimeDebits = await prisma.storeSettlementLedgerEntry.aggregate({
    where: { tenantId, entryType: 'PICKUP_COMMISSION_DEBIT' },
    _sum: { amount: true },
  });
  const allTimeCredits = await prisma.storeSettlementPayment.aggregate({
    where: { tenantId, direction: 'STORE_TO_PLATFORM' },
    _sum: { amount: true },
  });
  const allTimePlatformToStore = await prisma.storeSettlementPayment.aggregate({
    where: { tenantId, direction: 'PLATFORM_TO_STORE' },
    _sum: { amount: true },
  });
  const allTimeMerchantLiab = await prisma.storeSettlementLedgerEntry.aggregate({
    where: { tenantId, entryType: 'MERCHANT_PAYOUT_LIABILITY' },
    _sum: { amount: true },
  });

  const totalPickupDebt = allTimeDebits._sum.amount ?? 0;
  const totalStorePaid = allTimeCredits._sum.amount ?? 0;
  const remainingStoreBalance = roundMoney(Math.max(0, totalPickupDebt - totalStorePaid));
  const netMerchantLiability = roundMoney(
    Math.max(0, (allTimeMerchantLiab._sum.amount ?? 0) - (allTimePlatformToStore._sum.amount ?? 0))
  );

  return {
    tenantId,
    period: { from, to },
    totalCustomerSales: roundMoney(totalCustomerSales),
    merchantBaseSubtotal: roundMoney(merchantBaseSubtotal),
    platformCommission: roundMoney(platformCommission),
    deliveryFees: roundMoney(deliveryFees),
    pickupCommissionOwedByStore: roundMoney(pickupCommissionOwedByStore),
    deliveryCommissionCollected: roundMoney(deliveryCommissionCollected),
    storePaymentsToPlatform: roundMoney(storePaymentsToPlatform),
    platformPaymentsToStore: roundMoney(platformPaymentsToStore),
    remainingStoreBalance,
    merchantLiability: netMerchantLiability,
    orderCount,
  };
}

export async function recordManualSettlementPayment(input: {
  tenantId: string;
  amount: number;
  paidAt: string;
  paymentMethod: string;
  note?: string;
  createdBy?: string;
  direction: SettlementPaymentDirection;
  periodFrom?: string;
  periodTo?: string;
}): Promise<{ paymentId: string; ledgerEntryId: string }> {
  const paymentId = crypto.randomUUID?.() ?? `pay-${Date.now()}`;
  const amount = roundMoney(Math.max(0, input.amount));
  const entryType: SettlementLedgerEntryType =
    input.direction === 'STORE_TO_PLATFORM' ? 'STORE_PAYMENT_CREDIT' : 'PLATFORM_TO_STORE_PAYMENT';
  const direction = input.direction === 'STORE_TO_PLATFORM' ? 'CREDIT' : 'DEBIT';

  const ledgerEntryId = await appendLedgerEntry({
    tenantId: input.tenantId,
    entryType,
    direction: direction as 'DEBIT' | 'CREDIT',
    amount,
    occurredAt: input.paidAt,
    createdBy: input.createdBy,
    note: input.note,
    metadata: { manual: true, direction: input.direction },
  });

  await prisma.storeSettlementPayment.create({
    data: {
      id: paymentId,
      tenantId: input.tenantId,
      amount,
      paidAt: input.paidAt,
      paymentMethod: input.paymentMethod,
      note: input.note ?? null,
      createdBy: input.createdBy ?? null,
      direction: input.direction,
      periodFrom: input.periodFrom ?? null,
      periodTo: input.periodTo ?? null,
      ledgerEntryId,
      createdAt: new Date().toISOString(),
    },
  });

  return { paymentId, ledgerEntryId };
}

export function dateRangePreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (preset === 'today') {
    return { from: to, to };
  }
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to };
  }
  if (preset === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: d.toISOString().slice(0, 10), to };
  }
  return { from: to, to };
}
