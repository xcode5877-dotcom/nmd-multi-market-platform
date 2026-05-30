/**
 * Marketplace economics — read-only operational intelligence (Phase 3 V1).
 * Frontend aggregation + formula-based estimates. Not accounting.
 */

import {
  classifyFeeSource,
  computePlatformFeePreview,
  roundMoney,
  type FeeSourceCategory,
  type PlatformFeeConfig,
  type TenantPlatformFeeOverride,
} from './platform-fee';

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';

export type EconomicsSettings = {
  /** Estimated Hyp/card gateway % (default 2.8%) */
  gatewayPct: number;
  /** Estimated courier cost per delivery order (₪) */
  avgDeliveryCost: number;
  /** Simulation-only fee params when projecting global scenario */
  simPercentage: number;
  simMinFee: number;
  simMaxFee: number;
  simFixedFee: number;
};

export const DEFAULT_ECONOMICS_SETTINGS: EconomicsSettings = {
  gatewayPct: 2.8,
  avgDeliveryCost: 15,
  simPercentage: 4,
  simMinFee: 2.5,
  simMaxFee: 12,
  simFixedFee: 0,
};

export type RawOrder = {
  id?: string;
  tenantId?: string;
  marketId?: string;
  status?: string;
  createdAt?: string;
  subtotal?: number;
  total?: number;
  discountAmount?: number;
  platformFee?: number;
  merchantPayout?: number;
  customerTotal?: number;
  paymentMethod?: string;
  items?: { quantity?: number; totalPrice?: number }[];
  delivery?: { fee?: number };
  payment?: {
    method?: string;
    breakdown?: {
      itemsTotal?: number;
      deliveryFee?: number;
      discountAmount?: number;
      platformFee?: number;
      customerTotal?: number;
    };
    financials?: {
      gross?: number;
      platformFee?: number;
      commission?: number;
      gatewayFee?: number;
      merchantPayout?: number;
      customerTotal?: number;
    };
  };
};

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  marketId?: string;
  marketName?: string;
  marketFeeConfig?: PlatformFeeConfig | null;
  tenantFeeOverride?: TenantPlatformFeeOverride | null;
  deliveryFeeModel?: 'MARKET' | 'TENANT';
};

export type NormalizedOrder = {
  id: string;
  tenantId: string;
  marketId?: string;
  createdAt: string;
  status: string;
  paymentMethod: 'CASH' | 'CARD';
  itemsSubtotal: number;
  discountAmount: number;
  deliveryFee: number;
  itemCount: number;
  gmv: number;
  actualPlatformFee: number;
  projectedPlatformFee: number;
  gatewayFeeEstimate: number;
  deliveryRevenue: number;
  deliveryCostEstimate: number;
  deliveryMargin: number;
  feeSource: FeeSourceCategory;
  cancelled: boolean;
};

export type OverviewMetrics = {
  gmv: number;
  orderCount: number;
  avgOrderValue: number;
  deliveryRevenue: number;
  couponExposure: number;
  cashOrders: number;
  cardOrders: number;
  cashGmv: number;
  cardGmv: number;
  cashRatio: number;
  configuredPlatformRevenue: number;
  actualPlatformRevenue: number;
  gatewayCostEstimate: number;
  deliveryMarginTotal: number;
  operationalAllocation: number;
  estimatedNetContribution: number;
  estimatedBurn: number;
};

export type UnitEconomics = {
  avgProjectedPlatformRevenue: number;
  avgGatewayCost: number;
  avgDeliveryCost: number;
  avgCouponCost: number;
  avgOperationalAllocation: number;
  avgContributionPerOrder: number;
};

export type MarketEconomicsRow = {
  marketId: string;
  marketName: string;
  gmv: number;
  orderCount: number;
  avgOrder: number;
  projectedRevenue: number;
  couponExposure: number;
  estimatedContribution: number;
};

export type StoreProfitabilityClass =
  | 'profitable'
  | 'stable'
  | 'subsidized'
  | 'risky'
  | 'exempt'
  | 'vip'
  | 'inactive';

