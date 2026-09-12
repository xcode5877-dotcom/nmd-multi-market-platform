/**
 * Company money generated / held through a courier (not driver wages).
 *
 * Source of truth: V3 computeDriverOrderAccounting (delivery fee + platform commission).
 * External income = verified deliveryFee only — never Order.total / merchandise.
 * Outstanding due uses PLATFORM_ONLY custody (cash liability), not online-retained revenue.
 */

import { businessDayKey, BUSINESS_TIMEZONE, parseDateRange } from './courier-payroll.js';
import {
  computeDriverOrderAccounting,
  extractVerifiedExternalDeliveryFee,
  isDriverCollectionCountable,
} from './driver-collections.js';

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export const OWNERSHIP_NOTE_AR =
  'هذه المبالغ محصلة لصالح الشركة ولا تمثل راتب السائق';

export const MISSING_EXTERNAL_FEE_WARNING_AR =
  'يوجد طلب خارجي بحاجة لمراجعة أجرة التوصيل';

export type CourierCompanyCollectionsSummary = {
  domain: 'company_collections_through_courier';
  period: string;
  from: string;
  to: string;
  timezone: string;
  currency: string;
  courierId: string;
  /** Verified external delivery fees only (alias of externalDeliveryIncomeVerified). */
  externalDeliveryIncome: number;
  externalDeliveryIncomeVerified: number;
  /** App-order delivery fee component. */
  appDeliveryIncome: number;
  /** App-order platform commission component. */
  appCommissionIncome: number;
  /** True when fee and commission are separately proven from order snapshots. */
  appIncomeSplitAvailable: boolean;
  /** Combined app delivery + commission. */
  appDeliveryAndCommissionIncome: number;
  /** Sum of verified company-retained components (excludes restaurant merchandise + missing fees). */
  companyGrossThroughCourier: number;
  /** Cash/platform liability already handed to company (settlements). */
  reconciledToCompany: number;
  /** Remaining company custody due from courier (PLATFORM_ONLY); excludes missing-fee externals. */
  outstandingToCompany: number;
  /** Platform liability generated in period from verified amounts only. */
  platformLiabilityGenerated: number;
  externalOrdersMissingFeeCount: number;
  needsReviewCount: number;
  hasIncompleteFinancialData: boolean;
  /**
   * Order IDs needing review. Populated only when opts.includeNeedsReviewOrderIds is true (Admin).
   * Never returned to Courier clients.
   */
  needsReviewOrderIds?: string[];
  restaurantMerchandiseExcluded: true;
  driverWageAutoCalculation: false;
  orderCounts: {
    completed: number;
    app: number;
    external: number;
    cash: number;
    onlinePaid: number;
  };
  ownershipNoteAr: string;
  missingExternalFeeWarningAr: string;
  labelsAr: Record<string, string>;
};

export function emptyCompanyCollectionsSummary(
  courierId: string,
  range: { from: string; to: string; timezone: string; period: string },
  currency = 'ILS'
): CourierCompanyCollectionsSummary {
  return {
    domain: 'company_collections_through_courier',
    period: range.period,
    from: range.from,
    to: range.to,
    timezone: range.timezone,
    currency,
    courierId,
    externalDeliveryIncome: 0,
    externalDeliveryIncomeVerified: 0,
    appDeliveryIncome: 0,
    appCommissionIncome: 0,
    appIncomeSplitAvailable: true,
    appDeliveryAndCommissionIncome: 0,
    companyGrossThroughCourier: 0,
    reconciledToCompany: 0,
    outstandingToCompany: 0,
    platformLiabilityGenerated: 0,
    externalOrdersMissingFeeCount: 0,
    needsReviewCount: 0,
    hasIncompleteFinancialData: false,
    restaurantMerchandiseExcluded: true,
    driverWageAutoCalculation: false,
    orderCounts: {
      completed: 0,
      app: 0,
      external: 0,
      cash: 0,
      onlinePaid: 0,
    },
    ownershipNoteAr: OWNERSHIP_NOTE_AR,
    missingExternalFeeWarningAr: MISSING_EXTERNAL_FEE_WARNING_AR,
    labelsAr: {
      externalDeliveryIncome: 'دخل توصيل الطلبات الخارجية',
      externalDeliveryIncomeVerified: 'دخل توصيل الطلبات الخارجية (موثّق)',
      appDeliveryIncome: 'دخل التوصيل من طلبات التطبيق',
      appCommissionIncome: 'دخل نسبة التطبيق',
      appDeliveryAndCommissionIncome: 'دخل التوصيل والنسبة من طلبات التطبيق',
      companyGrossThroughCourier: 'الإجمالي لصالح الشركة',
      reconciledToCompany: 'تم تسليمه للشركة',
      outstandingToCompany: 'المبلغ المطلوب تسليمه للشركة',
      remainingToHandOver: 'المتبقي للتسليم',
      workedHours: 'ساعات العمل',
      collectionsSection: 'تحصيل اليوم',
      attendanceSection: 'الدوام',
      needsReview: 'بحاجة للمراجعة',
    },
  };
}

