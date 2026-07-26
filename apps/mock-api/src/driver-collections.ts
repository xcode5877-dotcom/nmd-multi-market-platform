/**
 * Driver Collections V2 — money that belongs to Now Market (not restaurant sales).
 *
 * driverCollectionAmount is derived (never stored as source of truth):
 *   External order → deliveryFee
 *   App order      → deliveryFee + platformCommission
 */

import { prisma } from './db.js';
import { extractOrderEarningsBase } from './courier-payroll.js';
import { computeOrderSettlementEconomics } from './settlement.js';
import {
  appendDriverCollectionSettlement,
  getDriverCollectionSettlements,
  type DriverCollectionSettlementRecord,
} from './store.js';

export type DriverCollectionSettlementStatus = 'PENDING' | 'SETTLED';

export type DriverOrderCollectionBreakdown = {
  orderId: string;
  courierId: string | null;
  isExternal: boolean;
  status: string;
  orderTotal: number;
  deliveryFee: number;
  platformCommission: number;
  /** Restaurant / food share (hidden from driver list accounting). */
  restaurantShare: number;
  driverCollectionAmount: number;
  settlementStatus: DriverCollectionSettlementStatus;
  settledAt?: string;
  settledBy?: string;
  settlementReference?: string;
  settlementNotes?: string;
  settlementId?: string;
  createdAt?: string;
  deliveredAt?: string;
  marketId?: string;
  shiftId?: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
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

/**
 * Canonical derived driver collection for Now Market reconciliation.
 * Never equals orderTotal for app orders with food.
 */
export function computeDriverCollectionAmount(order: Record<string, unknown>): {
  deliveryFee: number;
  platformCommission: number;
  driverCollectionAmount: number;
  restaurantShare: number;
  orderTotal: number;
  isExternal: boolean;
} {
  const isExternal = isOrderExternal(order);
  const deliveryFee = extractDeliveryFeeForCollection(order);
  const platformCommission = isExternal ? 0 : extractPlatformCommission(order);
  const orderTotal = roundMoney(
    Number(
      (order.payment as { financials?: { customerTotal?: number; gross?: number } } | undefined)
        ?.financials?.customerTotal ??
        (order.payment as { financials?: { gross?: number } } | undefined)?.financials?.gross ??
        order.total
    ) || 0
  );

  if (!isDriverCollectionCountable(order)) {
    return {
      deliveryFee: 0,
      platformCommission: 0,
      driverCollectionAmount: 0,
      restaurantShare: 0,
      orderTotal,
      isExternal,
    };
  }

  const driverCollectionAmount = isExternal
    ? deliveryFee
    : roundMoney(deliveryFee + platformCommission);
  const restaurantShare = roundMoney(Math.max(0, orderTotal - deliveryFee - platformCommission));

  return {
    deliveryFee,
    platformCommission,
    driverCollectionAmount,
    restaurantShare,
    orderTotal,
    isExternal,
  };
}

export function readOrderSettlementMeta(order: Record<string, unknown>): {
  settlementStatus: DriverCollectionSettlementStatus;
  settledAt?: string;
  settledBy?: string;
  settlementReference?: string;
  settlementNotes?: string;
  settlementId?: string;
} {
  const settlementId =
    (order.driverCollectionSettlementId as string | undefined)?.trim() ||
    (order.settlementId as string | undefined)?.trim() ||
    undefined;
  if (settlementId || String(order.settlementStatus ?? '').toUpperCase() === 'SETTLED') {
    return {
      settlementStatus: 'SETTLED',
      settledAt: order.settledAt ? String(order.settledAt) : undefined,
      settledBy: order.settledBy ? String(order.settledBy) : undefined,
      settlementReference: order.settlementReference
        ? String(order.settlementReference)
        : undefined,
      settlementNotes: order.settlementNotes ? String(order.settlementNotes) : undefined,
      settlementId,
    };
  }
  return { settlementStatus: 'PENDING' };
}

export function enrichOrderWithDriverCollection(
  order: Record<string, unknown>
): DriverOrderCollectionBreakdown {
  const money = computeDriverCollectionAmount(order);
  const meta = readOrderSettlementMeta(order);
  const timeline = order.deliveryTimeline as { deliveredAt?: string } | undefined;
  return {
    orderId: String(order.id ?? ''),
    courierId: order.courierId != null ? String(order.courierId) : null,
    isExternal: money.isExternal,
    status: String(order.status ?? ''),
    orderTotal: money.orderTotal,
    deliveryFee: money.deliveryFee,
    platformCommission: money.platformCommission,
    restaurantShare: money.restaurantShare,
    driverCollectionAmount: money.driverCollectionAmount,
    settlementStatus: meta.settlementStatus,
    settledAt: meta.settledAt,
    settledBy: meta.settledBy,
    settlementReference: meta.settlementReference,
    settlementNotes: meta.settlementNotes,
    settlementId: meta.settlementId,
    createdAt: order.createdAt ? String(order.createdAt) : undefined,
    deliveredAt: timeline?.deliveredAt ? String(timeline.deliveredAt) : undefined,
    marketId: order.marketId ? String(order.marketId) : undefined,
  };
}

export type DriverCollectionFilters = {
  from?: string;
  to?: string;
  courierId?: string;
  marketId?: string;
  settlementStatus?: 'PENDING' | 'SETTLED' | 'ALL';
  /** ISO start of active shift — only orders at/after this time. */
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
  deliveryFeesTotal: number;
  platformCommissionTotal: number;
  driverCollectionTotal: number;
  todayCollection: number;
  currentShiftCollection: number;
  outstandingCollection: number;
  settledCollection: number;
  pendingOrders: number;
  settledOrders: number;
};

export function aggregateDriverCollections(
  orders: Record<string, unknown>[],
  couriers: { id: string; name?: string; marketId?: string }[],
  opts: {
    filters: DriverCollectionFilters;
    today: string;
    shiftStartByCourier?: Map<string, string>;
  }
): DriverCollectionSummary[] {
  const byId = new Map<string, DriverCollectionSummary>();
  for (const c of couriers) {
    if (opts.filters.courierId && c.id !== opts.filters.courierId) continue;
    if (opts.filters.marketId && (c.marketId ?? '') !== opts.filters.marketId) continue;
    byId.set(c.id, {
      courierId: c.id,
      courierName: c.name ?? c.id,
      marketId: c.marketId,
      completedOrders: 0,
      externalOrders: 0,
      appOrders: 0,
      deliveryFeesTotal: 0,
      platformCommissionTotal: 0,
      driverCollectionTotal: 0,
      todayCollection: 0,
      currentShiftCollection: 0,
      outstandingCollection: 0,
      settledCollection: 0,
      pendingOrders: 0,
      settledOrders: 0,
    });
  }

  for (const order of orders) {
    if (!isDriverCollectionCountable(order)) continue;
    if (!orderMatchesCollectionFilters(order, { ...opts.filters, settlementStatus: 'ALL' })) {
      continue;
    }
    const cid = String(order.courierId);
    let row = byId.get(cid);
    if (!row) {
      row = {
        courierId: cid,
        courierName: cid,
        completedOrders: 0,
        externalOrders: 0,
        appOrders: 0,
        deliveryFeesTotal: 0,
        platformCommissionTotal: 0,
        driverCollectionTotal: 0,
        todayCollection: 0,
        currentShiftCollection: 0,
        outstandingCollection: 0,
        settledCollection: 0,
        pendingOrders: 0,
        settledOrders: 0,
      };
      byId.set(cid, row);
    }

    const b = enrichOrderWithDriverCollection(order);
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
    row.deliveryFeesTotal = roundMoney(row.deliveryFeesTotal + b.deliveryFee);
    row.platformCommissionTotal = roundMoney(
      row.platformCommissionTotal + b.platformCommission
    );
    row.driverCollectionTotal = roundMoney(
      row.driverCollectionTotal + b.driverCollectionAmount
    );

    const day = (b.deliveredAt || b.createdAt || '').slice(0, 10);
    if (day === opts.today) {
      row.todayCollection = roundMoney(row.todayCollection + b.driverCollectionAmount);
    }

    const shiftStart = opts.shiftStartByCourier?.get(cid);
    const event = b.deliveredAt || b.createdAt || '';
    if (shiftStart && event && event >= shiftStart) {
      row.currentShiftCollection = roundMoney(
        row.currentShiftCollection + b.driverCollectionAmount
      );
    }

    if (b.settlementStatus === 'SETTLED') {
      row.settledCollection = roundMoney(row.settledCollection + b.driverCollectionAmount);
      row.settledOrders += 1;
    } else {
      row.outstandingCollection = roundMoney(
        row.outstandingCollection + b.driverCollectionAmount
      );
      row.pendingOrders += 1;
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.courierName.localeCompare(b.courierName, 'ar')
  );
}

export type DriverCollectionsDashboard = {
  driverCollectionsToday: number;
  pendingCollections: number;
  settledToday: number;
  deliveryFeesToday: number;
  platformCommissionsToday: number;
};

export function computeCollectionsDashboard(
  orders: Record<string, unknown>[],
  today: string
): DriverCollectionsDashboard {
  let driverCollectionsToday = 0;
  let pendingCollections = 0;
  let settledToday = 0;
  let deliveryFeesToday = 0;
  let platformCommissionsToday = 0;

  for (const order of orders) {
    if (!isDriverCollectionCountable(order) || !order.courierId) continue;
    const b = enrichOrderWithDriverCollection(order);
    const day = (b.deliveredAt || b.createdAt || '').slice(0, 10);
    if (day === today) {
      driverCollectionsToday = roundMoney(
        driverCollectionsToday + b.driverCollectionAmount
      );
      deliveryFeesToday = roundMoney(deliveryFeesToday + b.deliveryFee);
      platformCommissionsToday = roundMoney(
        platformCommissionsToday + b.platformCommission
      );
      if (b.settlementStatus === 'SETTLED' && (b.settledAt || '').slice(0, 10) === today) {
        settledToday = roundMoney(settledToday + b.driverCollectionAmount);
      }
    }
    if (b.settlementStatus === 'PENDING') {
      pendingCollections = roundMoney(pendingCollections + b.driverCollectionAmount);
    }
  }

  return {
    driverCollectionsToday,
    pendingCollections,
    settledToday,
    deliveryFeesToday,
    platformCommissionsToday,
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
    // optional when shifts table unavailable
  }
  return map;
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
    rows = dbRows.map((r) => ({
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
    }));
  } catch {
    rows = getDriverCollectionSettlements();
  }

  // Merge store-only rows (never delete)
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

export async function createDriverCollectionSettlement(input: {
  courierId: string;
  marketId?: string;
  orders: Record<string, unknown>[];
  settledBy: string;
  settlementReference?: string;
  settlementNotes?: string;
  shiftLabel?: string;
}): Promise<{
  settlement: DriverCollectionSettlementRecord;
  updatedOrders: Record<string, unknown>[];
}> {
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

  let deliveryFeesTotal = 0;
  let platformCommissionTotal = 0;
  let amount = 0;
  const orderIds: string[] = [];
  for (const o of pending) {
    const b = enrichOrderWithDriverCollection(o);
    deliveryFeesTotal = roundMoney(deliveryFeesTotal + b.deliveryFee);
    platformCommissionTotal = roundMoney(platformCommissionTotal + b.platformCommission);
    amount = roundMoney(amount + b.driverCollectionAmount);
    orderIds.push(b.orderId);
  }

  const now = new Date().toISOString();
  const settlement: DriverCollectionSettlementRecord = {
    id: newId('dcs'),
    courierId: input.courierId,
    marketId: input.marketId,
    amount,
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
  };

  // Append-only: store always (never delete)
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
      },
    });
  } catch {
    // Prisma table may not exist yet — store history still preserved
  }

  const updatedOrders = pending.map((o) => ({
    ...o,
    driverCollectionSettlementId: settlement.id,
    settlementStatus: 'SETTLED',
    settledAt: settlement.settledAt,
    settledBy: settlement.settledBy,
    settlementReference: settlement.settlementReference,
    settlementNotes: settlement.settlementNotes,
  }));

  return { settlement, updatedOrders };
}