export const STORE_CLASS_LABELS: Record<StoreProfitabilityClass, string> = {
  profitable: 'مربح',
  stable: 'مستقر',
  subsidized: 'مدعوم',
  risky: 'خطر',
  exempt: 'معفى',
  vip: 'VIP',
  inactive: 'غير مفعل',
};

export const STORE_CLASS_BADGE: Record<
  StoreProfitabilityClass,
  { variant: 'default' | 'primary' | 'warning' | 'error'; className?: string }
> = {
  profitable: { variant: 'primary', className: 'bg-emerald-100 text-emerald-800' },
  stable: { variant: 'default', className: 'bg-sky-100 text-sky-800' },
  subsidized: { variant: 'warning' },
  risky: { variant: 'error' },
  exempt: { variant: 'warning', className: 'bg-amber-100 text-amber-800' },
  vip: { variant: 'default', className: 'bg-violet-100 text-violet-800' },
  inactive: { variant: 'error', className: 'bg-gray-100 text-gray-600' },
};

export type StoreEconomicsRow = {
  tenantId: string;
  tenantName: string;
  marketId?: string;
  marketName?: string;
  gmv: number;
  orderCount: number;
  avgBasket: number;
  projectedFeeRevenue: number;
  couponExposure: number;
  gatewayExposure: number;
  cardRatio: number;
  estimatedContribution: number;
  contributionPerOrder: number;
  feeSource: FeeSourceCategory;
  classification: StoreProfitabilityClass;
};

export type PaymentAnalytics = {
  cashOrders: number;
  cardOrders: number;
  cashGmv: number;
  cardGmv: number;
  avgCashTicket: number;
  avgCardTicket: number;
  estimatedGatewayCosts: number;
  smallCardOrders: number;
  smallCardGmv: number;
};

export type ProfitabilityEstimates = {
  burnRateMonthly: number;
  breakEvenOrdersPerMonth: number;
  projectedMarginPct: number;
  projectedContributionPct: number;
  periodNetContribution: number;
  periodDays: number;
};

export type SimulationInput = {
  percentageFee: number;
  minFee: number;
  maxFee: number;
  fixedFee: number;
  gatewayPct: number;
  avgDeliveryCost: number;
  monthlyOperationalCosts: number;
  /** Orders/month basis for projection */
  ordersPerMonth: number;
  avgOrderValue: number;
  avgDeliveryFee: number;
  cardOrderRatio: number;
  couponRatePct: number;
};

export type SimulationOutput = {
  projectedMonthlyPlatformRevenue: number;
  projectedMonthlyDeliveryMargin: number;
  projectedMonthlyGatewayCost: number;
  projectedMonthlyCouponCost: number;
  projectedMonthlyContribution: number;
  projectedProfitLoss: number;
  breakEvenOrdersPerMonth: number;
  contributionPerOrder: number;
};

function safeNum(v: unknown): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

function parsePaymentMethod(order: RawOrder): 'CASH' | 'CARD' {
  const m = order.payment?.method ?? order.paymentMethod ?? 'CASH';
  return m === 'CARD' ? 'CARD' : 'CASH';
}

function isCancelled(status?: string): boolean {
  return status === 'CANCELLED';
}

export function getDateRange(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string
): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  if (preset === 'today') return { from, to };

  if (preset === '7d') {
    from.setDate(from.getDate() - 6);
    return { from, to };
  }

  if (preset === '30d') {
    from.setDate(from.getDate() - 29);
    return { from, to };
  }

  if (customFrom) {
    const f = new Date(customFrom);
    f.setHours(0, 0, 0, 0);
    from.setTime(f.getTime());
  }
  if (customTo) {
    const t = new Date(customTo);
    t.setHours(23, 59, 59, 999);
    to.setTime(t.getTime());
  }
  return { from, to };
}

export function filterOrdersByRange(orders: RawOrder[], from: Date, to: Date): RawOrder[] {
  return orders.filter((o) => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt);
    return d >= from && d <= to;
  });
}