function orderBusinessDay(order: Record<string, unknown>): string {
  const timeline = order.deliveryTimeline as { deliveredAt?: string } | undefined;
  const raw = String(timeline?.deliveredAt || order.createdAt || '');
  return raw ? businessDayKey(raw) : '';
}

/**
 * Aggregate company collections for one courier over [from, to] business days (Asia/Jerusalem).
 */
export function computeCourierCompanyCollections(
  orders: Record<string, unknown>[],
  courierId: string,
  from: string,
  to: string,
  opts?: {
    period?: string;
    currency?: string;
    /** When true, include needsReviewOrderIds (Admin only). */
    includeNeedsReviewOrderIds?: boolean;
  }
): CourierCompanyCollectionsSummary {
  const range = {
    from,
    to,
    timezone: BUSINESS_TIMEZONE,
    period: opts?.period ?? 'custom',
  };
  const out = emptyCompanyCollectionsSummary(courierId, range, opts?.currency ?? 'ILS');
  const reviewIds: string[] = [];

  for (const order of orders) {
    if (String(order.courierId ?? '') !== courierId) continue;
    if (!isDriverCollectionCountable(order)) continue;
    const day = orderBusinessDay(order);
    if (!day || day < from || day > to) continue;

    const acc = computeDriverOrderAccounting(order);
    out.orderCounts.completed += 1;

    if (
      acc.normalizedPaymentMethod === 'CASH_ON_DELIVERY' ||
      acc.normalizedPaymentMethod === 'EXTERNAL_DELIVERY'
    ) {
      out.orderCounts.cash += 1;
    }
    if (acc.normalizedPaymentMethod === 'ONLINE_PAID') {
      out.orderCounts.onlinePaid += 1;
    }

    if (acc.isExternal) {
      out.orderCounts.external += 1;
      const verifiedFee = extractVerifiedExternalDeliveryFee(order);
      if (verifiedFee == null) {
        out.externalOrdersMissingFeeCount += 1;
        out.needsReviewCount += 1;
        out.hasIncompleteFinancialData = true;
        if (order.id != null && String(order.id)) {
          reviewIds.push(String(order.id));
        }
        // Authoritative settlement ledger may still record cash handed over.
        if (acc.settlementStatus === 'SETTLED') {
          out.reconciledToCompany = roundMoney(
            out.reconciledToCompany + (acc.settledAmount || 0)
          );
        }
        // Never invent income or outstanding from Order.total.
        continue;
      }
      out.externalDeliveryIncome = roundMoney(out.externalDeliveryIncome + verifiedFee);
    } else {
      out.orderCounts.app += 1;
      out.appDeliveryIncome = roundMoney(out.appDeliveryIncome + acc.deliveryFee);
      out.appCommissionIncome = roundMoney(out.appCommissionIncome + acc.platformCommission);
    }

    out.platformLiabilityGenerated = roundMoney(
      out.platformLiabilityGenerated + acc.driverPlatformLiabilityAmount
    );

    if (acc.settlementStatus === 'SETTLED') {
      out.reconciledToCompany = roundMoney(out.reconciledToCompany + (acc.settledAmount || 0));
    }
    out.outstandingToCompany = roundMoney(out.outstandingToCompany + acc.outstandingAmount);
  }

  out.externalDeliveryIncomeVerified = out.externalDeliveryIncome;
  out.appDeliveryAndCommissionIncome = roundMoney(out.appDeliveryIncome + out.appCommissionIncome);
  out.companyGrossThroughCourier = roundMoney(
    out.externalDeliveryIncomeVerified + out.appDeliveryAndCommissionIncome
  );
  out.appIncomeSplitAvailable = true;
  if (opts?.includeNeedsReviewOrderIds) {
    out.needsReviewOrderIds = reviewIds;
  }

  return out;
}

/** Strip Admin-only identifiers before returning to a Courier client. */
export function toCourierCompanyCollectionsResponse(
  summary: CourierCompanyCollectionsSummary
): Omit<CourierCompanyCollectionsSummary, 'needsReviewOrderIds'> {
  const { needsReviewOrderIds: _ids, ...rest } = summary;
  return rest;
}

export function resolveCollectionsRange(
  period?: string,
  from?: string,
  to?: string,
  date?: string
): { from: string; to: string; timezone: string; period: string } {
  if (date && !from && !to && (!period || period === 'today')) {
    const d = date.trim().slice(0, 10);
    return { from: d, to: d, timezone: BUSINESS_TIMEZONE, period: 'today' };
  }
  return parseDateRange(period, from, to);
}