export function buildTenantContextMap(
  tenants: {
    id: string;
    name: string;
    marketId?: string;
    financialConfig?: {
      deliveryFeeModel?: 'MARKET' | 'TENANT';
      platformFee?: TenantPlatformFeeOverride;
    };
  }[],
  markets: { id: string; name: string; platformFeeConfig?: PlatformFeeConfig }[]
): Map<string, TenantContext> {
  const marketById = new Map(markets.map((m) => [m.id, m]));
  const map = new Map<string, TenantContext>();
  for (const t of tenants) {
    const market = t.marketId ? marketById.get(t.marketId) : undefined;
    map.set(t.id, {
      tenantId: t.id,
      tenantName: t.name,
      marketId: t.marketId,
      marketName: market?.name,
      marketFeeConfig: market?.platformFeeConfig,
      tenantFeeOverride: t.financialConfig?.platformFee,
      deliveryFeeModel: t.financialConfig?.deliveryFeeModel ?? 'TENANT',
    });
  }
  return map;
}

/** Normalize one order for economics aggregation. */
export function normalizeOrder(order: RawOrder, ctx: TenantContext | undefined, settings: EconomicsSettings): NormalizedOrder {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.reduce((s, i) => s + Math.max(0, Math.floor(safeNum(i.quantity) || 1)), 0);
  const itemsSum = items.reduce((s, i) => s + safeNum(i.totalPrice), 0);
  const itemsSubtotal = safeNum(order.payment?.breakdown?.itemsTotal) || safeNum(order.subtotal) || itemsSum;
  const discountAmount =
    safeNum(order.payment?.breakdown?.discountAmount) || safeNum(order.discountAmount) || 0;
  const deliveryFee = safeNum(order.payment?.breakdown?.deliveryFee) || safeNum(order.delivery?.fee) || 0;
  const gmv =
    safeNum(order.payment?.financials?.customerTotal) ||
    safeNum(order.payment?.financials?.gross) ||
    safeNum(order.customerTotal) ||
    safeNum(order.total) ||
    roundMoney(itemsSubtotal - discountAmount + deliveryFee);

  const actualPlatformFee =
    safeNum(order.payment?.financials?.platformFee) ||
    safeNum(order.payment?.breakdown?.platformFee) ||
    safeNum(order.platformFee) ||
    0;

  const feePreview = computePlatformFeePreview({
    itemsSubtotal,
    discountAmount,
    itemCount: Math.max(itemCount, 1),
    deliveryFee,
    marketFeeConfig: ctx?.marketFeeConfig,
    tenantFeeOverride: ctx?.tenantFeeOverride,
    simulateOrdersEnabled: true,
  });

  const paymentMethod = parsePaymentMethod(order);
  const gatewayFeeEstimate =
    paymentMethod === 'CARD'
      ? roundMoney(gmv * (settings.gatewayPct / 100))
      : safeNum(order.payment?.financials?.gatewayFee);

  const isMarketDelivery = ctx?.deliveryFeeModel === 'MARKET';
  const deliveryRevenue = isMarketDelivery ? deliveryFee : 0;
  const deliveryCostEstimate = deliveryFee > 0 ? settings.avgDeliveryCost : 0;
  const deliveryMargin = isMarketDelivery ? roundMoney(deliveryRevenue - deliveryCostEstimate) : 0;

  const feeSource = classifyFeeSource(ctx?.marketFeeConfig, ctx?.tenantFeeOverride);

  return {
    id: order.id ?? '',
    tenantId: order.tenantId ?? '',
    marketId: order.marketId ?? ctx?.marketId,
    createdAt: order.createdAt ?? '',
    status: order.status ?? 'PENDING',
    paymentMethod,
    itemsSubtotal,
    discountAmount,
    deliveryFee,
    itemCount: Math.max(itemCount, 1),
    gmv,
    actualPlatformFee,
    projectedPlatformFee: feePreview.platformFee,
    gatewayFeeEstimate,
    deliveryRevenue,
    deliveryCostEstimate,
    deliveryMargin,
    feeSource,
    cancelled: isCancelled(order.status),
  };
}

export function normalizeOrders(
  orders: RawOrder[],
  tenantCtx: Map<string, TenantContext>,
  settings: EconomicsSettings
): NormalizedOrder[] {
  return orders
    .filter((o) => o.tenantId && !isCancelled(o.status))
    .map((o) => normalizeOrder(o, tenantCtx.get(o.tenantId!), settings));
}

/** Pro-rate monthly ops costs to the selected period. */
export function operationalAllocationForPeriod(monthlyTotal: number, from: Date, to: Date): number {
  const msPerDay = 86400000;
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / msPerDay));
  return roundMoney((monthlyTotal / 30) * days);
}

export function computeOverviewMetrics(
  normalized: NormalizedOrder[],
  monthlyOperationalCosts: number,
  from: Date,
  to: Date
): OverviewMetrics {
  const active = normalized.filter((o) => !o.cancelled);
  const orderCount = active.length;
  const gmv = roundMoney(active.reduce((s, o) => s + o.gmv, 0));
  const deliveryRevenue = roundMoney(active.reduce((s, o) => s + o.deliveryRevenue, 0));
  const couponExposure = roundMoney(active.reduce((s, o) => s + o.discountAmount, 0));
  const cashOrders = active.filter((o) => o.paymentMethod === 'CASH').length;
  const cardOrders = active.filter((o) => o.paymentMethod === 'CARD').length;
  const cashGmv = roundMoney(active.filter((o) => o.paymentMethod === 'CASH').reduce((s, o) => s + o.gmv, 0));
  const cardGmv = roundMoney(active.filter((o) => o.paymentMethod === 'CARD').reduce((s, o) => s + o.gmv, 0));
  const configuredPlatformRevenue = roundMoney(active.reduce((s, o) => s + o.projectedPlatformFee, 0));
  const actualPlatformRevenue = roundMoney(active.reduce((s, o) => s + o.actualPlatformFee, 0));
  const gatewayCostEstimate = roundMoney(active.reduce((s, o) => s + o.gatewayFeeEstimate, 0));
  const deliveryMarginTotal = roundMoney(active.reduce((s, o) => s + o.deliveryMargin, 0));
  const operationalAllocation = operationalAllocationForPeriod(monthlyOperationalCosts, from, to);

  const estimatedNetContribution = roundMoney(
    configuredPlatformRevenue + deliveryMarginTotal - gatewayCostEstimate - couponExposure - operationalAllocation
  );
  const estimatedBurn = roundMoney(Math.max(0, -estimatedNetContribution));

  return {
    gmv,
    orderCount,
    avgOrderValue: orderCount > 0 ? roundMoney(gmv / orderCount) : 0,
    deliveryRevenue,
    couponExposure,
    cashOrders,
    cardOrders,
    cashGmv,
    cardGmv,
    cashRatio: orderCount > 0 ? cashOrders / orderCount : 0,
    configuredPlatformRevenue,
    actualPlatformRevenue,
    gatewayCostEstimate,
    deliveryMarginTotal,
    operationalAllocation,
    estimatedNetContribution,
    estimatedBurn,
  };
}

export function computeUnitEconomics(
  overview: OverviewMetrics,
  normalized: NormalizedOrder[]
): UnitEconomics {
  const n = overview.orderCount || 1;
  const deliveryCostTotal = roundMoney(normalized.reduce((s, o) => s + o.deliveryCostEstimate, 0));
  return {
    avgProjectedPlatformRevenue: roundMoney(overview.configuredPlatformRevenue / n),
    avgGatewayCost: roundMoney(overview.gatewayCostEstimate / n),
    avgDeliveryCost: roundMoney(deliveryCostTotal / n),
    avgCouponCost: roundMoney(overview.couponExposure / n),
    avgOperationalAllocation: roundMoney(overview.operationalAllocation / n),
    avgContributionPerOrder: roundMoney(overview.estimatedNetContribution / n),
  };
}

export function computeMarketRows(
  normalized: NormalizedOrder[],
  markets: { id: string; name: string }[]
): MarketEconomicsRow[] {
  const marketNames = new Map(markets.map((m) => [m.id, m.name]));
  const byMarket = new Map<string, NormalizedOrder[]>();

  for (const o of normalized) {
    const mid = o.marketId ?? '_unknown';
    if (!byMarket.has(mid)) byMarket.set(mid, []);
    byMarket.get(mid)!.push(o);
  }

  const rows: MarketEconomicsRow[] = [];
  for (const [marketId, orders] of byMarket) {
    const gmv = roundMoney(orders.reduce((s, o) => s + o.gmv, 0));
    const orderCount = orders.length;
    rows.push({
      marketId,
      marketName: marketId === '_unknown' ? 'غير محدد' : marketNames.get(marketId) ?? marketId,
      gmv,
      orderCount,
      avgOrder: orderCount > 0 ? roundMoney(gmv / orderCount) : 0,
      projectedRevenue: roundMoney(orders.reduce((s, o) => s + o.projectedPlatformFee, 0)),
      couponExposure: roundMoney(orders.reduce((s, o) => s + o.discountAmount, 0)),
      estimatedContribution: roundMoney(
        orders.reduce(
          (s, o) => s + o.projectedPlatformFee + o.deliveryMargin - o.gatewayFeeEstimate - o.discountAmount,
          0
        )
      ),
    });
  }
  return rows.sort((a, b) => b.gmv - a.gmv);
}

function classifyStore(
  row: Omit<StoreEconomicsRow, 'classification' | 'contributionPerOrder'>,
  marketAvgProjectedRate: number
): StoreProfitabilityClass {
  if (row.feeSource === 'EXEMPT') return 'exempt';
  if (row.feeSource === 'INACTIVE') return 'inactive';
  if (row.orderCount === 0) return 'inactive';

  const contribPerOrder = row.estimatedContribution / row.orderCount;
  const projectedRate = row.gmv > 0 ? row.projectedFeeRevenue / row.gmv : 0;

  if (row.feeSource === 'TENANT' && projectedRate < marketAvgProjectedRate * 0.7) return 'vip';
  if (contribPerOrder >= 4) return 'profitable';
  if (contribPerOrder >= 0) return 'stable';
  if (row.avgBasket < 60 && row.cardRatio > 0.45) return 'risky';
  if (row.couponExposure / Math.max(row.gmv, 1) > 0.12) return 'subsidized';
  return 'subsidized';
}

export function computeStoreRows(
  normalized: NormalizedOrder[],
  tenantCtx: Map<string, TenantContext>
): StoreEconomicsRow[] {
  const byTenant = new Map<string, NormalizedOrder[]>();
  for (const o of normalized) {
    if (!o.tenantId) continue;
    if (!byTenant.has(o.tenantId)) byTenant.set(o.tenantId, []);
    byTenant.get(o.tenantId)!.push(o);
  }

  const draft: Omit<StoreEconomicsRow, 'classification' | 'contributionPerOrder'>[] = [];
  for (const [tenantId, orders] of byTenant) {
    const ctx = tenantCtx.get(tenantId);
    const gmv = roundMoney(orders.reduce((s, o) => s + o.gmv, 0));
    const orderCount = orders.length;
    const cardOrders = orders.filter((o) => o.paymentMethod === 'CARD').length;
    draft.push({
      tenantId,
      tenantName: ctx?.tenantName ?? tenantId,
      marketId: ctx?.marketId,
      marketName: ctx?.marketName,
      gmv,
      orderCount,
      avgBasket: orderCount > 0 ? roundMoney(gmv / orderCount) : 0,
      projectedFeeRevenue: roundMoney(orders.reduce((s, o) => s + o.projectedPlatformFee, 0)),
      couponExposure: roundMoney(orders.reduce((s, o) => s + o.discountAmount, 0)),
      gatewayExposure: roundMoney(orders.reduce((s, o) => s + o.gatewayFeeEstimate, 0)),
      cardRatio: orderCount > 0 ? cardOrders / orderCount : 0,
      estimatedContribution: roundMoney(
        orders.reduce(
          (s, o) => s + o.projectedPlatformFee + o.deliveryMargin - o.gatewayFeeEstimate - o.discountAmount,
          0
        )
      ),
      feeSource: classifyFeeSource(ctx?.marketFeeConfig, ctx?.tenantFeeOverride),
    });
  }

  const totalGmv = draft.reduce((s, r) => s + r.gmv, 0);
  const totalProjected = draft.reduce((s, r) => s + r.projectedFeeRevenue, 0);
  const marketAvgProjectedRate = totalGmv > 0 ? totalProjected / totalGmv : 0;

  return draft
    .map((r) => {
      const contributionPerOrder = r.orderCount > 0 ? roundMoney(r.estimatedContribution / r.orderCount) : 0;
      return {
        ...r,
        contributionPerOrder,
        classification: classifyStore(r, marketAvgProjectedRate),
      };
    })
    .sort((a, b) => b.gmv - a.gmv);
}

export function computePaymentAnalytics(normalized: NormalizedOrder[]): PaymentAnalytics {
  const cash = normalized.filter((o) => o.paymentMethod === 'CASH');
  const card = normalized.filter((o) => o.paymentMethod === 'CARD');
  const cashGmv = roundMoney(cash.reduce((s, o) => s + o.gmv, 0));
  const cardGmv = roundMoney(card.reduce((s, o) => s + o.gmv, 0));
  const smallCard = card.filter((o) => o.gmv < 80);

  return {
    cashOrders: cash.length,
    cardOrders: card.length,
    cashGmv,
    cardGmv,
    avgCashTicket: cash.length > 0 ? roundMoney(cashGmv / cash.length) : 0,
    avgCardTicket: card.length > 0 ? roundMoney(cardGmv / card.length) : 0,
    estimatedGatewayCosts: roundMoney(card.reduce((s, o) => s + o.gatewayFeeEstimate, 0)),
    smallCardOrders: smallCard.length,
    smallCardGmv: roundMoney(smallCard.reduce((s, o) => s + o.gmv, 0)),
  };
}

export function computeProfitabilityEstimates(
  overview: OverviewMetrics,
  monthlyOperationalCosts: number,
  from: Date,
  to: Date
): ProfitabilityEstimates {
  const msPerDay = 86400000;
  const periodDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / msPerDay));
  const ordersPerDay = overview.orderCount / periodDays;
  const ordersPerMonth = ordersPerDay * 30;

  const avgContribution =
    overview.orderCount > 0 ? overview.estimatedNetContribution / overview.orderCount : 0;
  const breakEvenOrdersPerMonth =
    avgContribution > 0 ? Math.ceil(monthlyOperationalCosts / avgContribution) : Infinity;

  const projectedMarginPct = overview.gmv > 0 ? roundMoney((overview.estimatedNetContribution / overview.gmv) * 100) : 0;
  const projectedContributionPct =
    overview.gmv > 0 ? roundMoney((overview.configuredPlatformRevenue / overview.gmv) * 100) : 0;

  return {
    burnRateMonthly: roundMoney(Math.max(0, monthlyOperationalCosts - overview.estimatedNetContribution * (30 / periodDays))),
    breakEvenOrdersPerMonth: Number.isFinite(breakEvenOrdersPerMonth) ? breakEvenOrdersPerMonth : 0,
    projectedMarginPct,
    projectedContributionPct,
    periodNetContribution: overview.estimatedNetContribution,
    periodDays,
  };
}

/**
 * Simulation engine — formula-only projection. Does NOT activate fees.
 *
 * Platform revenue/order ≈ clamp(avgBasket * (1-couponRate) * pct + fixed, min, max)
 * Gateway cost/order ≈ avgTicket * cardRatio * gatewayPct
 * Delivery margin/order ≈ avgDeliveryFee - avgDeliveryCost (if positive)
 * Contribution/order = platformRev + deliveryMargin - gateway - coupon - opsPerOrder
 */
export function runSimulation(input: SimulationInput): SimulationOutput {
  const avgBasket = Math.max(0, input.avgOrderValue);
  const feeBase = avgBasket * (1 - input.couponRatePct / 100);
  const rawFee = feeBase * (input.percentageFee / 100) + input.fixedFee;
  let platformFeePerOrder = rawFee;
  if (input.minFee > 0) platformFeePerOrder = Math.max(platformFeePerOrder, input.minFee);
  if (input.maxFee > 0) platformFeePerOrder = Math.min(platformFeePerOrder, input.maxFee);
  platformFeePerOrder = roundMoney(Math.max(0, platformFeePerOrder));

  const couponPerOrder = roundMoney(avgBasket * (input.couponRatePct / 100));
  const gatewayPerOrder = roundMoney(avgBasket * input.cardOrderRatio * (input.gatewayPct / 100));
  const deliveryMarginPerOrder = roundMoney(Math.max(0, input.avgDeliveryFee - input.avgDeliveryCost));
  const opsPerOrder =
    input.ordersPerMonth > 0 ? roundMoney(input.monthlyOperationalCosts / input.ordersPerMonth) : 0;

  const contributionPerOrder = roundMoney(
    platformFeePerOrder + deliveryMarginPerOrder - gatewayPerOrder - couponPerOrder - opsPerOrder
  );

  const projectedMonthlyPlatformRevenue = roundMoney(platformFeePerOrder * input.ordersPerMonth);
  const projectedMonthlyDeliveryMargin = roundMoney(deliveryMarginPerOrder * input.ordersPerMonth);
  const projectedMonthlyGatewayCost = roundMoney(gatewayPerOrder * input.ordersPerMonth);
  const projectedMonthlyCouponCost = roundMoney(couponPerOrder * input.ordersPerMonth);
  const projectedMonthlyContribution = roundMoney(contributionPerOrder * input.ordersPerMonth);
  const projectedProfitLoss = roundMoney(projectedMonthlyContribution - input.monthlyOperationalCosts);

  const breakEvenOrdersPerMonth =
    contributionPerOrder > 0 ? Math.ceil(input.monthlyOperationalCosts / contributionPerOrder) : 0;

  return {
    projectedMonthlyPlatformRevenue,
    projectedMonthlyDeliveryMargin,
    projectedMonthlyGatewayCost,
    projectedMonthlyCouponCost,
    projectedMonthlyContribution,
    projectedProfitLoss,
    breakEvenOrdersPerMonth,
    contributionPerOrder,
  };
}

/** Derive simulation defaults from observed metrics. */
export function simulationDefaultsFromOverview(
  overview: OverviewMetrics,
  normalized: NormalizedOrder[],
  monthlyOperationalCosts: number,
  periodDays: number
): SimulationInput {
  const deliveryOrders = normalized.filter((o) => o.deliveryFee > 0);
  const avgDeliveryFee =
    deliveryOrders.length > 0
      ? roundMoney(deliveryOrders.reduce((s, o) => s + o.deliveryFee, 0) / deliveryOrders.length)
      : 15;
  const couponRatePct = overview.gmv > 0 ? roundMoney((overview.couponExposure / overview.gmv) * 100) : 0;
  const ordersPerMonth = periodDays > 0 ? roundMoney((overview.orderCount / periodDays) * 30) : 0;

  return {
    percentageFee: DEFAULT_ECONOMICS_SETTINGS.simPercentage,
    minFee: DEFAULT_ECONOMICS_SETTINGS.simMinFee,
    maxFee: DEFAULT_ECONOMICS_SETTINGS.simMaxFee,
    fixedFee: DEFAULT_ECONOMICS_SETTINGS.simFixedFee,
    gatewayPct: DEFAULT_ECONOMICS_SETTINGS.gatewayPct,
    avgDeliveryCost: DEFAULT_ECONOMICS_SETTINGS.avgDeliveryCost,
    monthlyOperationalCosts,
    ordersPerMonth,
    avgOrderValue: overview.avgOrderValue,
    avgDeliveryFee,
    cardOrderRatio: 1 - overview.cashRatio,
    couponRatePct,
  };
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}₪${Math.abs(n).toLocaleString('en-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
